import { calculatePromotionSummary } from '../../artifacts/pakistani-storefront/src/utils/store';
import { pakistanCities } from '../../artifacts/pakistani-storefront/src/utils/pakistan';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { deliverEmail as deliverThroughProvider, providerStatus as getEmailProviderStatus } from '../../functions/email-engine.cjs';
import { parseBalance, parseCallResult, requestVoiceApi } from '../../functions/voice-provider.cjs';
import { normalizeWhatsAppPhone, sendWhatsAppTemplate, sendWhatsAppText } from '../../functions/whatsapp-provider.cjs';

type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  rawBody?: Buffer | string;
  url?: string;
  on?: (event: string, listener: (...args: unknown[]) => void) => unknown;
  query?: Record<string, string | string[]>;
};
type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
  send: (body: string) => void;
};
type SupabaseUser = { id: string; email?: string; user_metadata?: Record<string, unknown> };

export const config = { api: { bodyParser: false }, maxDuration: 300 };
const jsonHeaders = { 'content-type': 'application/json' };
const maxBodyLength = 64 * 1024;

function readEnvironment() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !anonKey || !serviceRoleKey) {
    throw Object.assign(new Error('The server Supabase environment is not configured.'), { status: 503 });
  }
  return { url, anonKey, serviceRoleKey };
}

function readBody(value: unknown) {
  if (typeof value === 'string') {
    if (Buffer.byteLength(value, 'utf8') > maxBodyLength) throw Object.assign(new Error('Request body is too large.'), { status: 413 });
    try { value = JSON.parse(value); }
    catch { throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 }); }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw Object.assign(new Error('Request body must be a JSON object.'), { status: 400 });
  }
  if (Buffer.byteLength(JSON.stringify(value), 'utf8') > maxBodyLength) {
    throw Object.assign(new Error('Request body is too large.'), { status: 413 });
  }
  return value as Record<string, unknown>;
}

async function rawRequestBody(request: ApiRequest) {
  if (Buffer.isBuffer(request.rawBody)) return request.rawBody;
  if (typeof request.rawBody === 'string') return Buffer.from(request.rawBody, 'utf8');
  if (Buffer.isBuffer(request.body)) return request.body;
  if (typeof request.body === 'string') return Buffer.from(request.body, 'utf8');
  if (request.body && typeof request.body === 'object') {
    return Buffer.from(JSON.stringify(request.body), 'utf8');
  }
  if (typeof request.on !== 'function') return Buffer.alloc(0);

  return await new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on?.('data', (chunk: unknown) => {
      const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      size += part.length;
      if (size > maxBodyLength) {
        reject(Object.assign(new Error('Request body is too large.'), { status: 413 }));
        return;
      }
      chunks.push(part);
    });
    request.on?.('end', () => resolve(Buffer.concat(chunks)));
    request.on?.('error', error => reject(error instanceof Error ? error : new Error('Request body could not be read.')));
  });
}

function parseRawPayload(raw: Buffer, contentType: string) {
  if (raw.length > maxBodyLength) throw Object.assign(new Error('Request body is too large.'), { status: 413 });
  if (!raw.length) return {};
  contentType = contentType.toLowerCase();
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw.toString('utf8')));
  }
  return readBody(raw.toString('utf8'));
}

async function parseRequestBody(request: ApiRequest) {
  return parseRawPayload(
    await rawRequestBody(request),
    String(request.headers['content-type'] || ''),
  );
}

function safeText(value: unknown, maxLength: number, required = true) {
  if (typeof value !== 'string') {
    if (required) throw Object.assign(new Error('A required text field is missing.'), { status: 400 });
    return '';
  }
  const clean = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if ((required && !clean) || clean.length > maxLength) {
    throw Object.assign(new Error('A text field is empty or exceeds its allowed length.'), { status: 400 });
  }
  return clean;
}

function bearerToken(request: ApiRequest) {
  const raw = request.headers.authorization || request.headers.Authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const match = typeof value === 'string' ? value.match(/^Bearer\s+(.+)$/i) : null;
  return match?.[1] || '';
}

async function supabaseRequest(
  apiPath: string,
  options: { method?: string; body?: unknown; prefer?: string; userToken?: string } = {},
) {
  const { url, anonKey, serviceRoleKey } = readEnvironment();
  const response = await fetch(`${url}${apiPath}`, {
    method: options.method || 'GET',
    headers: {
      apikey: options.userToken ? anonKey : serviceRoleKey,
      authorization: `Bearer ${options.userToken || serviceRoleKey}`,
      ...(options.body !== undefined ? jsonHeaders : {}),
      ...(options.prefer ? { prefer: options.prefer } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    signal: AbortSignal.timeout(12_000),
  });
  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try { data = JSON.parse(text); }
    catch { data = text; }
  }
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'message' in data
      ? String((data as { message: unknown }).message)
      : `Supabase returned HTTP ${response.status}.`;
    throw Object.assign(new Error(message), { status: response.status });
  }
  return data;
}

async function requireUser(request: ApiRequest): Promise<SupabaseUser> {
  const token = bearerToken(request);
  if (!token) throw Object.assign(new Error('Sign in to continue.'), { status: 401 });
  const { url, anonKey } = readEnvironment();
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw Object.assign(new Error('Your session is invalid or expired. Sign in again.'), { status: 401 });
  const user = await response.json() as SupabaseUser;
  if (!user?.id) throw Object.assign(new Error('Supabase did not return an authenticated user.'), { status: 401 });
  return user;
}

async function requireAdmin(user: SupabaseUser) {
  const result = await supabaseRequest(`/rest/v1/admin_allowlist?select=user_id,email&user_id=eq.${encodeURIComponent(user.id)}&limit=1`);
  const entry = Array.isArray(result) ? result[0] as { user_id?: string; email?: string } | undefined : undefined;
  if (!entry || entry.user_id !== user.id || entry.email?.trim().toLowerCase() !== user.email?.trim().toLowerCase()) {
    throw Object.assign(new Error('Administrator access is required.'), { status: 403 });
  }
}

async function consumeRateLimit(key: string, maxRequests: number, windowSeconds: number) {
  const result = await supabaseRequest('/rest/v1/rpc/consume_store_rate_limit', {
    method: 'POST',
    body: { p_key: key, p_max_requests: maxRequests, p_window_seconds: windowSeconds },
  });
  if (result !== true) throw Object.assign(new Error('Too many requests. Please wait and try again.'), { status: 429 });
}

async function publicRateLimitKey(request: ApiRequest, action: string) {
  const forwarded = request.headers['x-forwarded-for'] || request.headers['x-real-ip'] || 'unknown';
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const ip = String(raw).split(',')[0].trim().slice(0, 120) || 'unknown';
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  const digest = [...new Uint8Array(bytes)].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return `${action}:${digest}`;
}

async function readDocument(path: string): Promise<Record<string, unknown> | null> {
  const params = new URLSearchParams({ select: 'payload', path: `eq.${path}`, limit: '1' });
  const result = await supabaseRequest(`/rest/v1/store_documents?${params}`);
  return Array.isArray(result) && result[0]?.payload && typeof result[0].payload === 'object'
    ? result[0].payload as Record<string, unknown>
    : null;
}

async function readCollection(collectionPath: string): Promise<Array<Record<string, unknown> & { id: string }>> {
  const params = new URLSearchParams({
    select: 'document_id,payload',
    collection_path: `eq.${collectionPath}`,
    order: 'document_id.asc',
    limit: '500',
  });
  const result = await supabaseRequest(`/rest/v1/store_documents?${params}`);
  return Array.isArray(result) ? result.flatMap(row =>
    row?.payload && typeof row.payload === 'object'
      ? [{ id: String(row.document_id || ''), ...(row.payload as Record<string, unknown>) }]
      : [],
  ) : [];
}

async function writeDocument(path: string, data: Record<string, unknown>, merge = true) {
  await supabaseRequest('/rest/v1/rpc/apply_store_documents_batch', {
    method: 'POST',
    body: {
      p_operations: [{ type: 'set', path, data, merge }],
    },
  });
}

async function claimDocumentField(
  path: string,
  field: string,
  value: Record<string, unknown>,
  blockedStatuses: string[],
) {
  const result = await supabaseRequest('/rest/v1/rpc/claim_store_document_field', {
    method: 'POST',
    body: {
      p_path: path,
      p_field: field,
      p_value: value,
      p_blocked_statuses: blockedStatuses,
    },
  });
  return result === true;
}

function queryValue(request: ApiRequest, key: string) {
  const value = request.query?.[key];
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function headerValue(request: ApiRequest, key: string) {
  const value = request.headers[key] || request.headers[key.toLowerCase()];
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function publicSiteUrl() {
  const raw = String(process.env.PUBLIC_SITE_URL || '').trim();
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return '';
    return parsed.origin;
  } catch {
    return '';
  }
}

function phoneE164(value: unknown) {
  const digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('92') && digits.length === 12) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 11) return `+92${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('3')) return `+92${digits}`;
  throw Object.assign(new Error('Order phone number is not a valid Pakistan mobile number.'), { status: 400 });
}

function voiceCredentials(settings: Record<string, unknown>) {
  const gatewayKey = String(process.env.VOICE_GATEWAY_API_KEY || '').trim();
  const username = String(settings.username || '').trim();
  if (settings.authMode === 'basic') {
    return {
      username,
      password: String(process.env.VOICE_API_PASSWORD || '').trim() || gatewayKey,
      token: '',
    };
  }
  return {
    username: '',
    password: '',
    token: String(process.env.VOICE_API_TOKEN || '').trim() || gatewayKey,
  };
}

function callEvent(status: string, message: string) {
  return { status, message: message.slice(0, 180), createdAt: new Date().toISOString() };
}

async function dispatchVoiceCall(orderId: string) {
  const config = await readDocument('voiceSettings/config') || {};
  if (config.enabled !== true) return { status: 'skipped', reason: 'Voice calls are disabled.' };
  const provider = String(config.provider || '');
  if (!['twilio', 'custom-webhook', 'api-service'].includes(provider)) {
    return { status: 'skipped', reason: 'No compatible voice provider is selected.' };
  }
  const orderPath = `orders/${orderId}`;
  const order = await readDocument(orderPath);
  if (!order) throw Object.assign(new Error('Order not found.'), { status: 404 });
  if (order.paymentMethod !== 'COD') {
    throw Object.assign(new Error('Confirmation calls are only available for cash-on-delivery orders.'), { status: 409 });
  }
  const priorVoiceCall = record(order.voiceCall);
  if (['confirmed', 'cancelled'].includes(String(priorVoiceCall.status))) {
    throw Object.assign(new Error('This order already has a final call response.'), { status: 409 });
  }
  if (priorVoiceCall.status === 'dispatched') {
    throw Object.assign(new Error('A confirmation call is already in progress.'), { status: 409 });
  }
  const callbackBase = publicSiteUrl();
  if (!callbackBase) {
    throw Object.assign(new Error('Set PUBLIC_SITE_URL to the public HTTPS URL of this deployment before enabling voice callbacks.'), { status: 503 });
  }
  const nonce = randomBytes(32).toString('hex');
  const nonceHash = createHash('sha256').update(nonce).digest('hex');
  const callback = `${callbackBase}/api/store/voiceCallWebhook?orderId=${encodeURIComponent(orderId)}&nonce=${nonce}`;
  const prompt = String(config.prompt || 'Your order amount is [Order Amount]. Press 1 to confirm or 2 to cancel.')
    .replaceAll('[Customer Name]', String(order.fullName || 'Customer'))
    .replaceAll('[Order Amount]', `Rs ${Number(order.grandTotal || 0).toLocaleString('en-PK')}`)
    .replaceAll('[Order ID]', String(order.id || orderId))
    .slice(0, 700);
  const state = {
    ...priorVoiceCall,
    status: 'dispatched',
    nonceHash,
    updatedAt: new Date().toISOString(),
    events: [...(Array.isArray(priorVoiceCall.events) ? priorVoiceCall.events : []), callEvent('dispatched', 'Call request submitted to provider.')].slice(-30),
  };
  const claimed = await claimDocumentField(orderPath, 'voiceCall', state, ['dispatched', 'confirmed', 'cancelled']);
  if (!claimed) throw Object.assign(new Error('A confirmation call is already in progress or has a final response.'), { status: 409 });

  const credentials = voiceCredentials(config);
  try {
    if (provider === 'twilio') {
      const sid = String(process.env.TWILIO_ACCOUNT_SID || '').trim();
      const token = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
      const senderPhone = String(config.senderPhone || '').trim();
      if (!sid || !token || !/^\+[1-9]\d{7,14}$/.test(senderPhone)) {
        throw new Error('Twilio server credentials or a valid E.164 caller ID are not configured.');
      }
      const escapeXml = (value: string) => value.replace(/[<>&"']/g, char => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
      })[char] || char);
      const twiml = `<Response><Gather numDigits="1" timeout="10" action="${escapeXml(callback)}" method="POST"><Say language="ur-PK">${escapeXml(prompt)}</Say></Gather><Say language="ur-PK">Aapka jawab record nahi hua. Shukriya.</Say></Response>`;
      const body = new URLSearchParams({ To: phoneE164(order.phone), From: senderPhone, Twiml: twiml });
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Calls.json`, {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body,
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Twilio rejected the call request (HTTP ${response.status}).`);
      const result = await response.json() as Record<string, unknown>;
      const current = await readDocument(orderPath) || order;
      const currentCall = record(current.voiceCall);
      await writeDocument(orderPath, {
        ...current,
        voiceCall: {
          ...currentCall,
          callSid: String(result.sid || '').slice(0, 160),
          updatedAt: new Date().toISOString(),
          events: [...(Array.isArray(currentCall.events) ? currentCall.events : []), callEvent('dispatched', 'Call accepted by Twilio.')].slice(-30),
        },
      }, false);
      return { status: 'dispatched' };
    }

    const endpoint = String(config.sendCallUrl || config.customWebhookUrl || '');
    const response = await requestVoiceApi({
      endpoint,
      username: credentials.username || String(config.username || '').trim(),
      password: credentials.password,
      token: credentials.token,
      body: {
        orderId,
        phone: phoneE164(order.phone),
        callerId: String(config.senderPhone || ''),
        prompt,
        callbackUrl: callback,
      },
    });
    if (!response.configured) throw new Error('Voice API endpoint or server credential is not configured.');
    const providerResult = record(response.data);
    const callId = parseCallResult(providerResult).callId
      || String(providerResult.call_id || providerResult.callId || providerResult.callID || providerResult.sid || '');
    const current = await readDocument(orderPath) || order;
    const currentCall = record(current.voiceCall);
    await writeDocument(orderPath, {
      ...current,
      voiceCall: {
        ...currentCall,
        callSid: callId.slice(0, 160),
        updatedAt: new Date().toISOString(),
        events: [...(Array.isArray(currentCall.events) ? currentCall.events : []), callEvent('dispatched', 'Call accepted by voice API.')].slice(-30),
      },
    }, false);
    return { status: 'dispatched' };
  } catch (error) {
    const current = await readDocument(orderPath) || order;
    const currentCall = record(current.voiceCall);
    await writeDocument(orderPath, {
      ...current,
      voiceCall: {
        ...currentCall,
        status: 'failed',
        nonceHash: null,
        updatedAt: new Date().toISOString(),
        events: [...(Array.isArray(currentCall.events) ? currentCall.events : []), callEvent('failed', error instanceof Error ? error.message : 'Provider request failed.')].slice(-30),
      },
    }, false);
    throw Object.assign(new Error(error instanceof Error ? error.message : 'Voice call dispatch failed.'), { status: 503 });
  }
}

async function checkVoiceBalance() {
  const settings = await readDocument('voiceSettings/config') || {};
  if (settings.enabled !== true || !['custom-webhook', 'api-service'].includes(String(settings.provider))) {
    return { configured: false, available: false, balance: null, currency: '' };
  }
  const credentials = voiceCredentials(settings);
  const result = await requestVoiceApi({
    endpoint: settings.checkBalanceUrl,
    method: settings.balanceMethod === 'POST' ? 'POST' : 'GET',
    username: credentials.username,
    password: credentials.password,
    token: credentials.token,
    body: {},
  });
  return result.configured
    ? { configured: true, ...parseBalance(result.data) }
    : { configured: false, available: false, balance: null, currency: '' };
}

async function refreshVoiceCallResult(orderId: string) {
  const path = `orders/${orderId}`;
  const order = await readDocument(path);
  if (!order) throw Object.assign(new Error('Order not found.'), { status: 404 });
  const settings = await readDocument('voiceSettings/config') || {};
  if (!settings.enabled || !['custom-webhook', 'api-service'].includes(String(settings.provider))) return { configured: false };
  const credentials = voiceCredentials(settings);
  const result = await requestVoiceApi({
    endpoint: settings.callResultUrl,
    method: 'POST',
    username: credentials.username,
    password: credentials.password,
    token: credentials.token,
    body: { orderId, callId: record(order.voiceCall).callSid || '' },
  });
  if (!result.configured) return { configured: false };
  const parsed = parseCallResult(result.data);
  const previous = record(order.voiceCall);
  const events = Array.isArray(previous.events) ? previous.events : [];
  const last = record(previous.lastResult);
  const changed = ['status', 'providerStatus', 'callId', 'userResponse', 'duration']
    .some(key => last[key] !== parsed[key as keyof typeof parsed]);
  await writeDocument(path, {
    ...order,
    voiceCall: {
      ...previous,
      status: parsed.status,
      providerStatus: parsed.providerStatus,
      lastResult: parsed,
      updatedAt: new Date().toISOString(),
      ...(parsed.callId ? { callSid: parsed.callId } : {}),
      ...(parsed.duration !== null ? { durationSeconds: parsed.duration } : {}),
      ...(parsed.userResponse ? { userResponse: parsed.userResponse } : {}),
      events: changed
        ? [...events, callEvent(parsed.status, `Provider result: ${parsed.providerStatus || parsed.status}; response ${parsed.userResponse || 'none'}; duration ${parsed.duration ?? 'unknown'}s.`)].slice(-30)
        : events,
    },
  }, false);
  return { configured: true, result: parsed };
}

function money(value: unknown, fallback = 0) {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? Math.round(amount * 100) / 100 : fallback;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function emailAddress(value: unknown) {
  const email = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] || character);
}

async function loadEmailSettings() {
  return await readDocument('emailSettings/config') || {};
}

function emailProviderStatus(settings: Record<string, unknown>) {
  return getEmailProviderStatus(settings, {
    resendApiKey: process.env.RESEND_API_KEY || '',
    sendgridApiKey: process.env.SENDGRID_API_KEY || '',
    smtpPassword: process.env.SMTP_PASSWORD || '',
  });
}

async function deliverEmail(
  settings: Record<string, unknown>,
  senderProfileId: string,
  toValue: unknown,
  subjectValue: unknown,
  textValue: unknown,
) {
  const status = emailProviderStatus(settings);
  if (!status.canSend) throw Object.assign(new Error(status.detail), { status: 503 });
  const profiles = Array.isArray(settings.senderProfiles) ? settings.senderProfiles.map(record) : [];
  const profile = profiles.find(item => item.id === senderProfileId)
    || profiles.find(item => item.id === settings.defaultSenderProfileId)
    || profiles[0];
  const to = emailAddress(toValue);
  const fromEmail = emailAddress(profile?.email);
  const fromName = String(profile?.name || '').replace(/[\r\n<>]/g, '').trim().slice(0, 100);
  if (!to || !fromEmail || !fromName) throw Object.assign(new Error('A valid recipient and sender profile are required.'), { status: 400 });
  const subject = safeText(subjectValue, 180);
  const text = safeText(textValue, 10000);
  const html = `<div style="font-family:Arial,sans-serif;white-space:normal;line-height:1.6">${escapeHtml(text).replace(/\n/g, '<br>')}</div>`;
  try {
    return await deliverThroughProvider({
      settings,
      sender: { name: fromName, email: fromEmail },
      to,
      subject,
      text,
      html,
      secrets: {
        resendApiKey: process.env.RESEND_API_KEY || '',
        sendgridApiKey: process.env.SENDGRID_API_KEY || '',
        smtpPassword: process.env.SMTP_PASSWORD || '',
      },
    });
  } catch (error) {
    console.error('[email] Provider delivery failed.', error instanceof Error ? error.name : 'UnknownError');
    throw Object.assign(new Error('The configured email provider did not accept the message.'), { status: 502 });
  }
}

async function buildOrder(input: Record<string, unknown>, user: SupabaseUser) {
  const requestId = safeText(input.requestId, 80);
  const rawItems = Array.isArray(input.items) ? input.items : [];
  if (!rawItems.length || rawItems.length > 50) throw Object.assign(new Error('Your cart must contain between one and fifty lines.'), { status: 400 });

  const aggregated = new Map<string, { productId: number; quantity: number; variant: string; variantId?: string }>();
  for (const raw of rawItems) {
    const item = record(raw);
    const productId = Number(item.productId);
    const quantity = Number(item.quantity);
    if (!Number.isSafeInteger(productId) || productId < 1 || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw Object.assign(new Error('Your cart contains an invalid item or quantity.'), { status: 400 });
    }
    const variant = safeText(item.variant || 'Standard', 120);
    const variantId = typeof item.variantId === 'string' ? item.variantId : '';
    const key = `${productId}:${variantId || variant}`;
    const existing = aggregated.get(key);
    if (existing) existing.quantity += quantity;
    else aggregated.set(key, { productId, quantity, variant, ...(variantId ? { variantId } : {}) });
  }
  const items = [...aggregated.values()].sort((a, b) => a.productId - b.productId || (a.variantId || a.variant).localeCompare(b.variantId || b.variant));
  if (items.some(item => item.quantity > 99)) throw Object.assign(new Error('A product quantity cannot exceed 99.'), { status: 400 });

  const products = new Map<number, Record<string, unknown>>();
  for (const item of items) {
    if (!products.has(item.productId)) {
      const product = await readDocument(`products/${item.productId}`);
      if (!product) throw Object.assign(new Error('A product in your cart is no longer available.'), { status: 409 });
      products.set(item.productId, product);
    }
    const product = products.get(item.productId)!;
    if (product.status && product.status !== 'active') {
      throw Object.assign(new Error('A product in your cart is no longer available.'), { status: 409 });
    }
  }

  const global = await readDocument('storeContent/global') || {};
  const content = record(global.content);
  const settings = record(global.settings);
  const general = record(settings.general);
  const paymentDetails = record(settings.paymentDetails);
  const preparedItems = items.map(item => {
    const source = products.get(item.productId)!;
    const matrix = Array.isArray(source.variantMatrix) ? source.variantMatrix.map(record) : [];
    const selected = matrix.length
      ? matrix.find(variant => String(variant.id || '') === item.variantId
        || (!item.variantId && String(variant.label || '') === item.variant))
      : null;
    if (matrix.length && !selected) throw Object.assign(new Error('A selected product option is no longer available.'), { status: 409 });
    const variantNames = Array.isArray(source.variants) ? source.variants.map(String) : [];
    if (!matrix.length && variantNames.length && !variantNames.includes(item.variant)) {
      throw Object.assign(new Error('A selected product option is no longer available.'), { status: 409 });
    }
    const price = money(selected?.price ?? source.price, -1);
    const stock = Number(selected?.stock ?? source.stock);
    if (price <= 0 || !Number.isSafeInteger(stock) || stock < item.quantity) {
      throw Object.assign(new Error('There is not enough current stock for a product in your cart.'), { status: 409 });
    }
    const snapshot = {
      ...source,
      id: item.productId,
      price,
      stock,
      ...(selected ? { variantMatrix: undefined, selectedVariant: selected } : {}),
    };
    const itemSnapshot = {
      ...item,
      product: snapshot,
    };
    return itemSnapshot;
  });

  const deals = await readCollection('deals');
  const quantityDiscounts = record(content.quantityDiscounts);
  const promotion = calculatePromotionSummary(
    preparedItems.map(item => ({
      product: item.product as never,
      quantity: item.quantity,
    })),
    deals as never,
    quantityDiscounts as never,
  );

  const subtotal = money(promotion.discountedSubtotal + promotion.quantityTierDiscount + promotion.buyXGetYDiscount);
  const eligibleSubtotal = Math.max(0, money(promotion.discountedSubtotal));
  const couponCode = safeText(input.couponCode || '', 60, false).toUpperCase();
  let couponDiscount = 0;
  if (couponCode) {
    const coupons = await readCollection('coupons');
    const coupon = coupons.find(entry => String(entry.code || '').toUpperCase() === couponCode && entry.active === true);
    const today = new Date().toISOString().slice(0, 10);
    if (!coupon || (typeof coupon.expiresAt === 'string' && coupon.expiresAt < today)) {
      throw Object.assign(new Error('That coupon is no longer active.'), { status: 409 });
    }
    if (subtotal < money(coupon.minimumSubtotal)) {
      throw Object.assign(new Error('Your cart does not meet this coupon’s minimum subtotal.'), { status: 409 });
    }
    couponDiscount = Math.round(eligibleSubtotal * Math.min(100, money(coupon.percentOff)) / 100 * 100) / 100;
  }

  const deliveryEligibleSubtotal = preparedItems.reduce((sum, item) => {
    const product = record(item.product);
    return product.freeDeliveryEligible !== true ? sum : sum + money(product.price) * item.quantity;
  }, 0);
  const announcement = record(content.announcement);
  const threshold = money(announcement.freeDeliveryThreshold);
  const deliveryCharge = deliveryEligibleSubtotal > threshold ? 0 : money(general.deliveryFee);

  const paymentMethod = safeText(input.paymentMethod, 30);
  const cashOnDeliveryAvailable = general.cashOnDelivery === true
    && preparedItems.every(item => record(item.product).cashOnDeliveryEnabled === true);
  if (paymentMethod === 'COD' && !cashOnDeliveryAvailable) {
    throw Object.assign(new Error('Cash on delivery is not available for this cart.'), { status: 409 });
  }
  if (!['COD', 'BANK_TRANSFER', 'EASYPAISA', 'JAZZCASH'].includes(paymentMethod)) {
    throw Object.assign(new Error('Choose a supported payment method.'), { status: 400 });
  }
  if (paymentMethod !== 'COD') {
    const bankAccounts = Array.isArray(paymentDetails.bankAccounts) ? paymentDetails.bankAccounts.map(record) : [];
    const configured = paymentMethod === 'BANK_TRANSFER'
      ? bankAccounts.some(account => account.active === true && String(account.institution || '').trim() && String(account.accountTitle || '').trim() && String(account.accountNumberOrIban || '').trim())
      : paymentMethod === 'EASYPAISA'
        ? Boolean(String(paymentDetails.easypaisaAccountTitle || '').trim() && String(paymentDetails.easypaisaNumber || '').trim())
        : Boolean(String(paymentDetails.jazzcashAccountTitle || '').trim() && String(paymentDetails.jazzcashNumber || '').trim());
    if (!configured) throw Object.assign(new Error('This payment method is not configured for the store.'), { status: 409 });
  }

  const fullName = safeText(input.fullName, 150);
  const phone = safeText(input.phone, 25);
  const address = safeText(input.address, 240);
  const email = safeText(input.email || user.email || '', 254, false).toLowerCase();
  const phoneDigits = phone.replace(/\D/g, '');
  if (phoneDigits.length < 7 || phoneDigits.length > 15) throw Object.assign(new Error('Enter a valid phone number.'), { status: 400 });
  const city = safeText(input.city, 100);
  const province = Object.entries(pakistanCities).find(([, cities]) => cities.includes(city))?.[0];
  if (!province || (input.province && input.province !== province)) {
    throw Object.assign(new Error('Choose a supported delivery city.'), { status: 400 });
  }
  const grandTotal = Math.max(0, money(eligibleSubtotal - couponDiscount + deliveryCharge));
  const transactionReference = paymentMethod === 'COD' ? '' : safeText(input.transactionReference, 120);

  return {
    requestId,
    fullName,
    email,
    phone,
    address,
    addressLine2: safeText(input.addressLine2 || '', 240, false),
    city,
    province,
    postalCode: safeText(input.postalCode || '', 20, false),
    customerNote: safeText(input.customerNote || '', 1000, false),
    paymentMethod,
    transactionReference,
    subtotal,
    quantityTierDiscount: money(promotion.quantityTierDiscount),
    buyXGetYDiscount: money(promotion.buyXGetYDiscount),
    couponCode,
    couponDiscount,
    deliveryCharge,
    grandTotal,
    whatsappOptIn: paymentMethod === 'COD' && input.whatsappOptIn === true,
    whatsappUpdatesOptIn: input.whatsappUpdatesOptIn === true,
    whatsappMarketingOptIn: input.whatsappMarketingOptIn === true,
    items: preparedItems,
  };
}

async function bootstrapInitialAdministrator(user: SupabaseUser) {
  const expectedEmail = (process.env.SUPABASE_INITIAL_ADMIN_EMAIL || '').trim().toLowerCase();
  if (!expectedEmail || user.email?.trim().toLowerCase() !== expectedEmail) {
    throw Object.assign(new Error('This account is not configured as the initial administrator.'), { status: 403 });
  }
  await supabaseRequest('/rest/v1/admin_allowlist?on_conflict=user_id', {
    method: 'POST',
    body: [{ user_id: user.id, email: expectedEmail }],
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
  await writeDocument(`adminAccess/allowlist/users/${user.id}`, {
    uid: user.id,
    email: expectedEmail,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  await writeDocument(`users/${user.id}`, {
    uid: user.id,
    email: expectedEmail,
    admin: true,
    updatedAt: new Date().toISOString(),
  });
  return { ready: true };
}

async function listAdministrators() {
  const result = await supabaseRequest('/rest/v1/admin_allowlist?select=user_id,email,created_at&order=email.asc');
  return { administrators: Array.isArray(result) ? result : [] };
}

async function findUserByEmail(email: string) {
  const { url, serviceRoleKey } = readEnvironment();
  for (let page = 1; page <= 20; page++) {
    const response = await fetch(`${url}/auth/v1/admin/users?page=${page}&per_page=100`, {
      headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw Object.assign(new Error('Supabase Auth user lookup failed.'), { status: 502 });
    const payload = await response.json() as { users?: SupabaseUser[] };
    const users = payload.users || [];
    const match = users.find(user => user.email?.trim().toLowerCase() === email);
    if (match) return match;
    if (users.length < 100) break;
  }
  return null;
}

async function grantAdministrator(input: Record<string, unknown>, actor: SupabaseUser) {
  const expectedEmail = (process.env.SUPABASE_INITIAL_ADMIN_EMAIL || '').trim().toLowerCase();
  if (!expectedEmail || actor.email?.trim().toLowerCase() !== expectedEmail) {
    throw Object.assign(new Error('Only the configured initial administrator can change the administrator roster.'), { status: 403 });
  }
  const email = safeText(input.email, 254).toLowerCase();
  const target = await findUserByEmail(email);
  if (!target) throw Object.assign(new Error('That email does not belong to an existing Supabase Auth account.'), { status: 404 });
  await supabaseRequest('/rest/v1/admin_allowlist?on_conflict=user_id', {
    method: 'POST',
    body: [{ user_id: target.id, email }],
    prefer: 'resolution=merge-duplicates,return=minimal',
  });
  await writeDocument(`adminAccess/allowlist/users/${target.id}`, { uid: target.id, email, updatedAt: new Date().toISOString() });
  await writeDocument(`users/${target.id}`, { uid: target.id, email, admin: true, updatedAt: new Date().toISOString() });
  return { success: true, uid: target.id, email };
}

async function revokeAdministrator(input: Record<string, unknown>, actor: SupabaseUser) {
  const expectedEmail = (process.env.SUPABASE_INITIAL_ADMIN_EMAIL || '').trim().toLowerCase();
  if (!expectedEmail || actor.email?.trim().toLowerCase() !== expectedEmail) {
    throw Object.assign(new Error('Only the configured initial administrator can change the administrator roster.'), { status: 403 });
  }
  const uid = safeText(input.uid, 64);
  if (uid === actor.id) throw Object.assign(new Error('The initial administrator cannot revoke their own access.'), { status: 400 });
  const params = new URLSearchParams({ user_id: `eq.${uid}` });
  await supabaseRequest(`/rest/v1/admin_allowlist?${params}`, { method: 'DELETE', prefer: 'return=minimal' });
  await supabaseRequest(`/rest/v1/store_documents?path=eq.${encodeURIComponent(`adminAccess/allowlist/users/${uid}`)}`, {
    method: 'DELETE',
    prefer: 'return=minimal',
  });
  await writeDocument(`users/${uid}`, { uid, admin: false, updatedAt: new Date().toISOString() });
  return { success: true, uid };
}

async function updateOrderStatus(action: string, input: Record<string, unknown>, user: SupabaseUser) {
  const isAdminAction = action !== 'cancelOrder';
  if (isAdminAction) await requireAdmin(user);
  const orderId = safeText(input.orderId, 80);
  const path = `orders/${orderId}`;
  const order = await readDocument(path);
  if (!order) throw Object.assign(new Error('Order not found.'), { status: 404 });
  if (!isAdminAction) {
    if (order.userId !== user.id) throw Object.assign(new Error('This order does not belong to the signed-in customer.'), { status: 403 });
    if (order.status !== 'Pending') throw Object.assign(new Error('Only pending orders can be cancelled.'), { status: 409 });
  }
  let updatedOrder: Record<string, unknown>;
  if (action === 'cancelOrder') {
    await supabaseRequest('/rest/v1/rpc/cancel_store_order', {
      method: 'POST',
      body: { p_order_id: orderId, p_user_id: user.id },
    });
    updatedOrder = await readDocument(path) || { ...order, status: 'Cancelled' };
  } else if (action === 'adminUpdateOrder') {
    const patch = input.patch && typeof input.patch === 'object' ? input.patch as Record<string, unknown> : {};
    const cleanPatch: Record<string, unknown> = {};
    if (patch.status !== undefined) {
      const allowedStatuses = ['Pending', 'Processing', 'Confirmed by Call', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];
      if (!allowedStatuses.includes(String(patch.status))) {
        throw Object.assign(new Error('Invalid order status.'), { status: 400 });
      }
      if (String(patch.status) !== 'Cancelled'
        && String(order.paymentMethod) !== 'COD'
        && ['Processing', 'Shipped', 'Out for Delivery', 'Delivered'].includes(String(patch.status))
        && order.paymentVerified !== true) {
        throw Object.assign(new Error('Verify the bank or wallet payment before fulfillment.'), { status: 409 });
      }
      if (patch.status === 'Cancelled'
        && ['Shipped', 'Out for Delivery', 'Delivered'].includes(String(order.status))) {
        throw Object.assign(new Error('Dispatched orders need a return process, not a pre-dispatch cancellation.'), { status: 409 });
      }
      cleanPatch.status = patch.status;
      if (patch.status === 'Delivered' && order.status !== 'Delivered') {
        cleanPatch.deliveredAt = new Date().toISOString();
      }
    }
    for (const key of ['courier', 'trackingNumber']) {
      if (patch[key] !== undefined) cleanPatch[key] = safeText(patch[key], 120, false);
    }
    if (patch.trackingUrl !== undefined) {
      const trackingUrl = safeText(patch.trackingUrl, 1000, false);
      if (trackingUrl) {
        let parsed: URL;
        try { parsed = new URL(trackingUrl); }
        catch { throw Object.assign(new Error('Tracking URL must be a valid HTTPS link.'), { status: 400 }); }
        if (parsed.protocol !== 'https:') throw Object.assign(new Error('Tracking URL must use HTTPS.'), { status: 400 });
      }
      cleanPatch.trackingUrl = trackingUrl;
    }
    if (!Object.keys(cleanPatch).length) throw Object.assign(new Error('No supported order fields were provided.'), { status: 400 });
    if (cleanPatch.status === 'Cancelled' && order.status !== 'Cancelled') {
      const ownerId = String(order.userId || '');
      if (!/^[0-9a-f-]{36}$/i.test(ownerId)) {
        throw Object.assign(new Error('This legacy order cannot be cancelled because it has no customer account ID.'), { status: 409 });
      }
      await supabaseRequest('/rest/v1/rpc/cancel_store_order', {
        method: 'POST',
        body: { p_order_id: orderId, p_user_id: ownerId },
      });
      updatedOrder = await readDocument(path) || { ...order, status: 'Cancelled' };
      const otherChanges = Object.fromEntries(Object.entries(cleanPatch).filter(([key]) => key !== 'status'));
      if (Object.keys(otherChanges).length) {
        await writeDocument(path, { ...otherChanges, updatedAt: new Date().toISOString() });
        updatedOrder = await readDocument(path) || { ...updatedOrder, ...otherChanges };
      }
    } else if (order.status === 'Cancelled'
      && typeof cleanPatch.status === 'string'
      && cleanPatch.status !== 'Cancelled') {
      const ownerId = String(order.userId || '');
      if (!/^[0-9a-f-]{36}$/i.test(ownerId)) {
        throw Object.assign(new Error('This legacy order cannot be reopened because it has no customer account ID.'), { status: 409 });
      }
      await supabaseRequest('/rest/v1/rpc/reopen_store_order', {
        method: 'POST',
        body: { p_order_id: orderId, p_user_id: ownerId, p_status: cleanPatch.status },
      });
      const otherChanges = Object.fromEntries(Object.entries(cleanPatch).filter(([key]) => key !== 'status'));
      if (Object.keys(otherChanges).length) {
        await writeDocument(path, { ...otherChanges, updatedAt: new Date().toISOString() });
      }
      updatedOrder = await readDocument(path) || { ...order, ...cleanPatch };
    } else {
      await writeDocument(path, { ...cleanPatch, updatedAt: new Date().toISOString() });
      updatedOrder = await readDocument(path) || { ...order, ...cleanPatch };
    }
  } else {
    await writeDocument(path, {
      paymentVerified: true,
      paymentVerifiedAt: new Date().toISOString(),
      paymentVerifiedBy: user.id,
      paymentVerifiedByLabel: user.email || '',
      status: order.status === 'Pending' ? 'Processing' : order.status,
    });
    updatedOrder = await readDocument(path) || { ...order, paymentVerified: true };
  }

  if (updatedOrder.status === 'Cancelled' && order.status !== 'Cancelled') {
    await sendAutomatedEmail('cancellation', updatedOrder.email, orderEmailValues(updatedOrder));
  } else if (updatedOrder.status === 'Shipped'
    && (order.status !== 'Shipped'
      || ['courier', 'trackingNumber', 'trackingUrl'].some(key => updatedOrder[key] !== order[key]))) {
    await sendAutomatedEmail('shippingUpdate', updatedOrder.email, orderEmailValues(updatedOrder));
  }
  if (updatedOrder.status !== order.status) {
    await notifyWhatsAppOrderStatus(updatedOrder, String(updatedOrder.status));
  }
  return { success: true, orderId };
}

async function saveCheckoutSession(input: Record<string, unknown>, user: SupabaseUser, clear = false) {
  const path = `checkoutSessions/${user.id}`;
  if (clear) {
    await supabaseRequest(`/rest/v1/store_documents?path=eq.${encodeURIComponent(path)}`, { method: 'DELETE', prefer: 'return=minimal' });
    const params = new URLSearchParams({ user_id: `eq.${user.id}` });
    await supabaseRequest(`/rest/v1/checkout_sessions?${params}`, { method: 'DELETE', prefer: 'return=minimal' });
    return { success: true };
  }
  const items = Array.isArray(input.items) ? input.items.slice(0, 50) : [];
  const orderTotal = Number(input.orderTotal);
  await writeDocument(path, {
    userId: user.id,
    email: input.consent === true ? safeText(input.email || user.email || '', 254, false).toLowerCase() : '',
    phone: safeText(input.phone || '', 25, false),
    emailConsent: input.consent === true,
    whatsappRecoveryConsent: input.whatsappConsent === true,
    items,
    orderTotal: Number.isFinite(orderTotal) ? Math.max(0, orderTotal) : 0,
    status: 'active',
    emailRecovery: { status: 'pending' },
    emailRecoveryStatus: null,
    emailRecoverySentAt: null,
    recoverySentAt: null,
    whatsappRecovery: { status: 'pending' },
    whatsappRecoveryStatus: null,
    whatsappRecoverySentAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return { success: true };
}

async function submitPublicMessage(action: string, input: Record<string, unknown>, request: ApiRequest) {
  await consumeRateLimit(await publicRateLimitKey(request, action), action === 'subscribeNewsletter' ? 10 : 5, 3600);
  if (action === 'subscribeNewsletter') {
    const email = safeText(input.email, 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Enter a valid email address.'), { status: 400 });
    await supabaseRequest('/rest/v1/newsletter_subscribers?on_conflict=email', {
      method: 'POST',
      body: [{ id: crypto.randomUUID(), email }],
      prefer: 'resolution=merge-duplicates,return=minimal',
    });
    return { success: true };
  }
  const name = safeText(input.name, 120);
  const email = safeText(input.email, 254).toLowerCase();
  const message = safeText(input.message, 4000);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Enter a valid email address.'), { status: 400 });
  const id = crypto.randomUUID();
  await writeDocument(`inbox/${id}`, {
    id,
    name,
    email,
    phone: safeText(input.phone || '', 25, false),
    message,
    status: 'new',
    submittedAt: new Date().toISOString(),
    replies: [],
    extra: { source: 'storefront-contact-form' },
  });
  return { success: true };
}

async function sendTestEmail(input: Record<string, unknown>, user: SupabaseUser) {
  await requireAdmin(user);
  const settings = await loadEmailSettings();
  const delivery = await deliverEmail(
    settings,
    safeText(input.senderProfileId || '', 120, false),
    input.recipient,
    'Store email delivery test',
    'This message confirms that your store email provider accepted a test message.',
  );
  return { sent: true, provider: delivery.provider };
}

async function campaignRecipients(audience: unknown) {
  if (audience === 'newsletter') {
    const result = await supabaseRequest('/rest/v1/newsletter_subscribers?select=email&unsubscribed_at=is.null&limit=500');
    return Array.isArray(result) ? [...new Set(result.map(item => emailAddress(item.email)).filter(Boolean))] : [];
  }
  const [users, orders] = await Promise.all([readCollection('users'), readCollection('orders')]);
  const pastBuyerIds = new Set(
    orders.map(order => String(order.userId || '')).filter(Boolean),
  );
  const customers = users.filter(user => user.marketingConsent === true
    && emailAddress(user.email)
    && (audience !== 'past-buyers' || pastBuyerIds.has(String(user.uid || user.id || ''))));
  return [...new Map<string, { email: string; name: string }>(customers.map(customer => [
    emailAddress(customer.email),
    { email: emailAddress(customer.email), name: String(customer.displayName || customer.name || 'there').slice(0, 120) },
  ] as const)).values()];
}

function interpolateEmail(template: unknown, values: Record<string, string>) {
  return String(template || '')
    .replace(/\bNura\b(?![-_])/gi, safeText(values.store_name || 'our store', 100, false))
    .replace(/\\n/g, '\n')
    .replace(/\{([a-z_]+)\}/g, (_match, key: string) => values[key] || '');
}

function orderEmailValues(order: Record<string, unknown>) {
  const items = Array.isArray(order.items) ? order.items.map(record) : [];
  return {
    customer_name: String(order.fullName || 'Customer'),
    order_id: String(order.id || ''),
    order_total: `Rs ${Number(order.grandTotal || 0).toLocaleString('en-PK')}`,
    items_list: items.map(item => {
      const product = record(item.product);
      return `${Number(item.quantity || 1)} × ${String(product.name || 'Item')}${item.variant && item.variant !== 'Standard' ? ` · ${String(item.variant)}` : ''}`;
    }).join('\n'),
    courier_name: String(order.courier || ''),
    tracking_number: String(order.trackingNumber || ''),
    tracking_url: String(order.trackingUrl || ''),
  };
}

async function sendAutomatedEmail(triggerId: string, to: unknown, values: Record<string, string>) {
  try {
    const [settings, generalSettings] = await Promise.all([loadEmailSettings(), loadGeneralSettings()]);
    const templateValues = { ...values, store_name: emailStoreName(generalSettings) };
    const trigger = record(record(settings.triggers)[triggerId]);
    if (settings.masterEnabled !== true || trigger.enabled !== true || !emailProviderStatus(settings).canSend) return false;
    const template = record(record(settings.templates)[triggerId]);
    await deliverEmail(
      settings,
      String(trigger.senderProfileId || settings.defaultSenderProfileId || ''),
      to,
      interpolateEmail(template.subject, templateValues),
      interpolateEmail(template.body, templateValues),
    );
    return true;
  } catch (error) {
    console.error(`[email] Automated ${triggerId} message was not sent.`, error instanceof Error ? error.name : 'UnknownError');
    return false;
  }
}

async function loadGeneralSettings() {
  const global = await readDocument('storeContent/global') || {};
  return record(record(global.settings).general);
}

function emailStoreName(settings: Record<string, unknown>) {
  const configured = typeof settings.storeName === 'string' ? safeText(settings.storeName, 100, false) : '';
  return configured || 'our store';
}

function whatsAppCredentials(settings: Record<string, unknown>) {
  return {
    token: String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim(),
    phoneNumberId: String(settings.codWhatsAppPhoneNumberId || '').trim(),
    language: String(settings.codWhatsAppLanguage || 'en').trim() || 'en',
  };
}

async function runBatches<T>(items: T[], batchSize: number, task: (item: T) => Promise<boolean>) {
  let succeeded = 0;
  for (let offset = 0; offset < items.length; offset += batchSize) {
    const results = await Promise.allSettled(items.slice(offset, offset + batchSize).map(task));
    succeeded += results.filter(result => result.status === 'fulfilled' && result.value).length;
  }
  return succeeded;
}

async function sendCodWhatsAppConfirmation(order: Record<string, unknown>) {
  if (order.paymentMethod !== 'COD' || order.whatsappOptIn !== true) return false;
  const settings = await loadGeneralSettings();
  if (settings.codWhatsAppAutoSendEnabled !== true) return false;
  const { token, phoneNumberId, language } = whatsAppCredentials(settings);
  const templateName = String(settings.codWhatsAppTemplateName || '').trim();
  if (!token || !phoneNumberId || !templateName) return false;
  const path = `orders/${String(order.id || '')}`;
  if (!await claimDocumentField(path, 'whatsappConfirmation', {
    status: 'sending', attempts: 1, updatedAt: new Date().toISOString(),
  }, ['sent', 'sending'])) return false;
  try {
    await sendWhatsAppTemplate({
      token, phoneNumberId, to: phoneE164(order.phone), name: templateName, language,
      parameters: [
        String(order.fullName || 'Customer').slice(0, 120),
        String(order.id || '').slice(0, 80),
        `Rs ${Number(order.grandTotal || 0).toLocaleString('en-PK')}`,
      ],
    });
    await writeDocument(path, {
      whatsappConfirmation: { status: 'sent', attempts: 1, sentAt: new Date().toISOString() },
    });
    return true;
  } catch (error) {
    await writeDocument(path, {
      whatsappConfirmation: { status: 'failed', attempts: 1, updatedAt: new Date().toISOString() },
    });
    console.error('[whatsapp] COD confirmation delivery failed.', error instanceof Error ? error.message : 'UnknownError');
    return false;
  }
}

async function notifyAdminWhatsAppNewOrder(order: Record<string, unknown>) {
  const settings = await loadGeneralSettings();
  if (settings.whatsappAdminNotificationsEnabled !== true) return false;
  const { token, phoneNumberId, language } = whatsAppCredentials(settings);
  const adminPhone = String(settings.whatsappAdminPhone || '').trim();
  const templateName = String(settings.whatsappAdminOrderTemplateName || '').trim();
  if (!token || !phoneNumberId || !adminPhone || !templateName) return false;
  const path = `orders/${String(order.id || '')}`;
  if (!await claimDocumentField(path, 'whatsappAdminNotification', {
    status: 'sending', updatedAt: new Date().toISOString(),
  }, ['sent', 'sending'])) return false;
  try {
    await sendWhatsAppTemplate({
      token, phoneNumberId, to: adminPhone, name: templateName, language,
      parameters: [
        String(order.fullName || 'Customer').slice(0, 120),
        String(order.id || '').slice(0, 80),
        `Rs ${Number(order.grandTotal || 0).toLocaleString('en-PK')}`,
      ],
    });
    await writeDocument(path, {
      whatsappAdminNotification: { status: 'sent', sentAt: new Date().toISOString() },
    });
    return true;
  } catch (error) {
    await writeDocument(path, {
      whatsappAdminNotification: { status: 'failed', updatedAt: new Date().toISOString() },
    });
    console.error('[whatsapp] Admin order notification failed.', error instanceof Error ? error.message : 'UnknownError');
    return false;
  }
}

async function notifyWhatsAppOrderStatus(order: Record<string, unknown>, status: string) {
  if (order.whatsappUpdatesOptIn !== true) return false;
  const templateKey = status === 'Shipped' ? 'whatsappShippedTemplateName'
    : status === 'Out for Delivery' ? 'whatsappOutForDeliveryTemplateName' : '';
  if (!templateKey) return false;
  const settings = await loadGeneralSettings();
  if (settings.whatsappShippingUpdatesEnabled !== true) return false;
  const { token, phoneNumberId, language } = whatsAppCredentials(settings);
  const templateName = String(settings[templateKey] || '').trim();
  if (!token || !phoneNumberId || !templateName) return false;
  const path = `orders/${String(order.id || '')}`;
  const stateField = status === 'Shipped' ? 'whatsappShippedNotification' : 'whatsappOutForDeliveryNotification';
  if (!await claimDocumentField(path, stateField, {
    status: 'sending', updatedAt: new Date().toISOString(),
  }, ['sent', 'sending'])) return false;
  try {
    await sendWhatsAppTemplate({
      token, phoneNumberId, to: phoneE164(order.phone), name: templateName, language,
      parameters: [
        String(order.fullName || 'Customer'), String(order.id || ''),
        String(order.trackingNumber || 'Not available'), String(order.trackingUrl || ''),
      ],
    });
    await writeDocument(path, {
      [stateField]: { status: 'sent', sentAt: new Date().toISOString() },
      whatsappStatusMessages: { [status]: { status: 'sent', sentAt: new Date().toISOString() } },
    });
    return true;
  } catch (error) {
    await writeDocument(path, {
      [stateField]: { status: 'failed', updatedAt: new Date().toISOString() },
      whatsappStatusMessages: { [status]: { status: 'failed', updatedAt: new Date().toISOString() } },
    });
    console.error('[whatsapp] Status alert failed.', error instanceof Error ? error.message : 'UnknownError');
    return false;
  }
}

async function sendWhatsAppMarketingCampaign(input: Record<string, unknown>, user: SupabaseUser) {
  await requireAdmin(user);
  await consumeRateLimit(`whatsapp-marketing:${user.id}`, 2, 60);
  const message = safeText(input.message, 500);
  const settings = await loadGeneralSettings();
  const { token, phoneNumberId, language } = whatsAppCredentials(settings);
  const templateName = String(settings.whatsappMarketingTemplateName || '').trim();
  if (!token || !phoneNumberId || !templateName) return { configured: false, sent: 0, failed: 0, total: 0 };
  const orders = await readCollection('orders');
  const recipients = [...new Set(
    orders
      .filter(order => order.whatsappMarketingOptIn === true)
      .map(order => normalizeWhatsAppPhone(order.phone))
      .filter(phone => phone.length >= 10),
  )].slice(0, 100);
  const sent = await runBatches(recipients, 8, async to => {
    try {
      await sendWhatsAppTemplate({ token, phoneNumberId, to, name: templateName, language, parameters: [message] });
      return true;
    } catch (error) {
      console.error('[whatsapp] Campaign recipient send failed.', error instanceof Error ? error.message : 'UnknownError');
      return false;
    }
  });
  const failed = recipients.length - sent;
  return { configured: true, sent, failed, total: recipients.length };
}

async function runAbandonedCheckoutEmails() {
  const [settings, generalSettings] = await Promise.all([loadEmailSettings(), loadGeneralSettings()]);
  const storeName = emailStoreName(generalSettings);
  const trigger = record(record(settings.triggers).abandonedCart);
  if (settings.masterEnabled !== true || trigger.enabled !== true || !emailProviderStatus(settings).canSend) {
    return { processed: 0, sent: 0 };
  }
  const cutoff = Date.now() - 60 * 60 * 1000;
  const sessions = (await readCollection('checkoutSessions'))
    .filter(session => session.status === 'active'
      && session.emailConsent === true
      && emailAddress(session.email)
      && !session.recoverySentAt
      && !session.emailRecoverySentAt
      && session.emailRecoveryStatus !== 'sending'
      && Date.parse(String(session.updatedAt || '')) <= cutoff)
    .slice(0, 75);
  const sent = await runBatches(sessions, 8, async session => {
    const path = `checkoutSessions/${session.userId || session.id}`;
    if (!await claimDocumentField(path, 'emailRecovery', {
      status: 'sending', attemptedAt: new Date().toISOString(),
    }, ['sent', 'sending'])) return false;
    const values = {
      customer_name: String(session.email || 'Customer').split('@')[0],
      order_id: '',
      order_total: `Rs ${Number(session.orderTotal || 0).toLocaleString('en-PK')}`,
      items_list: (Array.isArray(session.items) ? session.items.map(record) : [])
        .map(item => `${Number(item.quantity || 1)} × ${String(item.name || 'Item')}${item.variant && item.variant !== 'Standard' ? ` · ${String(item.variant)}` : ''}`)
        .join('\n'),
      courier_name: '',
      tracking_number: '',
      tracking_url: '',
      store_name: storeName,
    };
    const template = record(record(settings.templates).abandonedCart);
    try {
      await deliverEmail(
        settings,
        String(trigger.senderProfileId || settings.defaultSenderProfileId || ''),
        session.email,
        interpolateEmail(template.subject, values),
        interpolateEmail(template.body, values),
      );
      const timestamp = new Date().toISOString();
      await writeDocument(path, {
        emailRecovery: { status: 'sent', sentAt: timestamp },
        emailRecoveryStatus: 'sent',
        emailRecoverySentAt: timestamp,
        recoverySentAt: timestamp,
      });
      return true;
    } catch (error) {
      await writeDocument(path, {
        emailRecovery: { status: 'failed', updatedAt: new Date().toISOString() },
        emailRecoveryStatus: 'failed',
      });
      console.error('[email] Abandoned checkout message failed.', error instanceof Error ? error.name : 'UnknownError');
      return false;
    }
  });
  return { processed: sessions.length, sent };
}

async function runAbandonedCheckoutWhatsApp() {
  const settings = await loadGeneralSettings();
  const { token, phoneNumberId, language } = whatsAppCredentials(settings);
  const templateName = String(settings.whatsappAbandonedCartTemplateName || '').trim();
  if (!token || !phoneNumberId || !templateName || settings.whatsappAbandonedCartEnabled !== true) {
    return { processed: 0, sent: 0 };
  }
  const cutoff = Date.now() - 60 * 60 * 1000;
  const sessions = (await readCollection('checkoutSessions'))
    .filter(session => session.status === 'active'
      && session.whatsappRecoveryConsent === true
      && String(session.phone || '').trim()
      && !session.whatsappRecoverySentAt
      && session.whatsappRecoveryStatus !== 'sending'
      && record(session.whatsappRecovery).status !== 'sending'
      && Date.parse(String(session.updatedAt || '')) <= cutoff)
    .slice(0, 75);
  const sent = await runBatches(sessions, 8, async session => {
    const path = `checkoutSessions/${session.userId || session.id}`;
    if (!await claimDocumentField(path, 'whatsappRecovery', {
      status: 'sending', attemptedAt: new Date().toISOString(),
    }, ['sent', 'sending'])) return false;
    const itemList = (Array.isArray(session.items) ? session.items.map(record) : [])
      .slice(0, 5)
      .map(item => `${item.quantity} × ${String(item.name || 'Item')}`)
      .join(', ')
      .slice(0, 400);
    try {
      await sendWhatsAppTemplate({
        token, phoneNumberId, to: phoneE164(session.phone), name: templateName, language,
        parameters: [String(session.email || 'Customer').split('@')[0], itemList],
      });
      const timestamp = new Date().toISOString();
      await writeDocument(path, {
        whatsappRecovery: { status: 'sent', sentAt: timestamp },
        whatsappRecoveryStatus: 'sent',
        whatsappRecoverySentAt: timestamp,
      });
      return true;
    } catch (error) {
      await writeDocument(path, {
        whatsappRecovery: { status: 'failed', updatedAt: new Date().toISOString() },
        whatsappRecoveryStatus: 'failed',
      });
      console.error('[whatsapp] Abandoned checkout reminder failed.', error instanceof Error ? error.message : 'UnknownError');
      return false;
    }
  });
  return { processed: sessions.length, sent };
}

async function runWhatsAppReviewRequests() {
  const settings = await loadGeneralSettings();
  const { token, phoneNumberId, language } = whatsAppCredentials(settings);
  const templateName = String(settings.whatsappReviewTemplateName || '').trim();
  if (!token || !phoneNumberId || !templateName || settings.whatsappReviewRequestsEnabled !== true) {
    return { processed: 0, sent: 0 };
  }
  const dueAt = Date.now() - 72 * 60 * 60 * 1000;
  const orders = (await readCollection('orders'))
    .filter(order => order.status === 'Delivered'
      && order.whatsappUpdatesOptIn === true
      && Number.isFinite(Date.parse(String(order.deliveredAt || '')))
      && Date.parse(String(order.deliveredAt || '')) <= dueAt
      && record(order.whatsappReviewRequest).status !== 'sent')
    .slice(0, 100);
  const sent = await runBatches(orders, 8, async order => {
    const path = `orders/${order.id}`;
    if (!await claimDocumentField(path, 'whatsappReviewRequest', {
      status: 'sending', updatedAt: new Date().toISOString(),
    }, ['sent', 'sending'])) return false;
    try {
      await sendWhatsAppTemplate({
        token, phoneNumberId, to: phoneE164(order.phone), name: templateName, language,
        parameters: [String(order.fullName || 'Customer'), String(order.id || '')],
      });
      await writeDocument(path, {
        whatsappReviewRequest: { status: 'sent', sentAt: new Date().toISOString() },
      });
      return true;
    } catch (error) {
      await writeDocument(path, {
        whatsappReviewRequest: { status: 'failed', updatedAt: new Date().toISOString() },
      });
      console.error('[whatsapp] Review request failed.', error instanceof Error ? error.message : 'UnknownError');
      return false;
    }
  });
  return { processed: orders.length, sent };
}

async function handleWhatsAppWebhook(
  request: ApiRequest,
  response: ApiResponse,
  rawBody: Buffer,
  body: Record<string, unknown>,
) {
  const verifyToken = String(process.env.WHATSAPP_VERIFY_TOKEN || '').trim();
  if (request.method === 'GET') {
    if (!verifyToken) return response.status(503).send('WhatsApp webhook is not configured.');
    if (queryValue(request, 'hub.mode') === 'subscribe'
      && safeCompare(queryValue(request, 'hub.verify_token'), verifyToken)) {
      response.setHeader('content-type', 'text/plain; charset=utf-8');
      return response.status(200).send(queryValue(request, 'hub.challenge'));
    }
    return response.status(403).send('Forbidden.');
  }
  if (request.method !== 'POST') {
    response.setHeader('allow', 'GET, POST');
    return response.status(405).send('Method not allowed.');
  }

  const appSecret = String(process.env.WHATSAPP_APP_SECRET || '').trim();
  if (!appSecret) return response.status(503).send('WhatsApp webhook is not configured.');
  const supplied = headerValue(request, 'x-hub-signature-256');
  const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
  if (!safeCompare(supplied, expected)) return response.status(401).send('Invalid signature.');

  const token = String(process.env.WHATSAPP_ACCESS_TOKEN || '').trim();
  const settings = await loadGeneralSettings();
  const phoneNumberId = String(settings.codWhatsAppPhoneNumberId || '').trim();
  if (!token || !phoneNumberId) return response.status(503).send('WhatsApp delivery is not configured.');
  const adminPhone = normalizeWhatsAppPhone(settings.whatsappAdminPhone);
  const entries = Array.isArray(body.entry) ? body.entry.map(record) : [];
  const messages = entries.flatMap(entry => (Array.isArray(entry.changes) ? entry.changes.map(record) : [])
    .flatMap(change => {
      const value = record(change.value);
      return Array.isArray(value.messages) ? value.messages.map(record) : [];
    }));
  let handled = 0;

  for (const message of messages.slice(0, 100)) {
    const from = normalizeWhatsAppPhone(message.from);
    const text = String(record(message.text).body || '').trim();
    if (!from || message.type !== 'text' || !text) continue;
    const phoneHash = createHash('sha256').update(from).digest('hex');
    try {
      await consumeRateLimit(`whatsapp-inbound:${phoneHash}`, 20, 60);
    } catch {
      continue;
    }

    if (adminPhone && from === adminPhone) {
      const command = text.match(/^(CONFIRM|SHIP)\s+([A-Za-z0-9_-]{1,80})$/i);
      if (!command) continue;
      const orderId = command[2];
      const orderPath = `orders/${orderId}`;
      const order = await readDocument(orderPath);
      let reply = 'Order not found.';
      if (order) {
        const action = command[1].toUpperCase();
        if (action === 'CONFIRM' && order.paymentMethod === 'COD' && order.status === 'Pending') {
          await writeDocument(orderPath, { ...order, status: 'Confirmed by Call', whatsappCommandAt: new Date().toISOString() }, false);
          reply = `Order ${orderId} confirmed.`;
        } else if (action === 'SHIP'
          && ['Pending', 'Processing'].includes(String(order.status))
          && (order.paymentMethod === 'COD' || order.paymentVerified === true)) {
          const updated = { ...order, status: 'Shipped', whatsappCommandAt: new Date().toISOString() };
          await writeDocument(orderPath, updated, false);
          await notifyWhatsAppOrderStatus(updated, 'Shipped');
          reply = `Order ${orderId} marked shipped.`;
        } else {
          reply = action === 'CONFIRM'
            ? 'Only pending cash-on-delivery orders can be confirmed.'
            : 'Only pending or processing orders with verified payment can be shipped.';
        }
      }
      try { await sendWhatsAppText({ token, phoneNumberId, to: from, body: reply }); }
      catch (error) { console.error('[whatsapp] Admin command reply failed.', error instanceof Error ? error.message : 'UnknownError'); }
      handled += 1;
      continue;
    }

    let reply = 'I can help with product prices, stock, and recent order status. Try “price [product]”, “stock [product]”, or “order status”.';
    const lower = text.toLowerCase();
    if (/order|tracking|delivery|status/.test(lower)) {
      const orders = await readCollection('orders');
      const own = orders
        .filter(order => normalizeWhatsAppPhone(order.phone) === from)
        .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
      reply = own
        ? `Your latest order ${own.id} is ${own.status}.${own.trackingNumber ? ` Tracking: ${own.trackingNumber}.` : ''}${own.trackingUrl ? ` ${own.trackingUrl}` : ''}`
        : 'I could not find an order for this WhatsApp number. Please contact the store with your order number.';
    } else if (/price|stock|available|cost/.test(lower)) {
      const query = text.replace(/^(price|stock|available|cost)\s*/i, '').trim().toLowerCase();
      if (!query) {
        reply = 'Please include a product name, for example “price face serum”.';
      } else {
        const products = await readCollection('products');
        const matches = products.filter(product => String(product.name || '').toLowerCase().includes(query)).slice(0, 3);
        reply = matches.length
          ? matches.map(product => `${product.name}: Rs ${Number(product.price || 0).toLocaleString('en-PK')}; ${product.inStock === false || Number(product.stock) === 0 ? 'currently out of stock' : 'in stock'}.`).join('\n')
          : 'I could not find that product. Please check the name or contact the store.';
      }
    }
    try { await sendWhatsAppText({ token, phoneNumberId, to: from, body: reply }); }
    catch (error) { console.error('[whatsapp] FAQ reply failed.', error instanceof Error ? error.message : 'UnknownError'); }
    handled += 1;
  }
  return response.status(200).json({ received: true, handled });
}

async function handleVoiceCallWebhook(
  request: ApiRequest,
  response: ApiResponse,
  rawBody: Buffer,
  body: Record<string, unknown>,
) {
  if (request.method !== 'POST') {
    response.setHeader('allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }
  const orderId = queryValue(request, 'orderId');
  const nonce = queryValue(request, 'nonce');
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(orderId) || !/^[a-f0-9]{64}$/.test(nonce)) {
    return response.status(400).send('Invalid callback.');
  }
  const settings = await readDocument('voiceSettings/config') || {};
  const provider = String(settings.provider || '');
  if (!['twilio', 'custom-webhook'].includes(provider)) return response.status(403).send('Provider callback disabled.');

  let validSignature = false;
  if (provider === 'twilio') {
    const token = String(process.env.TWILIO_AUTH_TOKEN || '').trim();
    const base = publicSiteUrl();
    const pathAndQuery = String(request.url || '/api/store/voiceCallWebhook');
    const callbackUrl = `${base}${pathAndQuery.startsWith('/') ? pathAndQuery : `/${pathAndQuery}`}`;
    const parameters = Object.keys(body).sort().map(key => `${key}${String(body[key])}`).join('');
    const expected = createHmac('sha1', token).update(`${callbackUrl}${parameters}`).digest('base64');
    validSignature = Boolean(token && safeCompare(headerValue(request, 'x-twilio-signature'), expected));
  } else {
    const key = String(process.env.VOICE_GATEWAY_API_KEY || '').trim();
    const supplied = headerValue(request, 'x-nura-signature').replace(/^sha256=/i, '');
    const expected = key ? createHmac('sha256', key).update(rawBody).digest('hex') : '';
    validSignature = Boolean(key && safeCompare(supplied, expected));
  }
  if (!validSignature) return response.status(403).send('Invalid signature.');

  const digit = String(body.Digits || body.digit || '');
  let result = 'pending';
  if (digit === '1' || digit === '2') {
    result = String(await supabaseRequest('/rest/v1/rpc/process_voice_call_response', {
      method: 'POST',
      body: {
        p_order_id: orderId,
        p_nonce_hash: createHash('sha256').update(nonce).digest('hex'),
        p_digit: digit,
      },
    }));
  }
  if (result === 'cancelled') {
    const order = await readDocument(`orders/${orderId}`);
    if (order) await sendAutomatedEmail('cancellation', order.email, orderEmailValues(order));
  }
  const responseText = result === 'confirmed'
    ? 'Your order is confirmed. Thank you.'
    : result === 'cancelled'
      ? 'Your order has been cancelled.'
      : result === 'pending'
        ? 'No response was recorded. Goodbye.'
        : 'This response was already processed.';
  const escapeXml = (value: string) => value.replace(/[<>&"']/g, char => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;',
  })[char] || char);
  response.setHeader('content-type', 'text/xml; charset=utf-8');
  return response.status(200).send(`<Response><Say>${escapeXml(responseText)}</Say><Hangup/></Response>`);
}

async function runStoreCron(action: string, request: ApiRequest) {
  const expected = String(process.env.CRON_SECRET || '').trim();
  if (!expected) throw Object.assign(new Error('The CRON_SECRET server environment variable is required for scheduled jobs.'), { status: 503 });
  if (!safeCompare(bearerToken(request), expected)) throw Object.assign(new Error('Scheduled job authorization failed.'), { status: 401 });
  if (action === 'sendAbandonedCheckoutEmails') return await runAbandonedCheckoutEmails();
  if (action === 'sendAbandonedCheckoutWhatsApp') return await runAbandonedCheckoutWhatsApp();
  if (action === 'sendWhatsAppReviewRequests') return await runWhatsAppReviewRequests();
  throw Object.assign(new Error('Scheduled operation is not configured.'), { status: 404 });
}

async function sendMarketingCampaign(input: Record<string, unknown>, user: SupabaseUser) {
  await requireAdmin(user);
  if (!['newsletter', 'all-consented', 'past-buyers'].includes(String(input.audience))) {
    throw Object.assign(new Error('Choose a supported campaign audience.'), { status: 400 });
  }
   const [settings, generalSettings] = await Promise.all([loadEmailSettings(), loadGeneralSettings()]);
   const storeName = emailStoreName(generalSettings);
  const provider = emailProviderStatus(settings);
  if (settings.masterEnabled !== true) throw Object.assign(new Error('Enable email delivery in the store email settings before sending a campaign.'), { status: 409 });
  if (!provider.canSend) throw Object.assign(new Error(provider.detail), { status: 503 });
  const recipients = await campaignRecipients(input.audience);
  if (!recipients.length) throw Object.assign(new Error('No opted-in recipients were found for this audience.'), { status: 409 });
  if (recipients.length > 100) throw Object.assign(new Error('This campaign exceeds the 100-recipient per-send safety limit. Narrow the audience before sending.'), { status: 413 });
  const campaignId = crypto.randomUUID();
  const senderProfileId = safeText(input.senderProfileId || '', 120, false);
  const subjectTemplate = safeText(input.subject, 180);
  const bodyTemplate = safeText(input.body, 5000);
  const results: boolean[] = [];
  for (let offset = 0; offset < recipients.length; offset += 5) {
    const batch = recipients.slice(offset, offset + 5);
    const batchResults = await Promise.all(batch.map(async recipient => {
      const details = typeof recipient === 'string' ? { email: recipient, name: 'there' } : recipient;
      const values = {
        customer_name: details.name || 'there',
        promo_code: safeText(input.promoCode || '', 60, false),
        order_id: '',
        order_total: '',
        items_list: '',
        courier_name: '',
        tracking_number: '',
        tracking_url: '',
        store_name: storeName,
      };
      try {
        await deliverEmail(
          settings,
          senderProfileId,
          details.email,
          interpolateEmail(subjectTemplate, values),
          interpolateEmail(bodyTemplate, values),
        );
        return true;
      } catch {
        return false;
      }
    }));
    results.push(...batchResults);
  }
  const sentCount = results.filter(Boolean).length;
  const failedCount = results.length - sentCount;
  const status = failedCount === 0 ? 'sent' : sentCount === 0 ? 'failed' : 'partial';
  await writeDocument(`emailCampaigns/${campaignId}`, {
    id: campaignId,
    name: safeText(input.name || 'Email campaign', 100),
    subject: subjectTemplate,
    audience: safeText(input.audience, 40),
    status,
    recipientCount: recipients.length,
    sentCount,
    failedCount,
    createdAt: new Date().toISOString(),
    createdBy: user.id,
  }, false);
  return { campaignId, status, sentCount, failedCount, recipientCount: recipients.length };
}

async function sendOrderReceipt(order: Record<string, unknown>) {
  const [settings, generalSettings] = await Promise.all([loadEmailSettings(), loadGeneralSettings()]);
  const storeName = emailStoreName(generalSettings);
  const triggers = record(settings.triggers);
  const receipt = record(triggers.orderReceipt);
  if (settings.masterEnabled !== true || receipt.enabled !== true || !emailProviderStatus(settings).canSend) return;
  const templates = record(settings.templates);
  const template = record(templates.orderReceipt);
  const items = Array.isArray(order.items) ? order.items.map(record) : [];
  const values = {
    customer_name: String(order.fullName || 'there'),
    order_id: String(order.id || ''),
    order_total: String(order.grandTotal ?? ''),
    items_list: items.map(item => `${String(record(item.product).name || 'Item')} × ${String(item.quantity || 1)}`).join('\n'),
    courier_name: '',
    tracking_number: '',
    tracking_url: '',
    store_name: storeName,
  };
  await deliverEmail(
    settings,
    String(receipt.senderProfileId || ''),
    order.email,
    interpolateEmail(template.subject, values),
    interpolateEmail(template.body, values),
  );
}

async function replyToInbox(input: Record<string, unknown>, user: SupabaseUser) {
  await requireAdmin(user);
  const messageId = safeText(input.messageId, 100);
  const path = `inbox/${messageId}`;
  const message = await readDocument(path);
  if (!message) throw Object.assign(new Error('The contact message was not found.'), { status: 404 });
  const body = safeText(input.body, 4000);
  const subject = safeText(input.subject, 180);
  const settings = await loadEmailSettings();
  const delivery = await deliverEmail(settings, safeText(input.senderProfileId, 120, false), message.email, subject, body);
  const replies = Array.isArray(message.replies) ? message.replies : [];
  const reply = {
    id: crypto.randomUUID(),
    subject,
    body,
    senderProfileId: safeText(input.senderProfileId, 120, false),
    senderEmail: user.email || '',
    sentAt: new Date().toISOString(),
    status: 'sent',
    provider: delivery.provider,
    providerMessageId: delivery.messageId,
  };
  await writeDocument(path, {
    ...message,
    replies: [...replies, reply].slice(-20),
    status: 'replied',
    repliedAt: reply.sentAt,
  }, false);
  return { success: true, sent: true, replyId: reply.id };
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('cache-control', 'no-store');
  response.setHeader('x-content-type-options', 'nosniff');
  try {
    const action = queryValue(request, 'name');
    if (action === 'whatsappWebhook') {
      const raw = await rawRequestBody(request);
      const body = request.method === 'POST'
        ? parseRawPayload(raw, String(request.headers['content-type'] || ''))
        : {};
      return await handleWhatsAppWebhook(request, response, raw, body);
    }
    if (action === 'voiceCallWebhook') {
      const raw = await rawRequestBody(request);
      const body = parseRawPayload(raw, String(request.headers['content-type'] || ''));
      return await handleVoiceCallWebhook(request, response, raw, body);
    }
    if (request.method === 'GET' && [
      'sendAbandonedCheckoutEmails',
      'sendAbandonedCheckoutWhatsApp',
      'sendWhatsAppReviewRequests',
    ].includes(action)) {
      const result = await runStoreCron(action, request);
      return response.status(200).json({ data: result });
    }
    if (request.method !== 'POST') {
      response.setHeader('allow', 'POST');
      return response.status(405).json({ error: 'Method not allowed.' });
    }
    const input = await parseRequestBody(request);
    let result: unknown;

    if (action === 'sendContactMessage' || action === 'subscribeNewsletter') {
      result = await submitPublicMessage(action, input, request);
    } else if (action === 'bootstrapInitialAdministrator') {
      result = await bootstrapInitialAdministrator(await requireUser(request));
    } else if (action === 'placeOrder') {
      const user = await requireUser(request);
      await consumeRateLimit(`place-order:${user.id}`, 10, 60);
      const order = await buildOrder(input, user);
      result = await supabaseRequest('/rest/v1/rpc/place_store_order', {
        method: 'POST',
        body: { p_user_id: user.id, p_order: order },
      });
      if (result && typeof result === 'object') {
        const rpcOrder = result as Record<string, unknown>;
        const created = rpcOrder._created === true;
        const createdOrder = { ...rpcOrder };
        delete createdOrder._created;
        result = createdOrder;
        if (created) {
          await writeDocument(`checkoutSessions/${user.id}`, {
            status: 'completed',
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
          try { await sendOrderReceipt(createdOrder); }
          catch (error) {
            console.error('[store-api] Order receipt delivery failed.', {
              message: error instanceof Error ? error.message : 'Unknown email provider error.',
            });
          }
          await Promise.allSettled([
            sendCodWhatsAppConfirmation(createdOrder),
            notifyAdminWhatsAppNewOrder(createdOrder),
          ]);
          if (createdOrder.paymentMethod === 'COD') {
            const voiceSettings = await readDocument('voiceSettings/config') || {};
            if (voiceSettings.enabled === true && voiceSettings.autoCallOnCod === true) {
              await dispatchVoiceCall(String(createdOrder.id || '')).catch(error => {
                console.error('[voice] Automatic COD confirmation call failed.', error instanceof Error ? error.message : 'UnknownError');
              });
            }
          }
        }
      }
    } else if (action === 'cancelOrder' || action === 'adminUpdateOrder' || action === 'adminVerifyOrderPayment') {
      result = await updateOrderStatus(action, input, await requireUser(request));
    } else if (action === 'trackCheckoutSession' || action === 'clearCheckoutSession') {
      result = await saveCheckoutSession(input, await requireUser(request), action === 'clearCheckoutSession');
    } else if (action === 'adminListAdministrators') {
      await requireAdmin(await requireUser(request));
      result = await listAdministrators();
    } else if (action === 'adminGrantAdministrator') {
      result = await grantAdministrator(input, await requireUser(request));
    } else if (action === 'adminRevokeAdministrator') {
      result = await revokeAdministrator(input, await requireUser(request));
    } else if (action === 'adminReplyToInbox') {
      result = await replyToInbox(input, await requireUser(request));
    } else if (action === 'adminCheckVoiceBalance') {
      await requireAdmin(await requireUser(request));
      result = await checkVoiceBalance();
    } else if (action === 'adminRefreshVoiceCallResult') {
      await requireAdmin(await requireUser(request));
      result = await refreshVoiceCallResult(safeText(input.orderId, 80));
    } else if (action === 'adminSendVoiceConfirmationCall') {
      await requireAdmin(await requireUser(request));
      result = await dispatchVoiceCall(safeText(input.orderId, 80));
    } else if (action === 'sendWhatsAppMarketingCampaign') {
      result = await sendWhatsAppMarketingCampaign(input, await requireUser(request));
    } else if (action === 'sendTestEmail') {
      result = await sendTestEmail(input, await requireUser(request));
    } else if (action === 'sendMarketingCampaign') {
      result = await sendMarketingCampaign(input, await requireUser(request));
    } else if (action === 'getEmailProviderStatus') {
      await requireAdmin(await requireUser(request));
      result = emailProviderStatus(await loadEmailSettings());
    } else {
      throw Object.assign(new Error(`The ${action || 'requested'} operation is not configured on this template.`), { status: 501 });
    }

    return response.status(200).json({ data: result });
  } catch (error) {
    const status = error && typeof error === 'object' && 'status' in error
      ? Number((error as { status: unknown }).status) || 500
      : 500;
    const message = error instanceof Error ? error.message : 'The request could not be completed.';
    if (status >= 500) console.error('[store-api] Request failed.', { status, message });
    return response.status(status).json({ error: message });
  }
}

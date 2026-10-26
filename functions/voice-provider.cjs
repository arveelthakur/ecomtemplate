const { URL } = require('node:url');

function publicHttpsEndpoint(value) {
  let url;
  try { url = new URL(String(value || '')); } catch { return ''; }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password
    || host === 'localhost' || host === 'metadata.google'
    || host === '::1' || host.startsWith('127.') || host.startsWith('10.')
    || host.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    || host.startsWith('169.254.') || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:')) return '';
  return url.toString();
}

async function requestVoiceApi({ endpoint, username = '', password = '', token = '', method = 'POST', body, fetchImpl = globalThis.fetch }) {
  const url = publicHttpsEndpoint(endpoint);
  if (!url || (!token && !(username && password)) || typeof fetchImpl !== 'function') return { configured: false, status: 0, data: null };
  const authorization = token
    ? `Bearer ${token}`
    : `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
  const response = await fetchImpl(url, {
    method,
    headers: { Authorization: authorization, 'Content-Type': 'application/json', Accept: 'application/json' },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body || {}) }),
    signal: AbortSignal.timeout(15000),
  });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { message: raw.slice(0, 500) }; }
  if (!response.ok) throw new Error(`Voice provider returned HTTP ${response.status}.`);
  return { configured: true, status: response.status, data };
}

function firstValue(payload, candidates) {
  const queue = [payload];
  let depth = 0;
  while (queue.length && depth++ < 5) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;
    for (const [key, value] of Object.entries(current)) {
      if (candidates.includes(key.toLowerCase()) && value != null && value !== '') return value;
      if (value && typeof value === 'object') queue.push(value);
    }
  }
  return null;
}

function parseCallResult(payload) {
  const status = firstValue(payload, ['status', 'call_status', 'callstatus']);
  const callId = firstValue(payload, ['call_id', 'callid', 'callsid', 'sid', 'id']);
  const duration = firstValue(payload, ['duration', 'duration_seconds', 'callduration']);
  const response = firstValue(payload, ['user_response', 'userresponse', 'key_press', 'keypress', 'digit', 'dtmf', 'response']);
  const normalized = String(status || '').toLowerCase();
  const key = String(response ?? '').trim();
  const outcome = ['confirmed', 'answered', 'completed'].includes(normalized) && key === '1' ? 'confirmed'
    : ['cancelled', 'canceled'].includes(normalized) || key === '2' ? 'cancelled'
      : ['failed', 'busy', 'no-answer', 'unanswered', 'rejected'].includes(normalized) ? 'failed'
        : 'in-progress';
  const numericDuration = Number(duration);
  return {
    status: outcome,
    providerStatus: String(status || '').slice(0, 80),
    callId: callId == null ? '' : String(callId).slice(0, 160),
    duration: Number.isFinite(numericDuration) && numericDuration >= 0 ? Math.min(numericDuration, 86400) : null,
    userResponse: key.slice(0, 32),
  };
}

function parseBalance(payload) {
  const value = firstValue(payload, ['balance', 'available_balance', 'availablebalance', 'credits', 'remaining']);
  if (value == null || value === '') return { available: false, balance: null, currency: '' };
  const numeric = Number(value);
  return Number.isFinite(numeric) ? { available: true, balance: numeric, currency: String(firstValue(payload, ['currency', 'currency_code']) || '').slice(0, 12) } : { available: false, balance: null, currency: '' };
}

module.exports = { publicHttpsEndpoint, requestVoiceApi, parseCallResult, parseBalance };

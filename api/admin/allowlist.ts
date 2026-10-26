type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

type SupabaseUser = {
  id: string;
  email?: string;
};

type AllowlistEntry = {
  user_id: string;
  email: string;
  created_at?: string | null;
};

type RequestEnvironment = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
  initialAdminEmail: string;
};

class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readEnvironment(): RequestEnvironment {
  return {
    url: (process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    initialAdminEmail: (process.env.SUPABASE_INITIAL_ADMIN_EMAIL || '').trim().toLowerCase(),
  };
}

function getBearerToken(request: ApiRequest) {
  const raw = request.headers.authorization || request.headers.Authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' ? value.match(/^Bearer\s+(.+)$/i)?.[1] || '' : '';
}

function parseBody(body: unknown): Record<string, unknown> {
  if (typeof body === 'string') {
    if (body.length > 5000) throw new ApiError('Request body is too large.', 413);
    try {
      const parsed = JSON.parse(body);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
      throw new ApiError('Request body must be valid JSON.', 400);
    }
  }
  return body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};
}

async function supabaseRest<T>(
  environment: RequestEnvironment,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${environment.url}${path}`, {
    ...init,
    headers: {
      apikey: environment.serviceRoleKey,
      authorization: `Bearer ${environment.serviceRoleKey}`,
      'content-type': 'application/json',
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) {
    console.error('[admin-allowlist] Supabase request failed.', { status: response.status });
    throw new ApiError('The administrator roster could not be updated in Supabase.', 502);
  }
  if (response.status === 204) return null as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : null) as T;
}

async function authenticate(request: ApiRequest, environment: RequestEnvironment): Promise<SupabaseUser> {
  const token = getBearerToken(request);
  if (!token) throw new ApiError('Sign in to manage administrator access.', 401);
  const response = await fetch(`${environment.url}/auth/v1/user`, {
    headers: { apikey: environment.anonKey, authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new ApiError('Your session is invalid or expired. Sign in again.', 401);
  const user = await response.json() as Partial<SupabaseUser>;
  if (typeof user.id !== 'string' || !uuidPattern.test(user.id)) {
    throw new ApiError('Supabase did not return a valid signed-in user.', 401);
  }
  return { id: user.id, email: typeof user.email === 'string' ? user.email.trim().toLowerCase() : '' };
}

function isInitialAdministrator(user: SupabaseUser, environment: RequestEnvironment) {
  return Boolean(environment.initialAdminEmail) && user.email === environment.initialAdminEmail;
}

async function isAllowlisted(environment: RequestEnvironment, user: SupabaseUser) {
  const params = new URLSearchParams({
    select: 'user_id',
    user_id: `eq.${user.id}`,
    limit: '1',
  });
  const entries = await supabaseRest<AllowlistEntry[]>(
    environment,
    `/rest/v1/admin_allowlist?${params}`,
  );
  return Array.isArray(entries) && entries.some(entry => entry.user_id === user.id);
}

async function findUserByEmail(environment: RequestEnvironment, email: string): Promise<SupabaseUser | null> {
  for (let page = 1; page <= 20; page += 1) {
    const params = new URLSearchParams({ page: String(page), per_page: '100' });
    const response = await fetch(`${environment.url}/auth/v1/admin/users?${params}`, {
      headers: {
        apikey: environment.serviceRoleKey,
        authorization: `Bearer ${environment.serviceRoleKey}`,
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      console.error('[admin-allowlist] Supabase Auth lookup failed.', { status: response.status });
      throw new ApiError('Could not find that Supabase Auth account.', 502);
    }
    const payload = await response.json() as { users?: SupabaseUser[] };
    const users = Array.isArray(payload.users) ? payload.users : [];
    const match = users.find(user => user.email?.trim().toLowerCase() === email);
    if (match) return match;
    if (users.length < 100) return null;
  }
  return null;
}

async function findAllowlistEntry(
  environment: RequestEnvironment,
  filter: { user_id?: string; email?: string },
): Promise<AllowlistEntry | null> {
  const params = new URLSearchParams({ select: 'user_id,email,created_at', limit: '1' });
  if (filter.user_id) params.set('user_id', `eq.${filter.user_id}`);
  if (filter.email) params.set('email', `eq.${filter.email}`);
  const entries = await supabaseRest<AllowlistEntry[]>(
    environment,
    `/rest/v1/admin_allowlist?${params}`,
  );
  return Array.isArray(entries) ? entries[0] || null : null;
}

async function recordAudit(
  environment: RequestEnvironment,
  action: 'grant' | 'revoke',
  actor: SupabaseUser,
  target: { id: string; email: string },
) {
  try {
    await supabaseRest(environment, '/rest/v1/admin_audit_log', {
      method: 'POST',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({
        id: globalThis.crypto.randomUUID(),
        action,
        actor_uid: actor.id,
        actor_email: actor.email || '',
        target_uid: target.id,
        target_email: target.email,
        created_at: new Date().toISOString(),
      }),
    });
  } catch {
    // Roster changes must not be reported as failed if optional audit logging
    // is temporarily unavailable after the allowlist write has succeeded.
    console.error('[admin-allowlist] Audit entry could not be recorded.');
  }
}

async function listAdministrators(environment: RequestEnvironment) {
  const entries = await supabaseRest<AllowlistEntry[]>(
    environment,
    '/rest/v1/admin_allowlist?select=user_id,email,created_at&order=email.asc',
  );
  const rows = Array.isArray(entries) ? entries : [];
  const ids = rows.map(row => row.user_id).filter(id => uuidPattern.test(id));
  let profileRows: Array<{ id: string; display_name: string }> = [];
  if (ids.length) {
    const profileParams = new URLSearchParams({
      select: 'id,display_name',
      id: `in.(${ids.join(',')})`,
    });
    const result = await supabaseRest<typeof profileRows>(
      environment,
      `/rest/v1/profiles?${profileParams}`,
    );
    profileRows = Array.isArray(result) ? result : [];
  }
  const displayNames = new Map(profileRows.map(profile => [profile.id, profile.display_name || '']));
  const auditParams = new URLSearchParams({
    select: 'id,action,actor_uid,actor_email,target_uid,target_email,created_at',
    order: 'created_at.desc',
    limit: '50',
  });
  const auditRows = await supabaseRest<Array<Record<string, unknown>>>(
    environment,
    `/rest/v1/admin_audit_log?${auditParams}`,
  );

  return {
    administrators: rows.map(row => ({
      uid: row.user_id,
      email: row.email,
      displayName: displayNames.get(row.user_id) || '',
      createdAt: row.created_at || null,
    })),
    auditEvents: (Array.isArray(auditRows) ? auditRows : []).map(event => ({
      id: String(event.id || ''),
      action: event.action === 'revoke' ? 'revoke' : 'grant',
      actorUid: String(event.actor_uid || ''),
      actorEmail: String(event.actor_email || ''),
      targetUid: String(event.target_uid || ''),
      targetEmail: String(event.target_email || ''),
      targetDisplayName: displayNames.get(String(event.target_uid || '')) || '',
      createdAt: typeof event.created_at === 'string' ? event.created_at : null,
    })),
    allowlistedEmails: rows.map(row => row.email),
  };
}

async function grantAdministrator(
  environment: RequestEnvironment,
  actor: SupabaseUser,
  body: Record<string, unknown>,
) {
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError('Enter a valid email address.', 400);
  }
  const target = await findUserByEmail(environment, email);
  if (!target) throw new ApiError('That email does not belong to an existing Supabase Auth account.', 404);
  if (!uuidPattern.test(target.id)) throw new ApiError('Supabase returned an invalid account ID.', 502);

  // admin_allowlist.user_id references profiles.id. Create/update the profile
  // first; table defaults preserve all other customer profile fields.
  await supabaseRest(environment, '/rest/v1/profiles?on_conflict=id', {
    method: 'POST',
    headers: { prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ id: target.id, email }),
  });

  const byId = await findAllowlistEntry(environment, { user_id: target.id });
  if (byId?.email === email) {
    return { changed: false, uid: target.id, email };
  }
  const byEmail = byId ? null : await findAllowlistEntry(environment, { email });
  const updatedBy = { updated_by: actor.id, email };
  if (byId) {
    const params = new URLSearchParams({ user_id: `eq.${target.id}` });
    await supabaseRest(environment, `/rest/v1/admin_allowlist?${params}`, {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify(updatedBy),
    });
  } else if (byEmail) {
    const params = new URLSearchParams({ user_id: `eq.${byEmail.user_id}` });
    await supabaseRest(environment, `/rest/v1/admin_allowlist?${params}`, {
      method: 'PATCH',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: target.id, ...updatedBy }),
    });
  } else {
    await supabaseRest(environment, '/rest/v1/admin_allowlist', {
      method: 'POST',
      headers: { prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: target.id, ...updatedBy }),
    });
  }
  await recordAudit(environment, 'grant', actor, { id: target.id, email });
  return { changed: true, uid: target.id, email };
}

async function revokeAdministrator(
  environment: RequestEnvironment,
  actor: SupabaseUser,
  body: Record<string, unknown>,
) {
  const uid = typeof body.uid === 'string' ? body.uid.trim() : '';
  if (!uuidPattern.test(uid)) throw new ApiError('A valid Supabase user UUID is required.', 400);
  if (uid === actor.id) throw new ApiError('The initial administrator cannot revoke their own access.', 400);
  const entry = await findAllowlistEntry(environment, { user_id: uid });
  if (!entry) return { changed: false, uid, email: '' };
  const params = new URLSearchParams({ user_id: `eq.${uid}` });
  await supabaseRest(environment, `/rest/v1/admin_allowlist?${params}`, {
    method: 'DELETE',
    headers: { prefer: 'return=minimal' },
  });
  await recordAudit(environment, 'revoke', actor, { id: uid, email: entry.email });
  return { changed: true, uid, email: entry.email };
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('cache-control', 'no-store');
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('content-type', 'application/json; charset=utf-8');
  if (!['GET', 'POST', 'DELETE'].includes(request.method || '')) {
    response.setHeader('allow', 'GET, POST, DELETE');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  try {
    const environment = readEnvironment();
    if (!environment.url || !environment.anonKey || !environment.serviceRoleKey || !environment.initialAdminEmail) {
      throw new ApiError('Administrator access is not configured on the server.', 503);
    }
    const actor = await authenticate(request, environment);
    const isInitialAdmin = isInitialAdministrator(actor, environment);

    if (request.method === 'GET') {
      if (!isInitialAdmin && !(await isAllowlisted(environment, actor))) {
        throw new ApiError('Administrator access is required.', 403);
      }
      return response.status(200).json({ data: await listAdministrators(environment) });
    }

    if (!isInitialAdmin) {
      throw new ApiError('Only the configured initial administrator can change the administrator roster.', 403);
    }

    const body = parseBody(request.body);
    const data = request.method === 'POST'
      ? await grantAdministrator(environment, actor, body)
      : await revokeAdministrator(environment, actor, body);
    return response.status(200).json({ data });
  } catch (failure) {
    const status = failure instanceof ApiError ? failure.status : 502;
    if (!(failure instanceof ApiError)) {
      console.error('[admin-allowlist] Request could not be completed.');
    }
    const message = failure instanceof Error ? failure.message : 'The administrator request could not be completed.';
    return response.status(status).json({ error: message });
  }
}

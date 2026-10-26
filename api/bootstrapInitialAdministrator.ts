type ApiRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type ApiResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ApiResponse;
  json: (body: unknown) => void;
};

type AuthenticatedUser = {
  id?: string;
  email?: string;
};

function bearerToken(request: ApiRequest) {
  const raw = request.headers.authorization || request.headers.Authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  const match = typeof value === 'string' ? value.match(/^Bearer\s+(.+)$/i) : null;
  return match?.[1] || '';
}

function serverEnvironment() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const initialAdminEmail = (process.env.SUPABASE_INITIAL_ADMIN_EMAIL || '').trim().toLowerCase();
  return { url, anonKey, serviceRoleKey, initialAdminEmail };
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('cache-control', 'no-store');
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('content-type', 'application/json; charset=utf-8');

  if (request.method !== 'POST') {
    response.setHeader('allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }

  const token = bearerToken(request);
  if (!token) return response.status(401).json({ error: 'Sign in to continue.' });

  const { url, anonKey, serviceRoleKey, initialAdminEmail } = serverEnvironment();
  if (!url || !anonKey || !serviceRoleKey || !initialAdminEmail) {
    return response.status(503).json({ error: 'Initial administrator setup is not configured on the server.' });
  }

  try {
    const authResponse = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anonKey, authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!authResponse.ok) return response.status(401).json({ error: 'Your session is invalid or expired. Sign in again.' });
    const user = await authResponse.json() as AuthenticatedUser;
    const userId = typeof user.id === 'string' ? user.id : '';
    const userEmail = typeof user.email === 'string' ? user.email.trim().toLowerCase() : '';
    if (!userId || !userEmail) {
      return response.status(401).json({ error: 'Supabase did not return an authenticated email account.' });
    }
    if (userEmail !== initialAdminEmail) {
      return response.status(403).json({ error: 'This account is not configured as the initial administrator.' });
    }

    const headers = {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
      prefer: 'resolution=merge-duplicates,return=minimal',
    };
    const profileResponse = await fetch(`${url}/rest/v1/profiles?on_conflict=id`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: userId, email: userEmail }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!profileResponse.ok) {
      return response.status(502).json({ error: 'Could not prepare the administrator profile in Supabase.' });
    }

    const allowlistResponse = await fetch(`${url}/rest/v1/admin_allowlist?on_conflict=user_id`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ user_id: userId, email: userEmail }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!allowlistResponse.ok) {
      return response.status(502).json({ error: 'Could not add the initial administrator to the Supabase allowlist.' });
    }

    return response.status(200).json({ ready: true });
  } catch {
    return response.status(502).json({ error: 'Initial administrator setup could not reach Supabase. Try again shortly.' });
  }
}

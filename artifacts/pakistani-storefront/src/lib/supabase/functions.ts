import { requireSupabase, supabase } from './client';

export const functions = supabase;

export function httpsCallable<TRequest = unknown, TResponse = unknown>(
  _functions: typeof functions,
  functionName: string,
) {
  return async (payload?: TRequest): Promise<{ data: TResponse }> => {
    const client = requireSupabase();
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if (sessionError) throw sessionError;
    const administratorAction = functionName === 'adminListAdministrators'
      || functionName === 'adminGrantAdministrator'
      || functionName === 'adminRevokeAdministrator';
    const method = functionName === 'adminListAdministrators'
      ? 'GET'
      : functionName === 'adminRevokeAdministrator'
        ? 'DELETE'
        : 'POST';
    const response = await fetch(
      administratorAction ? '/api/admin/allowlist' : `/api/store/${encodeURIComponent(functionName)}`,
      {
      method,
      headers: {
        'content-type': 'application/json',
        ...(sessionData.session?.access_token
          ? { authorization: `Bearer ${sessionData.session.access_token}` }
          : {}),
      },
      ...(method === 'GET' ? {} : { body: JSON.stringify(payload ?? {}) }),
      },
    );
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(typeof result?.error === 'string' ? result.error : `Store API request failed (${response.status}).`);
      Object.assign(error, { status: response.status, code: result?.code });
      throw error;
    }
    return { data: (result && 'data' in result ? result.data : result) as TResponse };
  };
}

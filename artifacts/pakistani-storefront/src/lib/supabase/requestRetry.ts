type SupabaseErrorLike = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
  statusCode?: unknown;
};

type SupabaseResultLike = { error?: unknown };

type RetryOptions = {
  maxAttempts?: number;
  baseDelayMs?: number;
  wait?: (milliseconds: number) => Promise<void>;
  refreshSession?: () => Promise<void>;
};

function errorDetails(error: unknown) {
  if (error && typeof error === 'object') {
    const item = error as SupabaseErrorLike;
    const status = Number(item.status ?? item.statusCode);
    return {
      message: error instanceof Error
        ? error.message
        : typeof item.message === 'string' ? item.message : '',
      code: typeof item.code === 'string' ? item.code : '',
      status: Number.isFinite(status) ? status : undefined,
    };
  }
  return { message: String(error ?? ''), code: '', status: undefined };
}

export function isExpiredSupabaseSessionError(error: unknown) {
  const details = errorDetails(error);
  return details.status === 401
    || details.code === 'PGRST301'
    || /jwt (?:is )?expired|expired access token|invalid jwt|token expired/i.test(details.message);
}

export function isTransientSupabaseError(error: unknown) {
  const details = errorDetails(error);
  return details.status === 408
    || details.status === 425
    || details.status === 429
    || (details.status !== undefined && details.status >= 500)
    || error instanceof TypeError
    || /network error|fetch failed|connection (?:reset|closed|lost)|timed? ?out|temporarily unavailable/i.test(details.message)
    || ['ECONNRESET', 'ETIMEDOUT', 'FETCH_ERROR', 'UND_ERR_CONNECT_TIMEOUT'].includes(details.code);
}

/**
 * Retries only idempotent Supabase reads and document-batch writes. A possibly
 * expired access token gets one refresh attempt; transient network, throttling,
 * and server errors receive bounded exponential backoff. Permission/validation
 * errors are returned immediately instead of creating a retry loop.
 */
export async function withSupabaseRequestRetry<T extends SupabaseResultLike>(
  operation: () => PromiseLike<T>,
  options: RetryOptions = {},
): Promise<T> {
  const maxAttempts = Math.max(1, Math.min(4, Math.trunc(options.maxAttempts ?? 3)));
  const baseDelayMs = Math.max(0, Math.min(2_000, Math.trunc(options.baseDelayMs ?? 250)));
  const wait = options.wait ?? (milliseconds => new Promise<void>(resolve => setTimeout(resolve, milliseconds)));
  let refreshedSession = false;
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const result = await operation();
      if (!result.error) return result;
      throw result.error;
    } catch (error) {
      if (isExpiredSupabaseSessionError(error) && !refreshedSession && options.refreshSession) {
        refreshedSession = true;
        try {
          await options.refreshSession();
          continue;
        } catch {
          throw error;
        }
      }
      if (!isTransientSupabaseError(error) || attempt >= maxAttempts) throw error;
      await wait(baseDelayMs * 2 ** (attempt - 1));
    }
  }

  throw new Error('Supabase request did not complete.');
}

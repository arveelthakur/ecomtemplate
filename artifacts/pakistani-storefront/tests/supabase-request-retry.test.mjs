import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isExpiredSupabaseSessionError,
  isTransientSupabaseError,
  withSupabaseRequestRetry,
} from '../src/lib/supabase/requestRetry.ts';

const noWait = async () => {};

test('retries transient Supabase errors with bounded attempts then succeeds', async () => {
  let attempts = 0;
  const result = await withSupabaseRequestRetry(async () => {
    attempts += 1;
    return attempts < 3 ? { data: null, error: { status: 503, message: 'upstream unavailable' } } : { data: 'saved', error: null };
  }, { wait: noWait });

  assert.equal(result.data, 'saved');
  assert.equal(attempts, 3);
});

test('refreshes an expired session once before retrying a request', async () => {
  let attempts = 0;
  let refreshes = 0;
  const result = await withSupabaseRequestRetry(async () => {
    attempts += 1;
    return attempts === 1 ? { data: null, error: { status: 401, message: 'JWT expired' } } : { data: 'ok', error: null };
  }, {
    refreshSession: async () => { refreshes += 1; },
    wait: noWait,
  });

  assert.equal(result.data, 'ok');
  assert.equal(attempts, 2);
  assert.equal(refreshes, 1);
});

test('does not retry permission and validation errors', async () => {
  let attempts = 0;
  await assert.rejects(
    withSupabaseRequestRetry(async () => {
      attempts += 1;
      return { data: null, error: { status: 403, message: 'row-level security policy' } };
    }, { wait: noWait }),
    error => error?.message === 'row-level security policy',
  );
  assert.equal(attempts, 1);
});

test('surfaces the original error when session refresh fails', async () => {
  const expired = { status: 401, message: 'JWT expired' };
  let attempts = 0;
  await assert.rejects(
    withSupabaseRequestRetry(async () => {
      attempts += 1;
      return { data: null, error: expired };
    }, {
      refreshSession: async () => { throw new Error('refresh failed'); },
      wait: noWait,
    }),
    error => error === expired,
  );
  assert.equal(attempts, 1);
});

test('classifies common retryable and non-retryable Supabase errors', () => {
  assert.equal(isExpiredSupabaseSessionError({ status: 401 }), true);
  assert.equal(isTransientSupabaseError({ status: 429 }), true);
  assert.equal(isTransientSupabaseError(new TypeError('Failed to fetch')), true);
  assert.equal(isTransientSupabaseError({ status: 403, message: 'Forbidden' }), false);
});

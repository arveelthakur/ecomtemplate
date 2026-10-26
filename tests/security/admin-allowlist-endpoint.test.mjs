import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../../api/admin/allowlist.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { default: handler } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);

const envKeys = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_INITIAL_ADMIN_EMAIL'];
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const originalFetch = globalThis.fetch;
const actorId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';

function setupEnvironment() {
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.SUPABASE_INITIAL_ADMIN_EMAIL = 'admin@nura.pk';
}

function responseMock() {
  return {
    code: 200,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.code = code; return this; },
    json(body) { this.body = body; },
  };
}

test('allowlist endpoint rejects requests without a Supabase session', async () => {
  setupEnvironment();
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error('must not be called'); };
  const response = responseMock();

  await handler({ method: 'POST', headers: {}, body: { email: 'team@example.com' } }, response);

  assert.equal(response.code, 401);
  assert.equal(calls, 0);
});

test('grant resolves the existing Supabase Auth user and inserts its UUID and email', async () => {
  setupEnvironment();
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    const request = { url: String(url), options };
    calls.push(request);
    if (request.url.endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: actorId, email: 'admin@nura.pk' }), { status: 200 });
    }
    if (request.url.includes('/auth/v1/admin/users?')) {
      return new Response(JSON.stringify({ users: [{ id: targetId, email: 'team@example.com' }] }), { status: 200 });
    }
    if (request.url.includes('/rest/v1/admin_allowlist?')) {
      return new Response('[]', { status: 200 });
    }
    return new Response(null, { status: 204 });
  };
  const response = responseMock();

  await handler({
    method: 'POST',
    headers: { authorization: 'Bearer signed-in-super-admin-token' },
    body: { email: ' Team@Example.com ' },
  }, response);

  assert.equal(response.code, 200);
  assert.deepEqual(response.body, { data: { changed: true, uid: targetId, email: 'team@example.com' } });
  const profileWrite = calls.find(call => call.url.includes('/rest/v1/profiles?on_conflict=id'));
  assert.ok(profileWrite, 'profile is created first to satisfy the allowlist foreign key');
  assert.deepEqual(JSON.parse(profileWrite.options.body), { id: targetId, email: 'team@example.com' });
  const allowlistWrite = calls.find(call => call.url.endsWith('/rest/v1/admin_allowlist'));
  assert.ok(allowlistWrite);
  assert.equal(allowlistWrite.options.method, 'POST');
  assert.deepEqual(JSON.parse(allowlistWrite.options.body), {
    user_id: targetId,
    updated_by: actorId,
    email: 'team@example.com',
  });
});

test('a non-root account cannot grant administrator access', async () => {
  setupEnvironment();
  let writes = 0;
  globalThis.fetch = async (url, options = {}) => {
    if (options.method === 'POST' || options.method === 'PATCH') writes += 1;
    return new Response(JSON.stringify({ id: targetId, email: 'customer@example.com' }), { status: 200 });
  };
  const response = responseMock();

  await handler({
    method: 'POST',
    headers: { authorization: 'Bearer signed-in-customer-token' },
    body: { email: 'team@example.com' },
  }, response);

  assert.equal(response.code, 403);
  assert.equal(writes, 0);
});

test.after(() => {
  globalThis.fetch = originalFetch;
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

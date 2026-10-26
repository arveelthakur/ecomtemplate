import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../../api/bootstrapInitialAdministrator.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const { default: handler } = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);

const envKeys = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_INITIAL_ADMIN_EMAIL'];
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
const originalFetch = globalThis.fetch;

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

test('initial administrator endpoint refuses anonymous requests before contacting Supabase', async () => {
  setupEnvironment();
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; throw new Error('must not be called'); };
  const response = responseMock();
  await handler({ method: 'POST', headers: {} }, response);
  assert.equal(response.code, 401);
  assert.equal(calls, 0);
});

test('initial administrator endpoint writes the authenticated UUID to profiles and admin_allowlist', async () => {
  setupEnvironment();
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).endsWith('/auth/v1/user')) {
      return new Response(JSON.stringify({ id: 'test-user-uuid', email: 'Admin@Nura.pk' }), { status: 200 });
    }
    return new Response(null, { status: 204 });
  };

  const response = responseMock();
  await handler({
    method: 'POST',
    headers: { authorization: 'Bearer test-user-access-token' },
  }, response);

  assert.equal(response.code, 200);
  assert.deepEqual(response.body, { ready: true });
  assert.equal(calls.length, 3);
  assert.match(calls[1].url, /\/rest\/v1\/profiles\?on_conflict=id$/);
  assert.deepEqual(JSON.parse(calls[1].options.body), { id: 'test-user-uuid', email: 'admin@nura.pk' });
  assert.match(calls[2].url, /\/rest\/v1\/admin_allowlist\?on_conflict=user_id$/);
  assert.deepEqual(JSON.parse(calls[2].options.body), { user_id: 'test-user-uuid', email: 'admin@nura.pk' });
});

test('initial administrator endpoint does not write for a different authenticated email', async () => {
  setupEnvironment();
  let writes = 0;
  globalThis.fetch = async (url, options = {}) => {
    if (options.method === 'POST') writes += 1;
    return new Response(JSON.stringify({ id: 'customer-uuid', email: 'customer@example.com' }), { status: 200 });
  };

  const response = responseMock();
  await handler({
    method: 'POST',
    headers: { authorization: 'Bearer test-customer-token' },
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

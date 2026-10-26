import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');
const rootPackage = JSON.parse(read('package.json'));
const storefrontPackage = JSON.parse(read('artifacts/pakistani-storefront/package.json'));

test('the deployable workspace has no Firebase dependencies or config files', () => {
  const manifests = [rootPackage, storefrontPackage];
  for (const manifest of manifests) {
    const dependencies = { ...manifest.dependencies, ...manifest.devDependencies };
    assert.equal(Object.keys(dependencies).some(name => /firebase/i.test(name)), false);
  }
  for (const path of [
    'firebase.json',
    'firebase.emulators.json',
    'firestore.rules',
    'storage.rules',
    'functions/index.cjs',
  ]) {
    assert.throws(() => read(path), { code: 'ENOENT' });
  }
  assert.doesNotMatch(read('pnpm-workspace.yaml'), /firebase|firestore/i);
});

test('server-side Supabase credentials never use a browser-exposed variable name', () => {
  const api = read('api/store/[name].ts');
  const envExample = read('artifacts/pakistani-storefront/.env.example');
  assert.match(api, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(api, /VITE_SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(envExample, /^SUPABASE_SERVICE_ROLE_KEY=/m);
  assert.doesNotMatch(envExample, /^VITE_SUPABASE_SERVICE_ROLE_KEY=/m);
});

test('Vercel builds the static storefront while retaining the server API route', () => {
  const config = JSON.parse(read('vercel.json'));
  assert.match(config.installCommand, /pnpm install --frozen-lockfile/);
  assert.match(config.buildCommand, /@workspace\/pakistani-storefront/);
  assert.equal(config.outputDirectory, 'artifacts/pakistani-storefront/dist/public');
  assert.deepEqual(config.rewrites, [
    { source: '/((?!api/).*)', destination: '/index.html' },
  ], 'the SPA fallback must not rewrite API requests to index.html');
  assert.deepEqual(config.crons.map(({ path }) => path), [
    '/api/store/sendAbandonedCheckoutEmails',
    '/api/store/sendAbandonedCheckoutWhatsApp',
    '/api/store/sendWhatsAppReviewRequests',
  ]);
  for (const job of config.crons) {
    assert.match(job.schedule, /^\d{1,2} \d{1,2} \* \* \*$/, 'default cron jobs must run only once daily');
  }
  const viteConfig = read('artifacts/pakistani-storefront/vite.config.ts');
  assert.match(viteConfig, /process\.env\.PORT \|\| '5000'/);
  assert.match(viteConfig, /process\.env\.BASE_PATH \|\| '\/'/);
  assert.doesNotThrow(() => read('api/store/[name].ts'));
});

test('provider delivery stays server-side and webhook/cron routes enforce signatures', () => {
  const api = read('api/store/[name].ts');
  const envExample = read('artifacts/pakistani-storefront/.env.example');
  assert.match(api, /WHATSAPP_ACCESS_TOKEN/);
  assert.match(api, /WHATSAPP_APP_SECRET/);
  assert.match(api, /x-hub-signature-256/);
  assert.match(api, /x-twilio-signature/);
  assert.match(api, /CRON_SECRET/);
  assert.match(api, /process_voice_call_response/);
  assert.match(envExample, /^WHATSAPP_ACCESS_TOKEN=/m);
  assert.match(envExample, /^CRON_SECRET=/m);
  assert.doesNotMatch(envExample, /^VITE_(WHATSAPP|TWILIO|VOICE|CRON)_/m);
  assert.doesNotMatch(api, /result = \{ configured: false, available: false, result: null \}/);
  assert.doesNotMatch(read('functions/WHATSAPP_SETUP.md'), /delivery is not enabled/);
});

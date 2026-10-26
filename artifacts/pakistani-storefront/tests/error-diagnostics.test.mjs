import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createDiagnosticReport, redactDiagnostic } from '../src/utils/errorDiagnostics.mjs';

const boundary = await readFile(new URL('../src/components/error-boundary.tsx', import.meta.url), 'utf8');

test('copyable storefront diagnostics redact tokens, API keys, contact details, and URL secrets', () => {
  const raw = [
    'Bearer privateBearer',
    'eyJabc.def.ghi',
    'SUPABASE_ANON_KEY=privateAnon',
    'sb_publishable_privatePublishable',
    'api_key=privateApiKey',
    'https://example.test/?access_token=privateQuery',
    'admin@example.test',
    '+923001234567',
  ].join(' ');
  const safe = redactDiagnostic(raw);
  for (const secret of ['privateBearer', 'eyJabc.def.ghi', 'privateAnon', 'privatePublishable', 'privateApiKey', 'privateQuery', 'admin@example.test', '+923001234567']) {
    assert.equal(safe.includes(secret), false, `diagnostic must redact ${secret}`);
  }
  assert.match(safe, /\[redacted token\]/);
  assert.match(safe, /\[redacted email\]/);
  assert.match(safe, /\[redacted phone\]/);
});

test('error reports use only a page route, exception summary, and a short component trace', () => {
  const report = createDiagnosticReport(new TypeError('Cannot read properties of undefined'), '\n    at HomePage\n    at Storefront\n', '/');
  assert.match(report, /^Route: \/\nError: TypeError:/);
  assert.match(report, /at HomePage/);
  assert.doesNotMatch(report, /https?:\/\//);
});

test('the production fallback exposes diagnostics only on user request and sends no automatic report', () => {
  assert.match(boundary, /Copy diagnostic/);
  assert.match(boundary, /navigator\.clipboard\.writeText\(diagnostic\)/);
  assert.doesNotMatch(boundary, /fetch\(|navigator\.sendBeacon|XMLHttpRequest/);
  assert.match(boundary, /sensitive values redacted/);
});

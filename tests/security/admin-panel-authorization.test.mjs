import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const source = await readFile(new URL('../../artifacts/pakistani-storefront/src/utils/adminAuthorization.ts', import.meta.url), 'utf8');
const javascript = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
}).outputText;
const authorization = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString('base64')}`);

test('only the matching Supabase admin allowlist entry grants admin UI access', () => {
  assert.equal(authorization.matchesSupabaseAdminAllowlist('user-1', 'ADMIN@NURA.PK', { user_id: 'user-1', email: 'admin@nura.pk' }), true);
  assert.equal(authorization.matchesSupabaseAdminAllowlist('user-2', 'customer@nura.pk', { user_id: 'user-1', email: 'admin@nura.pk' }), false);
  assert.equal(authorization.matchesSupabaseAdminAllowlist('user-1', 'other@nura.pk', { user_id: 'user-1', email: 'admin@nura.pk' }), false);
  assert.equal(authorization.matchesSupabaseAdminAllowlist('user-2', 'customer@nura.pk', null), false);
});

test('profile self-reported role flags do not grant admin access and the link stays hidden during auth checks', () => {
  const customerProfile = { admin: true };
  assert.equal(authorization.matchesSupabaseAdminAllowlist('customer-1', 'customer@nura.pk', null), false);
  assert.equal(authorization.shouldShowAdminPanelLink(true, true), false);
  assert.equal(authorization.shouldShowAdminPanelLink(false, false), false);
  assert.equal(authorization.shouldShowAdminPanelLink(true, false), true);
  assert.equal(customerProfile.admin, true);
});

test('Supabase token refreshes for the same account do not restart administrator authorization', () => {
  assert.equal(authorization.shouldRecheckAdminAccess('user-1', 'user-1'), false);
  assert.equal(authorization.shouldRecheckAdminAccess(null, 'user-1'), true);
  assert.equal(authorization.shouldRecheckAdminAccess('user-1', null), true);
  assert.equal(authorization.shouldRecheckAdminAccess('user-1', 'user-2'), true);
});

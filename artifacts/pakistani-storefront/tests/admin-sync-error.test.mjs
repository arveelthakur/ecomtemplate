import assert from 'node:assert/strict';
import test from 'node:test';
import { adminSyncFailureMessage, classifyAdminSyncFailure } from '../src/utils/adminSyncError.mjs';

test('classifies missing configuration, expired auth and RLS/admin permission errors separately',()=>{
  assert.equal(classifyAdminSyncFailure(new Error('Supabase is not configured. Add VITE_SUPABASE_URL.')),'configuration');
  assert.equal(classifyAdminSyncFailure({status:401,code:'PGRST301',message:'JWT expired'}),'session');
  assert.equal(classifyAdminSyncFailure({status:403,code:'42501',message:'new row violates row-level security policy'}),'permissions');
  assert.match(adminSyncFailureMessage('permissions'),/admin_allowlist/);
});

test('classifies transient and throttled failures without exposing raw server detail',()=>{
  assert.equal(classifyAdminSyncFailure({status:503,message:'temporary server error'}),'network');
  assert.equal(classifyAdminSyncFailure({status:429,message:'rate limit exceeded'}),'backend-throttled');
  const message=adminSyncFailureMessage('network');
  assert.match(message,/connection/);
  assert.doesNotMatch(message,/temporary server error/i);
});

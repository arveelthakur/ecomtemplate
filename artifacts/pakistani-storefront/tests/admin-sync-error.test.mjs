
test('shows only safe Supabase diagnostic code and status, never raw server details',()=>{
  const diagnostic=adminSyncFailureDiagnostic({code:'PGRST202',status:404,message:'secret-bearing raw server detail'});
  assert.equal(diagnostic,'Diagnostic: code=PGRST202; HTTP=404.');
  assert.doesNotMatch(diagnostic,/secret-bearing|raw server detail/i);
  assert.match(adminSyncFailureDiagnostic({message:'unknown'}),/code=unavailable; HTTP=unavailable/);
  assert.match(adminSyncFailureDiagnostic(new Error('unknown')),/code=client_error; HTTP=unavailable/);
  assert.match(adminSyncFailureDiagnostic(new TypeError('NetworkError when attempting to fetch resource')),/code=network_error; HTTP=unavailable/);
  assert.match(adminSyncFailureDiagnostic(new Error('Supabase could not confirm every restored setting.')),/code=settings_readback_failed; HTTP=unavailable/);
});
import assert from 'node:assert/strict';
import test from 'node:test';
import { adminSyncFailureDiagnostic, adminSyncFailureMessage, classifyAdminSyncFailure } from '../src/utils/adminSyncError.mjs';

test('classifies missing configuration, expired auth and RLS/admin permission errors separately',()=>{
  assert.equal(classifyAdminSyncFailure(new Error('Supabase is not configured. Add VITE_SUPABASE_URL.')),'configuration');
  assert.equal(classifyAdminSyncFailure({status:401,code:'PGRST301',message:'JWT expired'}),'session');
  assert.equal(classifyAdminSyncFailure({status:403,code:'42501',message:'new row violates row-level security policy'}),'permissions');
  assert.match(adminSyncFailureMessage('permissions'),/admin_allowlist/);
  assert.equal(classifyAdminSyncFailure({code:'PGRST202',status:404,message:'function not found'}),'schema');
  assert.match(adminSyncFailureMessage('schema'),/migrations/);
});

test('classifies transient and throttled failures without exposing raw server detail',()=>{
  assert.equal(classifyAdminSyncFailure({status:503,message:'temporary server error'}),'network');
  assert.equal(classifyAdminSyncFailure({status:429,message:'rate limit exceeded'}),'backend-throttled');
  const message=adminSyncFailureMessage('network');
  assert.match(message,/connection/);
  assert.doesNotMatch(message,/temporary server error/i);
});

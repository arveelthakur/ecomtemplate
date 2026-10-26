export type AdminSyncFailureKind='configuration'|'session'|'permissions'|'schema'|'backend-throttled'|'network'|'unknown';
export function classifyAdminSyncFailure(error:unknown):AdminSyncFailureKind;
export function adminSyncFailureMessage(reason:AdminSyncFailureKind|undefined):string;
export function adminSyncFailureDiagnostic(error:unknown):string;

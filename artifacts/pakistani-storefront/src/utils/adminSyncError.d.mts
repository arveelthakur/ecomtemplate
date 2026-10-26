export type AdminSyncFailureKind='configuration'|'session'|'permissions'|'backend-throttled'|'network'|'unknown';
export function classifyAdminSyncFailure(error:unknown):AdminSyncFailureKind;
export function adminSyncFailureMessage(reason:AdminSyncFailureKind|undefined):string;

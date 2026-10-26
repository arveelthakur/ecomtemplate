const forbiddenDraftKey = /secret|password|credential|token|private|api.?key|auth.?key|recaptcha|account.?number|iban|inbox|customer.?message/i;
const forbiddenExactKey = new Set(['paymentdetails', 'analytics']);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function valuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((value, index) => valuesEqual(value, right[index]));
  }
  if (isPlainRecord(left) || isPlainRecord(right)) {
    if (!isPlainRecord(left) || !isPlainRecord(right)) return false;
    const leftKeys = Object.keys(left);
    const rightKeys = Object.keys(right);
    return leftKeys.length === rightKeys.length
      && leftKeys.every((key) => Object.hasOwn(right, key) && valuesEqual(left[key], right[key]));
  }
  return false;
}

/**
 * Keep browser recovery drafts limited to non-sensitive store content and
 * settings. This is intentionally also applied when reading older cache data.
 */
export function sanitizeAdminSettingsDraft<T>(value: T): T {
  const sanitize = (item: unknown): unknown => {
    if (typeof item === 'string') return /^data:/i.test(item) ? undefined : item;
    if (Array.isArray(item)) {
      return item.map(sanitize).filter((entry) => entry !== undefined);
    }
    if (!isPlainRecord(item)) return item;

    const safe: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(item)) {
      const normalizedKey = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
      if (forbiddenDraftKey.test(key) || forbiddenExactKey.has(normalizedKey)) continue;
      const sanitizedChild = sanitize(child);
      if (sanitizedChild !== undefined) safe[key] = sanitizedChild;
    }
    return safe;
  };

  return sanitize(value) as T;
}

export function mergeAdminSettingsDraft<T>(
  baseline: T,
  draft: T,
  latest: T,
): { value: T; conflicts: string[] } {
  const conflicts: string[] = [];

  const merge = (base: unknown, local: unknown, remote: unknown, path: string): unknown => {
    if (valuesEqual(local, base)) return remote;
    if (valuesEqual(remote, base) || valuesEqual(remote, local)) return local;

    if (isPlainRecord(base) && isPlainRecord(local) && isPlainRecord(remote)) {
      const result: Record<string, unknown> = {};
      const keys = new Set([...Object.keys(base), ...Object.keys(local), ...Object.keys(remote)]);
      for (const key of keys) {
        const value = merge(base[key], local[key], remote[key], path ? `${path}.${key}` : key);
        if (value !== undefined) result[key] = value;
      }
      return result;
    }

    conflicts.push(path || 'settings');
    return remote;
  };

  return { value: merge(baseline, draft, latest, '') as T, conflicts };
}

function scopeCovers(parent: string, child: string) {
  return child === parent || child.startsWith(`${parent}.`);
}

function valueAtPath(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, value);
}

/**
 * Detect a stale browser recovery entry whose edits are already present in the
 * server snapshot. Conflicting local edits are deliberately left recoverable.
 */
export function adminSettingsDraftIsSynced<T>(
  baseline: T,
  draft: T,
  latest: T,
  scopes: string[],
): boolean {
  const savedScopes = [...new Set(scopes.filter((scope) =>
    scope === 'content' || scope === 'settings' || scope.startsWith('content.') || scope.startsWith('settings.'),
  ))];
  if (!savedScopes.length) return false;

  const merged = mergeAdminSettingsDraft(baseline, draft, latest);
  const relevantConflict = merged.conflicts.some((conflict) =>
    savedScopes.some((scope) => scopeCovers(scope, conflict) || scopeCovers(conflict, scope)),
  );
  if (relevantConflict) return false;

  return savedScopes.every((scope) =>
    valuesEqual(valueAtPath(merged.value, scope), valueAtPath(latest, scope)),
  );
}

export function resolvePendingAdminSaveState<TScope extends string>({
  writesAtStart,
  writesNow,
  savedScopes,
  pendingScopesAtStart,
  scopesRequestedDuringSave,
}: {
  writesAtStart: number;
  writesNow: number;
  savedScopes: TScope[];
  pendingScopesAtStart: TScope[];
  scopesRequestedDuringSave: TScope[];
}): { pending: boolean; pendingCount: number; pendingScopes: TScope[]; changedDuringSave: boolean } {
  const changedDuringSave = writesNow > writesAtStart;
  const unresolvedScopes = pendingScopesAtStart.filter((pendingScope) =>
    !savedScopes.some((savedScope) => scopeCovers(savedScope, pendingScope)),
  );
  const pendingScopes = [...new Set<TScope>([
    ...unresolvedScopes,
    ...scopesRequestedDuringSave,
    ...(changedDuringSave ? savedScopes : []),
  ])];
  const pending = changedDuringSave || pendingScopes.length > 0;
  return {
    pending,
    pendingCount: pending ? Math.max(1, writesNow - writesAtStart) : 0,
    pendingScopes,
    changedDuringSave,
  };
}

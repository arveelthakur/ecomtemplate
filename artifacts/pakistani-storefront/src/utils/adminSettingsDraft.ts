const forbiddenDraftKey = /secret|password|credential|token|private|api.?key|auth.?key|recaptcha|account.?number|iban|inbox|customer.?message/i;
const forbiddenExactKey = new Set(['paymentdetails', 'analytics']);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
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
  const equal = (left: unknown, right: unknown): boolean => {
    if (Object.is(left, right)) return true;
    if (Array.isArray(left) || Array.isArray(right)) {
      return Array.isArray(left)
        && Array.isArray(right)
        && left.length === right.length
        && left.every((value, index) => equal(value, right[index]));
    }
    if (isPlainRecord(left) || isPlainRecord(right)) {
      if (!isPlainRecord(left) || !isPlainRecord(right)) return false;
      const leftKeys = Object.keys(left);
      const rightKeys = Object.keys(right);
      return leftKeys.length === rightKeys.length
        && leftKeys.every((key) => Object.hasOwn(right, key) && equal(left[key], right[key]));
    }
    return false;
  };

  const merge = (base: unknown, local: unknown, remote: unknown, path: string): unknown => {
    if (equal(local, base)) return remote;
    if (equal(remote, base) || equal(remote, local)) return local;

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

export type AdminAllowlistEntry = {
  user_id?: unknown;
  email?: unknown;
};

/** The database allowlist is the canonical admin role used by Supabase RLS. */
export function matchesSupabaseAdminAllowlist(
  userId: string | null | undefined,
  email: string | null | undefined,
  entry: AdminAllowlistEntry | null | undefined,
): boolean {
  const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
  return Boolean(
    userId &&
    normalizedEmail &&
    entry &&
    entry.user_id === userId &&
    typeof entry.email === 'string' &&
    entry.email.trim().toLowerCase() === normalizedEmail,
  );
}

export function shouldShowAdminPanelLink(isAdmin: boolean, loading: boolean): boolean {
  return !loading && isAdmin;
}

/** A token refresh for the same account must not reset the admin route state. */
export function shouldRecheckAdminAccess(activeUserId: string | null, nextUserId: string | null): boolean {
  return activeUserId !== nextUserId;
}

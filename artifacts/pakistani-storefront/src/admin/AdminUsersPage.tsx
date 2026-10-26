import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Clock3, RefreshCw, ShieldCheck, UserPlus, UserRoundX } from 'lucide-react';
import { httpsCallable, functions } from '../lib/supabase/functions';
import { ROOT_ADMIN_EMAILS, useAuth } from '../context/AuthContext';

type Administrator = {
  uid: string;
  email: string;
  displayName: string;
  createdAt: string | null;
};

type AuditEvent = {
  id: string;
  action: 'grant' | 'revoke';
  actorUid: string;
  actorEmail: string;
  targetUid: string;
  targetEmail: string;
  targetDisplayName: string;
  createdAt: string | null;
};

type AdminListResult = {
  administrators: Administrator[];
  auditEvents: AuditEvent[];
  allowlistedEmails: string[];
};

type AdminMutationResult = {
  changed: boolean;
  uid: string;
  email: string;
};

function formatDate(value: string | null) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString('en-PK', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The request could not be completed. Please try again.';
}

export default function AdminUsersPage() {
  const { user } = useAuth();
  const isSuperAdmin = ROOT_ADMIN_EMAILS.has(user?.email?.trim().toLowerCase() || '');
  const [administrators, setAdministrators] = useState<Administrator[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [allowlistedEmails, setAllowlistedEmails] = useState<string[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingRevoke, setPendingRevoke] = useState<Administrator | null>(null);

  const loadAdministrators = useCallback(async (quiet = false) => {
    if (!functions) {
      setError('The Vercel server API is not configured for this workspace.');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      const listAdministrators = httpsCallable<undefined, AdminListResult>(functions, 'adminListAdministrators');
      const result = await listAdministrators(undefined);
      setAdministrators(result.data.administrators);
      setAuditEvents(result.data.auditEvents);
      setAllowlistedEmails(Array.isArray(result.data.allowlistedEmails) ? result.data.allowlistedEmails : []);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAdministrators();
  }, [loadAdministrators]);

  async function submitGrant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !functions) {
      if (!functions) setError('The Vercel server API is not configured for this workspace.');
      return;
    }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const grantAdministrator = httpsCallable<{ email: string }, AdminMutationResult>(functions, 'adminGrantAdministrator');
      const result = await grantAdministrator({ email: cleanEmail });
      setEmail('');
      setSuccess(result.data.changed
        ? `Administrator access granted to ${result.data.email}.`
        : `No access change was needed for ${result.data.email}.`);
      await loadAdministrators(true);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmRevoke() {
    if (!pendingRevoke || !functions) return;
    const target = pendingRevoke;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const revokeAdministrator = httpsCallable<{ uid: string }, AdminMutationResult>(functions, 'adminRevokeAdministrator');
      const result = await revokeAdministrator({ uid: target.uid });
      setPendingRevoke(null);
      setSuccess(result.data.changed
        ? `Administrator access revoked for ${result.data.email}.`
        : `No access change was needed for ${result.data.email}.`);
      await loadAdministrators(true);
    } catch (failure) {
      setError(errorMessage(failure));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="ad-page-head">
        <div>
          <div className="ad-kicker">Configuration · Access</div>
          <h1 className="ad-page-title">Team Access</h1>
          <p className="ad-page-subtitle">Review authorized administrators and manage team access. Changes are recorded for review.</p>
        </div>
        <button className="ad-btn" type="button" onClick={() => void loadAdministrators(true)} disabled={loading || refreshing} data-testid="button-refresh-admin-users">
          <RefreshCw className={refreshing ? 'ad-users-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {error && <div className="ad-users-feedback error" role="alert"><AlertCircle /><span>{error}</span></div>}
      {success && <div className="ad-users-feedback success" role="status"><CheckCircle2 /><span>{success}</span></div>}

      <div className="ad-users-layout">
        {isSuperAdmin ? <section className="ad-card ad-users-access-card">
          <header className="ad-card-head">
            <div>
              <h2 className="ad-card-title">Grant administrator access</h2>
              <div className="ad-card-note">Add an existing Supabase Auth account to the protected admin allowlist.</div>
            </div>
            <span className="ad-users-icon"><UserPlus /></span>
          </header>
          <form className="ad-card-body ad-form-stack" onSubmit={submitGrant}>
            <label className="ad-field">
              <span className="ad-label">Account email</span>
              <input
                className="ad-input"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="team@example.com"
                disabled={submitting}
                data-testid="input-admin-user-email"
              />
            </label>
            <p className="ad-help">Only the super-admin can change this roster. The account must already exist; adding an email grants its Supabase allowlist entry and admin role.</p>
            <button className="ad-btn primary ad-users-submit" type="submit" disabled={submitting || !email.trim()} data-testid="button-grant-admin-access">
              <UserPlus />{submitting ? 'Updating access…' : 'Grant access'}
            </button>
          </form>
        </section> : <section className="ad-card ad-users-access-card"><div className="ad-card-body"><h2 className="ad-card-title">Super-admin managed</h2><p className="ad-item-sub">Only the hardcoded super-admin can add or revoke team members.</p></div></section>}

        <section className="ad-card ad-users-summary">
          <div className="ad-card-body">
            <span className="ad-users-icon"><ShieldCheck /></span>
            <div className="ad-users-count">{loading ? '—' : administrators.length.toString().padStart(2, '0')}</div>
            <div className="ad-item-name">Active administrators</div>
            <p className="ad-item-sub">Access requires an active Supabase administrator allowlist entry.</p>
            <p className="ad-help">Authorized identities: {allowlistedEmails.length ? allowlistedEmails.join(', ') : 'Loading allowlist…'}</p>
          </div>
        </section>
      </div>

      <section className="ad-card ad-users-list-card">
        <header className="ad-card-head">
          <div>
            <h2 className="ad-card-title">Administrators</h2>
            <div className="ad-card-note">Current access roster</div>
          </div>
          {!loading && <span className="ad-status">{administrators.length} {administrators.length === 1 ? 'account' : 'accounts'}</span>}
        </header>
        {loading ? (
          <div className="ad-users-skeleton" aria-label="Loading administrators" aria-busy="true">
            {[0, 1, 2].map(row => <div className="ad-users-skeleton-row" key={row}><span /><div><i /><i /></div><b /></div>)}
          </div>
        ) : administrators.length === 0 ? (
          <div className="ad-empty">
            <span className="ad-empty-mark"><ShieldCheck /></span>
            <h3>No administrators found</h3>
            <p>The access roster is currently empty. Use the form above to grant access to an existing account.</p>
          </div>
        ) : (
          <div className="ad-table-wrap">
            <table className="ad-table ad-users-table">
              <thead><tr><th>Administrator</th><th>Added</th><th>Access</th><th /></tr></thead>
              <tbody>
                {administrators.map(administrator => {
                  const isSelf = administrator.uid === user?.uid;
                  return <tr key={administrator.uid} data-testid={`row-admin-user-${administrator.uid}`}>
                    <td>
                      <div className="ad-users-person">
                        <span className="ad-users-avatar">{(administrator.displayName || administrator.email || '?').slice(0, 1).toUpperCase()}</span>
                        <span><strong className="ad-item-name">{administrator.displayName || 'Unnamed account'}</strong><span className="ad-item-sub ad-users-email">{administrator.email}</span></span>
                      </div>
                    </td>
                    <td>{formatDate(administrator.createdAt)}</td>
                    <td><span className="ad-status green"><ShieldCheck size={12} /> Administrator</span></td>
                    <td className="ad-users-revoke-cell">
                      {!isSuperAdmin || isSelf
                        ? <span className="ad-users-self-note" title="You cannot revoke your own access here">Current account</span>
                        : <button type="button" className="ad-btn danger small" onClick={() => setPendingRevoke(administrator)} disabled={submitting} aria-label={`Revoke access for ${administrator.email}`} data-testid={`button-revoke-admin-${administrator.uid}`}><UserRoundX /> Revoke</button>}
                    </td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="ad-card ad-users-audit">
        <header className="ad-card-head">
          <div>
            <h2 className="ad-card-title">Recent access activity</h2>
            <div className="ad-card-note">Latest administrator grants and revocations</div>
          </div>
          <Clock3 className="ad-users-audit-icon" />
        </header>
        {loading ? (
          <div className="ad-users-audit-loading">Loading access history…</div>
        ) : auditEvents.length === 0 ? (
          <div className="ad-empty-inline">No access changes have been recorded yet.</div>
        ) : (
          <ol className="ad-users-audit-list">
            {auditEvents.slice(0, 8).map(event => {
              const granted = event.action === 'grant';
              return <li key={event.id} className="ad-users-audit-item">
                <span className={`ad-users-audit-mark ${granted ? 'grant' : 'revoke'}`}><span /></span>
                <div className="ad-users-audit-copy">
                  <div><strong>{event.actorEmail || 'Administrator'}</strong> {granted ? 'granted access to' : 'revoked access for'} <strong>{event.targetDisplayName || event.targetEmail}</strong></div>
                  <div className="ad-item-sub">{event.targetEmail}</div>
                </div>
                <time className="ad-users-audit-time">{formatDate(event.createdAt)}</time>
              </li>;
            })}
          </ol>
        )}
      </section>

      {pendingRevoke && <div className="ad-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !submitting) setPendingRevoke(null); }}>
        <section className="ad-modal ad-users-confirm" role="alertdialog" aria-modal="true" aria-labelledby="admin-users-confirm-title" aria-describedby="admin-users-confirm-copy">
          <header className="ad-modal-head">
            <div><h2 className="ad-card-title" id="admin-users-confirm-title">Revoke administrator access?</h2><div className="ad-card-note">This account will no longer be able to enter the admin workspace.</div></div>
          </header>
          <div className="ad-modal-body">
            <div className="ad-users-confirm-target"><span className="ad-users-avatar">{(pendingRevoke.displayName || pendingRevoke.email).slice(0, 1).toUpperCase()}</span><div><strong className="ad-item-name">{pendingRevoke.displayName || 'Unnamed account'}</strong><div className="ad-item-sub">{pendingRevoke.email}</div></div></div>
            <p className="ad-users-confirm-copy" id="admin-users-confirm-copy">You can grant access again later if this account needs it.</p>
          </div>
          <footer className="ad-modal-foot">
            <button className="ad-btn" type="button" onClick={() => setPendingRevoke(null)} disabled={submitting}>Keep access</button>
            <button className="ad-btn danger" type="button" onClick={() => void confirmRevoke()} disabled={submitting} data-testid="button-confirm-revoke-admin">{submitting ? 'Revoking…' : 'Revoke access'}</button>
          </footer>
        </section>
      </div>}
    </>
  );
}

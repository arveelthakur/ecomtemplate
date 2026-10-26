import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
export default function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading, adminCheckStatus, adminCheckError, retryAdminCheck } = useAuth();
  if (loading && !user) return <main className="page-wrap py-20" role="status">Restoring your session…</main>;
  if (!user) return <Navigate to="/" replace />;
  if (adminCheckStatus === 'checking' || adminCheckStatus === 'idle') {
    return <main className="page-wrap py-20" role="status">Checking administrator access…</main>;
  }
  if (adminCheckStatus === 'error') {
    return <main className="page-wrap max-w-xl py-20" role="alert">
      <h1 className="text-2xl font-semibold">Administrator access could not be checked.</h1>
      <p className="mt-3 text-sm leading-6 text-[#766d64]">{adminCheckError || 'Your session is still active. Check your connection and try again.'}</p>
      <button type="button" onClick={retryAdminCheck} className="mt-5 inline-flex min-h-11 items-center rounded-md bg-[var(--nura-primary,#6b2447)] px-5 text-sm font-semibold text-white">
        Retry access check
      </button>
    </main>;
  }
  if (!isAdmin || adminCheckStatus !== 'authorized') return <Navigate to="/" replace />;
  return children;
}

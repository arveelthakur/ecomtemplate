import type { Session, User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from './client';

export type User = SupabaseUser & {
  uid: string;
  displayName: string | null;
  isAnonymous: boolean;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
};

export type AuthCredential = { email: string; password: string };

let activeSession: Session | null = null;
let activeUser: User | null = null;

function mapUser(user: SupabaseUser | null, session: Session | null = activeSession): User | null {
  if (!user) return null;
  return Object.assign({}, user, {
    uid: user.id,
    displayName: String(user.user_metadata?.display_name || ''),
    isAnonymous: user.is_anonymous === true,
    getIdToken: async (forceRefresh = false) => {
      const authClient = requireAuth();
      const { data, error } = forceRefresh
        ? await authClient.refreshSession()
        : await authClient.getSession();
      if (error) throw error;
      if (!data.session?.access_token) throw new Error('Your session has expired. Sign in again.');
      activeSession = data.session;
      activeUser = mapUser(data.session.user, data.session);
      return data.session.access_token;
    },
  });
}

function requireAuth() {
  if (!supabase) throw new Error('Supabase Authentication is not configured.');
  return supabase.auth;
}

export const auth = {
  get currentUser() {
    return activeUser;
  },
};

export function onAuthStateChanged(
  _auth: typeof auth,
  callback: (user: User | null, event: string) => void,
  onError?: (error: Error) => void,
) {
  const client = requireAuth();
  let cancelled = false;
  const { data: { subscription } } = client.onAuthStateChange((_event, session) => {
    activeSession = session;
    activeUser = mapUser(session?.user || null, session);
    if (!cancelled) callback(activeUser, _event);
  });
  // Supabase emits INITIAL_SESSION after loading persisted browser storage.
  // Listening to that single event avoids racing a second getSession() callback
  // against TOKEN_REFRESHED and resetting application authorization state.
  void onError;
  return () => {
    cancelled = true;
    subscription.unsubscribe();
  };
}

export async function createUserWithEmailAndPassword(_auth: typeof auth, email: string, password: string) {
  const { data, error } = await requireAuth().signUp({ email, password });
  if (error) throw error;
  if (!data.user) throw new Error('Supabase did not return the new user.');
  return { user: mapUser(data.user, data.session)! };
}

export async function signInWithEmailAndPassword(_auth: typeof auth, email: string, password: string) {
  const { data, error } = await requireAuth().signInWithPassword({ email, password });
  if (error) throw error;
  return { user: mapUser(data.user, data.session)! };
}

export async function signInAnonymously(_auth: typeof auth) {
  const { data, error } = await requireAuth().signInAnonymously();
  if (error) throw error;
  if (!data.user) throw new Error('Supabase did not return a guest session.');
  return { user: mapUser(data.user, data.session)! };
}

export async function linkWithCredential(user: User, credential: AuthCredential) {
  const { data, error } = await requireAuth().updateUser({
    email: credential.email,
    password: credential.password,
  });
  if (error) throw error;
  if (!data.user) throw new Error('Supabase did not return the upgraded account.');
  return { user: mapUser(data.user)! };
}

export const EmailAuthProvider = {
  credential(email: string, password: string): AuthCredential {
    return { email, password };
  },
};

export async function updateProfile(user: User, profile: { displayName?: string | null }) {
  const { data, error } = await requireAuth().updateUser({
    data: { display_name: profile.displayName || '' },
  });
  if (error) throw error;
  if (activeUser?.id === user.id && data.user) activeUser = mapUser(data.user)!;
}

export async function sendPasswordResetEmail(_auth: typeof auth, email: string) {
  const redirectTo = import.meta.env.VITE_SUPABASE_PASSWORD_RESET_REDIRECT_URL;
  const { error } = await requireAuth().resetPasswordForEmail(email, redirectTo ? { redirectTo } : undefined);
  if (error) throw error;
}

export async function signOut(_auth: typeof auth) {
  const { error } = await requireAuth().signOut();
  if (error) throw error;
}

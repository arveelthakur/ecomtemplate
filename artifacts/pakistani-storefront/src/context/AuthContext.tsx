import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as supabaseSignOut,
  updateProfile,
  type User,
} from '../lib/supabase/auth';
import { supabase } from '../lib/supabase/client';
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from '../lib/supabase/documents';
import { sanitizeText } from '../utils/sanitize';
import { protectForm } from '../hooks/use-recaptcha';
import { matchesSupabaseAdminAllowlist, shouldRecheckAdminAccess } from '../utils/adminAuthorization';

const initialAdminEmail = import.meta.env.VITE_SUPABASE_INITIAL_ADMIN_EMAIL?.trim().toLowerCase() || '';
export const ROOT_ADMIN_EMAILS = new Set(initialAdminEmail ? [initialAdminEmail] : []);

export type CustomerProfile = {
  displayName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  birthday: string;
  marketingConsent: boolean;
};
export type AuthValue = {
  user: User | null;
  isAdmin: boolean;
  adminCheckStatus: 'idle' | 'checking' | 'authorized' | 'denied' | 'error';
  adminCheckError: string;
  retryAdminCheck: () => void;
  loading: boolean;
  error: string;
  profile: CustomerProfile | null;
  saveProfile: (profile: CustomerProfile) => Promise<void>;
  ensureCustomerSession: () => Promise<User>;
  upgradeGuestAccount: (name: string, email: string, password: string, profile: CustomerProfile) => Promise<void>;
  continueAsGuest: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (name: string, email: string, password: string, marketingConsent?: boolean) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthValue | null>(null);

async function saveNormalizedProfile(userId: string, values: Record<string, unknown>) {
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase
    .from('profiles')
    .update(values)
    .eq('id', userId)
    .select('id');
  if (error) throw error;
  if (data?.length) return;
  const { error: insertError } = await supabase.from('profiles').insert({
    id: userId,
    admin: false,
    ...values,
  });
  if (insertError) throw insertError;
}

async function verifySupabaseAdminAccess(client: NonNullable<typeof supabase>, next: User) {
  const email = next.email?.trim().toLowerCase() || '';
  if (email && ROOT_ADMIN_EMAILS.has(email)) {
    const { data: authSession, error: authSessionError } = await client.auth.getSession();
    if (authSessionError) throw authSessionError;
    if (!authSession.session?.access_token) {
      throw new Error('Sign in again to finish initial administrator setup.');
    }
    const bootstrap = await fetch('/api/bootstrapInitialAdministrator', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${authSession.session.access_token}`,
        'content-type': 'application/json',
      },
      body: '{}',
    });
    if (!bootstrap.ok) {
      const payload = await bootstrap.json().catch(() => ({}));
      throw new Error(typeof payload?.error === 'string' ? payload.error : 'Initial administrator setup could not be verified.');
    }
  }

  const { data: allowlist, error: allowlistError } = await client
    .from('admin_allowlist')
    .select('user_id,email')
    .eq('user_id', next.uid)
    .maybeSingle();
  if (allowlistError) throw allowlistError;
  return matchesSupabaseAdminAllowlist(next.uid, email, allowlist);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckStatus, setAdminCheckStatus] = useState<AuthValue['adminCheckStatus']>('checking');
  const [adminCheckError, setAdminCheckError] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const activeUserId = useRef<string | null>(null);
  const adminCheckGeneration = useRef(0);

  const verifyAdmin = useCallback((client: NonNullable<typeof supabase>, next: User) => {
    const generation = ++adminCheckGeneration.current;
    setAdminCheckStatus('checking');
    setAdminCheckError('');
    void verifySupabaseAdminAccess(client, next).then(authorized => {
      if (activeUserId.current !== next.uid || generation !== adminCheckGeneration.current) return;
      setIsAdmin(authorized);
      setAdminCheckStatus(authorized ? 'authorized' : 'denied');
    }).catch(failure => {
      if (activeUserId.current !== next.uid || generation !== adminCheckGeneration.current) return;
      setIsAdmin(false);
      setAdminCheckError(failure instanceof Error ? failure.message : 'Unable to verify administrator access.');
      setAdminCheckStatus('error');
    });
  }, []);

  const retryAdminCheck = useCallback(() => {
    if (supabase && user) verifyAdmin(supabase, user);
  }, [user, verifyAdmin]);

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }
    let unsubscribeProfile: (() => void) | undefined;
    let hasInitialAuthState = false;
    const unsubscribe = onAuthStateChanged({
      get currentUser() { return user; },
    }, next => {
      const nextUserId = next?.uid || null;
      const isInitialEvent = !hasInitialAuthState;
      hasInitialAuthState = true;
      if (!shouldRecheckAdminAccess(activeUserId.current, nextUserId) && !isInitialEvent) {
        // Access-token refreshes keep the same Supabase identity. Retain the
        // verified admin state and profile so RequireAdmin cannot navigate
        // away in the brief interval before a repeated network check.
        setUser(next);
        return;
      }
      unsubscribeProfile?.();
      unsubscribeProfile = undefined;
      activeUserId.current = nextUserId;
      adminCheckGeneration.current++;
      setUser(next);
      setIsAdmin(false);
      setAdminCheckError('');
      setError('');
      setProfile(null);
      if (!next) {
        setAdminCheckStatus('idle');
        setLoading(false);
        return;
      }
      setLoading(true);
      // Admin bootstrap must not depend on the separate profile-document read:
      // that read can fail while the signed-in user still has a valid session.
      verifyAdmin(client, next);
      unsubscribeProfile = onSnapshot(
        doc(client, 'users', next.uid),
        snapshot => {
          const saved = snapshot.data() || {};
          if (activeUserId.current !== next.uid) return;
          setProfile({
            displayName: typeof saved.displayName === 'string' ? saved.displayName : next.displayName || '',
            phone: typeof saved.phone === 'string' ? saved.phone : '',
            addressLine1: typeof saved.addressLine1 === 'string' ? saved.addressLine1 : '',
            addressLine2: typeof saved.addressLine2 === 'string' ? saved.addressLine2 : '',
            city: typeof saved.city === 'string' ? saved.city : '',
            province: typeof saved.province === 'string' ? saved.province : '',
            postalCode: typeof saved.postalCode === 'string' ? saved.postalCode : '',
            birthday: typeof saved.birthday === 'string' ? saved.birthday : '',
            marketingConsent: saved.marketingConsent === true,
          });
          if (activeUserId.current === next.uid) setLoading(false);
        },
        failure => {
          if (activeUserId.current !== next.uid) return;
          setError(failure instanceof Error ? failure.message : String(failure));
          setLoading(false);
        },
      );
    }, failure => {
      setError(failure.message);
      setLoading(false);
    });
    return () => {
      unsubscribe();
      unsubscribeProfile?.();
    };
  }, [verifyAdmin]);

  const requireAuth = () => {
    if (!supabase) throw new Error('Supabase Authentication is not configured.');
    return supabase.auth;
  };
  const signIn = async (email: string, password: string) => {
    await protectForm();
    await signInWithEmailAndPassword({ get currentUser() { return user; } }, email.trim(), password);
  };
  const ensureCustomerSession = async () => {
    const current = requireAuth();
    const { data, error: sessionError } = await current.getSession();
    if (sessionError) throw sessionError;
    if (data.session?.user) {
      const { data: mapped, error: userError } = await current.getUser();
      if (userError) throw userError;
      if (mapped.user) {
        // The listener keeps the public context user in sync; return the same
        // compatibility shape used by the storefront.
        return await new Promise<User>((resolve, reject) => {
          const unsubscribe = onAuthStateChanged({ get currentUser() { return user; } }, next => {
            unsubscribe();
            if (next) resolve(next);
            else reject(new Error('Unable to restore the Supabase customer session.'));
          }, reject);
        });
      }
    }
    return (await signInAnonymously({ get currentUser() { return user; } })).user;
  };
  const continueAsGuest = async () => {
    await protectForm();
    await ensureCustomerSession();
  };
  const signUp = async (name: string, email: string, password: string, marketingConsent = false) => {
    await protectForm();
    const displayName = sanitizeText(name, 120).trim();
    const credential = await createUserWithEmailAndPassword(
      { get currentUser() { return user; } },
      email.trim(),
      password,
    );
    const { data: sessionData, error: sessionError } = await requireAuth().getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) {
      throw new Error('Check your email to confirm your account, then sign in to continue.');
    }
    await updateProfile(credential.user, { displayName });
    await saveNormalizedProfile(credential.user.uid, {
      display_name: displayName,
      phone: '',
      address_line1: '',
      address_line2: '',
      city: '',
      province: '',
      postal_code: '',
      marketing_consent: marketingConsent === true,
    });
    await setDoc(doc(supabase, 'users', credential.user.uid), {
      uid: credential.user.uid,
      displayName,
      email: credential.user.email,
      marketingConsent: marketingConsent === true,
      admin: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    setUser(credential.user);
  };
  const resetPassword = async (email: string) => {
    await protectForm();
    await sendPasswordResetEmail({ get currentUser() { return user; } }, email.trim());
  };
  const signOut = async () => {
    await supabaseSignOut({ get currentUser() { return user; } });
  };

  const saveProfile = async (draft: CustomerProfile) => {
    const { data, error: userError } = await requireAuth().getUser();
    if (userError) throw userError;
    const active = data.user;
    if (!active) throw new Error('Sign in first.');
    const displayName = sanitizeText(draft.displayName, 120).trim();
    if (!displayName) throw new Error('Enter your name.');
    const cleanProfile = {
      displayName,
      phone: sanitizeText(draft.phone, 25).trim(),
      addressLine1: sanitizeText(draft.addressLine1, 240).trim(),
      addressLine2: sanitizeText(draft.addressLine2, 240).trim(),
      city: sanitizeText(draft.city, 80).trim(),
      province: sanitizeText(draft.province, 80).trim(),
      postalCode: sanitizeText(draft.postalCode, 20).trim(),
      birthday: sanitizeText(draft.birthday, 10).trim(),
      marketingConsent: draft.marketingConsent === true,
    };
    await protectForm();
    const reference = doc(supabase, 'users', active.id);
    const snapshot = await getDoc(reference);
    const timestamp = serverTimestamp();
    if (snapshot.exists()) await updateDoc(reference, { ...cleanProfile, updatedAt: timestamp });
    else await setDoc(reference, {
      uid: active.id,
      email: active.email,
      ...cleanProfile,
      admin: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    await saveNormalizedProfile(active.id, {
      display_name: cleanProfile.displayName,
      phone: cleanProfile.phone,
      address_line1: cleanProfile.addressLine1,
      address_line2: cleanProfile.addressLine2,
      city: cleanProfile.city,
      province: cleanProfile.province,
      postal_code: cleanProfile.postalCode,
      birthday: cleanProfile.birthday || null,
      marketing_consent: cleanProfile.marketingConsent,
    });
    await updateProfile(user!, { displayName });
  };

  const upgradeGuestAccount = async (name: string, email: string, password: string, draft: CustomerProfile) => {
    const { data, error: userError } = await requireAuth().getUser();
    if (userError) throw userError;
    const active = user;
    if (!active?.isAnonymous || !data.user || data.user.id !== active.uid) {
      throw new Error('This guest session is no longer available.');
    }
    const displayName = sanitizeText(name, 120).trim();
    const cleanEmail = email.trim().toLowerCase();
    if (!displayName) throw new Error('Enter your name.');
    if (password.length < 8) throw new Error('Choose a password with at least 8 characters.');
    await protectForm();
    const credential = await linkWithCredential(active, EmailAuthProvider.credential(cleanEmail, password));
    await credential.user.getIdToken(true);
    await updateProfile(credential.user, { displayName });
    const cleanProfile = {
      displayName,
      phone: sanitizeText(draft.phone, 25).trim(),
      addressLine1: sanitizeText(draft.addressLine1, 240).trim(),
      addressLine2: sanitizeText(draft.addressLine2, 240).trim(),
      city: sanitizeText(draft.city, 80).trim(),
      province: sanitizeText(draft.province, 80).trim(),
      postalCode: sanitizeText(draft.postalCode, 20).trim(),
      birthday: '',
      marketingConsent: false,
    };
    const reference = doc(supabase, 'users', credential.user.uid);
    const timestamp = serverTimestamp();
    await setDoc(reference, {
      uid: credential.user.uid,
      email: credential.user.email,
      ...cleanProfile,
      admin: false,
      createdAt: timestamp,
      updatedAt: timestamp,
    }, { merge: true });
    await saveNormalizedProfile(credential.user.uid, {
      display_name: cleanProfile.displayName,
      phone: cleanProfile.phone,
      address_line1: cleanProfile.addressLine1,
      address_line2: cleanProfile.addressLine2,
      city: cleanProfile.city,
      province: cleanProfile.province,
      postal_code: cleanProfile.postalCode,
      birthday: null,
      marketing_consent: false,
    });
    setUser(credential.user);
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAdmin,
      adminCheckStatus,
      adminCheckError,
      retryAdminCheck,
      loading,
      error,
      profile,
      saveProfile,
      ensureCustomerSession,
      upgradeGuestAccount,
      continueAsGuest,
      signIn,
      signUp,
      resetPassword,
      signOut,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('AuthProvider is required');
  return value;
}

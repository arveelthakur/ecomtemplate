import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const environment = import.meta.env;
const configuredUrl = environment.VITE_SUPABASE_URL?.trim() || '';
const configuredAnonKey = environment.VITE_SUPABASE_ANON_KEY?.trim() || '';

export const missingSupabaseConfiguration = [
  ...(!configuredUrl ? ['VITE_SUPABASE_URL'] : []),
  ...(!configuredAnonKey ? ['VITE_SUPABASE_ANON_KEY'] : []),
];
export const supabaseConfigured = missingSupabaseConfiguration.length === 0;

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(configuredUrl, configuredAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
        storageKey: 'nura-supabase-auth',
      },
      global: {
        headers: { 'x-application-name': 'nura-storefront' },
      },
    })
  : null;

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error(`Supabase is not configured. Add ${missingSupabaseConfiguration.join(' and ')} to the environment.`);
  }
  return supabase;
}

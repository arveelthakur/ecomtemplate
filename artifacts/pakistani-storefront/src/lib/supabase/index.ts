import { supabase, supabaseConfigured, missingSupabaseConfiguration } from './client';
import { auth } from './auth';
import { functions } from './functions';
import { getSupabaseStorage as getStorageClient } from './storage';

export const app = supabase;
export const db = supabase;
export const appCheck = null;
export const appCheckBypassed = false;
export const backendProvider = 'supabase' as const;
export { auth, functions, supabase, supabaseConfigured, missingSupabaseConfiguration };
export const getSupabaseStorage = async () => getStorageClient();

// Supabase Auth and the Vercel API enforce authentication, RLS and rate limits
// server-side. Client-side checks are deliberately not treated as authorization.
export async function protectForm() {}
export function useRecaptcha() { return { protectForm }; }

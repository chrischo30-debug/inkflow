import { createClient } from '@supabase/supabase-js';

/**
 * Service-role Supabase client. Bypasses RLS.
 * Use for server-side operations that legitimately need to see across users
 * (e.g. global slug uniqueness checks). Never expose to client code.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  }
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

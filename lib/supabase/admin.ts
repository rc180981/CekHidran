import { createClient } from '@supabase/supabase-js';

/**
 * Client service-role: MELEWATI RLS. Hanya dipakai di server setelah
 * requirePermission('kelola_pengguna') untuk operasi Auth Admin.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY belum diatur');
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

import { cache } from 'react';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { can, isRole, type Actor, type Permission } from '@/lib/rbac';

export interface CurrentUser extends Actor {
  email: string;
  name: string;
}

/** Pengguna aktif + peran + gudang yang ditugaskan (dibaca dari DB, bukan dari klien). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: wh }] = await Promise.all([
    supabase.from('profiles').select('name, role, active').eq('id', user.id).maybeSingle(),
    supabase.from('user_warehouses').select('warehouse_id').eq('user_id', user.id),
  ]);
  if (!profile || !profile.active || !isRole(profile.role)) return null;

  return {
    id: user.id,
    email: user.email ?? '',
    name: profile.name,
    role: profile.role,
    warehouseIds: (wh ?? []).map((r: { warehouse_id: string }) => r.warehouse_id),
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) redirect('/login');
  return u;
}

/** Untuk Server Components & Server Actions: alihkan bila tidak berhak. */
export async function requirePermission(permission: Permission): Promise<CurrentUser> {
  const u = await requireUser();
  if (!can(u.role, permission)) redirect('/tidak-diizinkan');
  return u;
}

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
  }
}

/** Untuk Route Handlers: lempar AuthError (401/403). */
export async function assertPermission(permission: Permission): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new AuthError(401, 'Sesi berakhir, silakan masuk kembali.');
  if (!can(u.role, permission)) throw new AuthError(403, 'Anda tidak memiliki akses untuk tindakan ini.');
  return u;
}

export function errorResponse(e: unknown) {
  if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: 'Terjadi kesalahan pada server.' }, { status: 500 });
}

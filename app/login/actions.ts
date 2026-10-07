'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export interface LoginState {
  error?: string;
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) return { error: 'Email dan kata sandi wajib diisi.' };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: 'Email atau kata sandi salah.' };

  const { data: profile } = await supabase.from('profiles').select('active').eq('id', data.user.id).maybeSingle();
  if (!profile?.active) {
    await supabase.auth.signOut();
    return { error: 'Akun Anda tidak aktif. Hubungi admin sistem.' };
  }

  const next = String(formData.get('next') ?? '');
  redirect(next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? next : '/');
}

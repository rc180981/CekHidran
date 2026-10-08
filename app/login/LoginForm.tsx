'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { homePath } from '@/lib/rbac';
import type { Role } from '@/lib/rbac';

export default function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const userDoc = await getDoc(doc(db, 'profiles', cred.user.uid));
      
      if (!userDoc.exists() || !userDoc.data().active) {
        setError('Akun Anda tidak aktif atau profil belum terdaftar.');
        setLoading(false);
        return;
      }

      const role = userDoc.data().role as Role;
      const targetNext = next || searchParams.get('next');
      
      if (targetNext && targetNext.startsWith('/') && !targetNext.startsWith('/login')) {
        router.push(targetNext);
      } else {
        router.push(homePath(role));
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Email atau kata sandi salah.');
      } else {
        setError('Gagal masuk. Periksa koneksi internet Anda.');
      }
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="label">Email Petugas</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input"
          placeholder="admin@cekhidran.id / petugas@cekhidran.id"
        />
      </div>
      <div>
        <label htmlFor="password" className="label">Kata Sandi</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-800 border border-red-200">
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-primary btn-lg w-full">
        {loading ? 'Memeriksa kredensial…' : 'Masuk ke Sistem'}
      </button>

      {/* Akun Contoh Cepat (Quick Hint) */}
      <div className="pt-2 text-[11px] text-slate-500 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
        <strong className="block text-slate-700">Akun Contoh Tersedia:</strong>
        <div>• <strong>Admin</strong>: admin@cekhidran.id (Admin#12345)</div>
        <div>• <strong>Petugas WH2</strong>: petugas@cekhidran.id (Petugas#12345)</div>
        <div>• <strong>Supervisor K3</strong>: supervisor@cekhidran.id (Supervisor#12345)</div>
        <div>• <strong>Manajemen</strong>: manajemen@cekhidran.id (Manajemen#12345)</div>
      </div>
    </form>
  );
}

'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { homePath } from '@/lib/rbac';
import type { Role } from '@/lib/rbac';
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, Sparkles, Loader2 } from 'lucide-react';

const DEMO_ACCOUNTS = [
  { roleName: 'Petugas WH2', email: 'petugas@cekhidran.id', pass: 'Petugas#12345', badge: 'WH-02' },
  { roleName: 'Supervisor K3', email: 'supervisor@cekhidran.id', pass: 'Supervisor#12345', badge: 'K3 HSE' },
  { roleName: 'Admin', email: 'admin@cekhidran.id', pass: 'Admin#12345', badge: 'Full' },
  { roleName: 'Manajemen', email: 'manajemen@cekhidran.id', pass: 'Manajemen#12345', badge: 'Read' },
];

export default function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const fillDemoAccount = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      const userDoc = await getDoc(doc(db, 'profiles', cred.user.uid));
      
      if (!userDoc.exists() || !userDoc.data().active) {
        setError('Akun Anda tidak aktif atau profil belum terdaftar di sistem.');
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
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password'
      ) {
        setError('Email atau kata sandi tidak sesuai.');
      } else if (err.code === 'auth/network-request-failed') {
        setError('Koneksi internet bermasalah. Periksa jaringan Anda.');
      } else {
        setError('Gagal masuk ke sistem. Silakan coba sesaat lagi.');
      }
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Input Email */}
      <div>
        <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
          Email Petugas
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Mail className="h-4 w-4" />
          </div>
          <input
            id="email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input pl-10 h-12 w-full text-sm font-medium rounded-xl border-slate-300 bg-white placeholder:text-slate-400 focus:border-primary focus:ring-primary/20 transition-all"
            placeholder="nama@cekhidran.id"
          />
        </div>
      </div>

      {/* Input Password */}
      <div>
        <label htmlFor="password" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
          Kata Sandi
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Lock className="h-4 w-4" />
          </div>
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input pl-10 pr-11 h-12 w-full text-sm font-medium rounded-xl border-slate-300 bg-white placeholder:text-slate-400 focus:border-primary focus:ring-primary/20 transition-all"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            tabIndex={-1}
            aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none transition-colors"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-800 border border-red-200 animate-in fade-in duration-200"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Submit Button */}
      <div className="pt-1">
        <button
          type="submit"
          disabled={loading}
          className="relative w-full h-12 rounded-xl bg-gradient-to-r from-primary to-teal-800 hover:from-primary-700 hover:to-teal-900 active:scale-[0.98] text-white font-bold text-sm tracking-wide shadow-md shadow-primary/25 transition-all flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed select-none"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>MEMERIKSA KREDENSIAL…</span>
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              <span>MASUK KE SISTEM</span>
            </>
          )}
        </button>
      </div>

      {/* Quick Demo Accounts */}
      <div className="pt-2">
        <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              Pilih Akun Demo Cepat
            </span>
            <span className="text-[10px] text-slate-400">Klik untuk isi</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {DEMO_ACCOUNTS.map((acc) => {
              const isSelected = email === acc.email;
              return (
                <button
                  key={acc.roleName}
                  type="button"
                  onClick={() => fillDemoAccount(acc.email, acc.pass)}
                  className={`flex flex-col items-start text-left p-2 rounded-lg border transition-all text-xs ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary-900 font-semibold shadow-xs ring-1 ring-primary/30'
                      : 'border-slate-200/90 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-[11px] font-bold truncate">{acc.roleName}</span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 text-slate-500 font-medium">
                      {acc.badge}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 truncate w-full mt-0.5">
                    {acc.email}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </form>
  );
}

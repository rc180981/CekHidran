'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase/client';
import { homePath } from '@/lib/rbac';
import type { Role } from '@/lib/rbac';
import { Mail, Lock, Eye, EyeOff, LogIn, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/user-not-found'
      ) {
        setError('Alamat email atau kata sandi salah. Silakan periksa kembali.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Terlalu banyak percobaan masuk yang gagal. Silakan coba lagi beberapa saat.');
      } else {
        setError(err.message || 'Gagal masuk ke sistem. Silakan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Input Email */}
      <div>
        <label htmlFor="email" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
          Email Account
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Mail className="h-4 w-4" />
          </div>
          <input
            id="email"
            type="email"
            autoComplete="email"
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
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
      <div className="pt-2">
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
    </form>
  );
}

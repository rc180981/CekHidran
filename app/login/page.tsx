import type { Metadata } from 'next';
import { Logo } from '@/components/Logo';
import LoginForm from './LoginForm';

export const metadata: Metadata = { title: 'Masuk' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={56} />
          <h1 className="mt-4 text-2xl font-extrabold tracking-wider text-slate-900 uppercase">CEK HIDRAN</h1>
          <p className="mt-1 text-xs font-semibold tracking-wider text-slate-500 uppercase">PENCATATAN PEMERIKSAAN HYDRANT BOX</p>
        </div>
        <div className="card p-6">
          <LoginForm next={next} />
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">Akun dibuat oleh Admin Sistem. Pendaftaran mandiri tidak tersedia.</p>
      </div>
    </main>
  );
}

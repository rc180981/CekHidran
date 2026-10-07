import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { homePath } from '@/lib/rbac';
import { Logo } from '@/components/Logo';
import LoginForm from './LoginForm';

export const metadata: Metadata = { title: 'Masuk' };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const user = await getCurrentUser();
  if (user) redirect(homePath(user.role));
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Logo size={56} />
          <h1 className="mt-4 text-2xl">Cek Hidran</h1>
          <p className="mt-1 text-sm text-slate-600">Pencatatan pemeriksaan Hydrant Box</p>
        </div>
        <div className="card p-6">
          <LoginForm next={next} />
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">Akun dibuat oleh Admin Sistem. Pendaftaran mandiri tidak tersedia.</p>
      </div>
    </main>
  );
}

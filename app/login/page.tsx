import type { Metadata } from 'next';
import { Logo } from '@/components/Logo';
import LoginForm from './LoginForm';
import PwaInstallGuide from '@/components/PwaInstallGuide';

export const metadata: Metadata = {
  title: 'Masuk - Cek Hidran',
  description: 'Sistem Inspeksi & Pemeriksaan Hydrant Box K3',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-[100dvh] flex-col justify-center items-center px-4 py-8 sm:px-6 sm:py-12 bg-gradient-to-b from-slate-50 via-canvas to-slate-100">
      <div className="w-full max-w-[420px] mx-auto">
        {/* Header Logo & Brand */}
        <div className="mb-6 sm:mb-8 flex flex-col items-center text-center">
          <div className="inline-flex p-3 rounded-2xl bg-white shadow-soft border border-slate-200/80 mb-3.5 transition-transform hover:scale-105">
            <Logo size={48} />
          </div>
          <h1 className="text-2xl sm:text-[26px] font-black tracking-wider text-slate-900 uppercase">
            CEK HIDRAN
          </h1>
          <p className="mt-1 text-[11px] sm:text-xs font-bold tracking-widest text-primary uppercase">
            DEPARTEMEN K3 &amp; HSE
          </p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">
            Sistem Inspeksi &amp; Pemantauan Titik Hydrant
          </p>
        </div>

        {/* Card Form */}
        <div className="card border-slate-200/80 bg-white/95 p-5 sm:p-7 shadow-lg shadow-slate-200/50 backdrop-blur-sm">
          <LoginForm next={next} />
        </div>

        {/* Panduan & Tombol Pasang di HP (PWA) */}
        <PwaInstallGuide />

        {/* Footer info */}
        <div className="mt-6 text-center">
          <p className="text-[11px] sm:text-xs font-semibold text-slate-500">
            Akses Terbatas Internal K3 &bull; Versi 1.2.0
          </p>
        </div>
      </div>

      {/* Footnote di kiri bawah layar */}
      <aside
        aria-hidden="true"
        className="fixed bottom-3 left-3 sm:bottom-4 sm:left-4 z-10 select-none pointer-events-none text-[11px] sm:text-xs font-mono font-medium tracking-widest text-slate-400/40 drop-shadow-[0_1px_1px_rgba(0,0,0,0.25)]"
      >
        RCA26
      </aside>
    </main>
  );
}

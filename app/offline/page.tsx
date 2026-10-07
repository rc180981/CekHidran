import { WifiOff } from 'lucide-react';

export const dynamic = 'force-static';

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card max-w-md p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-700">
          <WifiOff size={28} />
        </div>
        <h1 className="mt-4 text-xl">Anda sedang offline</h1>
        <p className="mt-2 text-sm text-slate-600">
          Halaman ini belum tersimpan di perangkat. Pemeriksaan yang sudah disimpan tetap aman dan akan
          dikirim otomatis saat sinyal kembali.
        </p>
        <a href="/petugas" className="btn-primary mt-6 w-full">Buka beranda petugas</a>
      </div>
    </main>
  );
}

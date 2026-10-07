import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export default function NotAllowed() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="card max-w-md p-8 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-700">
          <ShieldAlert size={28} />
        </div>
        <h1 className="mt-4 text-xl">Akses ditolak</h1>
        <p className="mt-2 text-sm text-slate-600">Peran Anda tidak memiliki izin untuk membuka halaman atau melakukan tindakan ini.</p>
        <Link href="/" className="btn-primary mt-6 w-full">Kembali ke beranda</Link>
      </div>
    </main>
  );
}

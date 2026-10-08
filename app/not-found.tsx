import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas p-4">
      <div className="card p-8 max-w-sm text-center space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Halaman Tidak Ditemukan</h2>
        <p className="text-xs text-slate-600">
          Halaman yang Anda tuju tidak tersedia atau tautan salah.
        </p>
        <Link href="/" className="btn-primary w-full text-xs">
          Kembali ke Beranda
        </Link>
      </div>
    </div>
  );
}

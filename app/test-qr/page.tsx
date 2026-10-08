import Link from 'next/link';

export default function TestQrPage() {
  const qrSamples = [
    {
      number: 'H-01',
      gudang: 'Gudang WH2',
      lokasi: 'Dalam gudang – Area Rak A 1',
      type: 'indoor',
      code: 'CEKHIDRAN:WH2:H-01',
      image: '/qr-h01.png',
    },
    {
      number: 'H-02',
      gudang: 'Gudang WH2',
      lokasi: 'Dalam gudang – Area Rak B 1',
      type: 'indoor',
      code: 'CEKHIDRAN:WH2:H-02',
      image: '/qr-h02.png',
    },
    {
      number: 'H-13',
      gudang: 'Gudang WH2',
      lokasi: 'Luar gudang – Sisi Utara',
      type: 'outdoor',
      code: 'CEKHIDRAN:WH2:H-13',
      image: '/qr-h13.png',
    },
  ];

  return (
    <div className="min-h-screen bg-canvas p-6 max-w-4xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">QR Code Uji Coba Pemeriksaan Hydrant</h1>
          <p className="text-sm text-slate-600 mt-1">
            Arahkan kamera scanner aplikasi Petugas di HP Anda ke gambar QR di bawah ini untuk memulai pengisian.
          </p>
        </div>
        <Link href="/petugas" className="btn-secondary text-xs">
          Kembali ke Petugas
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {qrSamples.map((sample) => (
          <div key={sample.number} className="card p-5 text-center space-y-3 bg-white shadow-soft border border-slate-200">
            <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-800 border border-teal-200">
              {sample.number} · {sample.gudang}
            </span>
            
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200/80 inline-block">
              <img
                src={sample.image}
                alt={`QR ${sample.number}`}
                className="w-48 h-48 mx-auto object-contain rounded-xl"
              />
            </div>

            <div className="text-xs text-slate-600 space-y-1">
              <p className="font-semibold text-slate-900">{sample.lokasi}</p>
              <p className="font-mono text-[11px] text-slate-400 bg-slate-100 p-1.5 rounded-lg select-all">
                {sample.code}
              </p>
            </div>

            <div className="pt-2">
              <Link
                href={`/petugas/periksa?qr=${encodeURIComponent(sample.code)}`}
                className="btn-primary text-xs w-full py-2"
              >
                Uji Langsung di Browser Ini →
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-900 space-y-1">
        <strong>💡 Cara Menjalankan Uji Coba:</strong>
        <ol className="list-decimal list-inside space-y-1 mt-1">
          <li>Buka menu pemeriksaan di HP Anda (klik tombol <strong>Mulai Periksa Hydrant</strong>).</li>
          <li>Arahkan kamera HP ke salah satu QR Code di layar monitor ini.</li>
          <li>Data Nomor Hydrant, Lokasi, dan Gudang akan otomatis terisi dan terverifikasi secara instan!</li>
        </ol>
      </div>
    </div>
  );
}

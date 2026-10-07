'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { QrCode, RefreshCw, CheckCircle2, AlertCircle, LogOut, ShieldCheck, MapPin } from 'lucide-react';
import { listQueue, setBundle, QUEUE_EVENT } from '@/lib/offline/db';
import { syncQueue } from '@/lib/offline/sync';
import type { PetugasBundle, QueuedInspection } from '@/lib/types';
import { Logo } from '@/components/Logo';
import { LocationTag, StatusBadge } from '@/components/ui';

export default function PetugasClientDashboard({ initialBundle }: { initialBundle: PetugasBundle }) {
  const searchParams = useSearchParams();
  const showSuccess = searchParams.get('sukses') === '1';

  const [bundle, setBundleState] = useState<PetugasBundle>(initialBundle);
  const [queue, setQueue] = useState<QueuedInspection[]>([]);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // Simpan bundle awal ke IndexedDB untuk cadangan offline
  useEffect(() => {
    setBundle(initialBundle);
  }, [initialBundle]);

  const loadQueue = async () => {
    try {
      const q = await listQueue();
      setQueue(q);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadQueue();
    const onQueueChange = () => loadQueue();
    window.addEventListener(QUEUE_EVENT, onQueueChange);
    window.addEventListener('online', triggerSync);
    return () => {
      window.removeEventListener(QUEUE_EVENT, onQueueChange);
      window.removeEventListener('online', triggerSync);
    };
  }, []);

  const triggerSync = async () => {
    if (!navigator.onLine) {
      setSyncMsg('Perangkat masih dalam keadaan offline.');
      return;
    }
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await syncQueue();
      if (res.sent > 0) {
        setSyncMsg(`${res.sent} pemeriksaan berhasil disinkronkan ke server!`);
      } else if (res.remaining === 0) {
        setSyncMsg('Semua data sudah tersinkronkan.');
      } else if (res.authRequired) {
        setSyncMsg('Sesi login telah berakhir. Silakan masuk kembali.');
      }
      loadQueue();
    } catch (err: any) {
      setSyncMsg('Gagal menyinkronkan data.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
        <div className="flex items-center gap-3">
          <Logo size={42} />
          <div>
            <h1 className="text-lg font-bold text-slate-900 leading-tight">Cek Hidran</h1>
            <p className="text-xs text-slate-500">Antarmuka Petugas Lapangan</p>
          </div>
        </div>
        <form action="/auth/keluar" method="post">
          <button
            type="submit"
            className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-xl transition"
            title="Keluar Akun"
          >
            <LogOut size={20} />
          </button>
        </form>
      </div>

      {showSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-900 flex items-start gap-2.5">
          <CheckCircle2 size={18} className="text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <strong>Pemeriksaan Berhasil Disimpan!</strong>
            <p className="mt-0.5 text-emerald-800">
              Data pemeriksaan telah tercatat dan tersimpan dengan aman (lokal / server).
            </p>
          </div>
        </div>
      )}

      {/* Profil Singkat & Status Antrean */}
      <div className="card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-500">Petugas Masuk</p>
            <p className="text-sm font-bold text-slate-800">{bundle.user.name}</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 bg-primary-50 text-primary-800 rounded-full">
            Frekuensi: {bundle.frequency === 'bulanan' ? 'Bulanan' : 'Harian'}
          </span>
        </div>

        {/* Antrean Offline Widget */}
        <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                queue.length > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
              }`}
            />
            <span className="text-xs font-medium text-slate-700">
              Antrean Offline: <strong>{queue.length}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={triggerSync}
            disabled={syncing || queue.length === 0}
            className="btn-secondary text-xs min-h-[32px] px-2.5 py-1"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sinkron…' : 'Sinkronkan'}
          </button>
        </div>

        {syncMsg && (
          <p className="text-xs text-slate-600 bg-slate-100 p-2 rounded-lg text-center font-medium">
            {syncMsg}
          </p>
        )}
      </div>

      {/* Tombol Utama: Mulai Pemeriksaan */}
      <div>
        <Link href="/petugas/periksa" className="btn-primary btn-lg w-full shadow-md text-base">
          <QrCode size={22} /> Mulai Periksa Hydrant (Scan QR)
        </Link>
      </div>

      {/* Daftar Titik Hydrant Ditugaskan */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Titik Hydrant yang Ditugaskan</h2>
          <span className="text-xs font-medium text-slate-500">{bundle.hydrants.length} Titik</span>
        </div>

        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
          {bundle.hydrants.map((h) => (
            <div
              key={h.id}
              className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-primary-200 transition space-y-1.5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">
                  {h.number} <span className="text-xs font-normal text-slate-500">({h.warehouse_name})</span>
                </span>
                <LocationTag type={h.location_type} />
              </div>
              <p className="text-xs text-slate-600 flex items-center gap-1">
                <MapPin size={13} className="text-slate-400 shrink-0" />
                <span className="truncate">{h.location_name}</span>
              </p>
            </div>
          ))}

          {bundle.hydrants.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
              Belum ada gudang yang ditugaskan ke akun Anda. Hubungi Admin Sistem.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

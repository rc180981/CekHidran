'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { QrCode, RefreshCw, CheckCircle2, AlertCircle, LogOut, ShieldCheck, MapPin, Building2 } from 'lucide-react';
import { listQueue, setBundle, QUEUE_EVENT } from '@/lib/offline/db';
import { syncQueue } from '@/lib/offline/sync';
import type { PetugasBundle, QueuedInspection } from '@/lib/types';
import { Logo } from '@/components/Logo';
import { LocationTag, StatusBadge } from '@/components/ui';
import LogoutButton from '@/components/LogoutButton';

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

  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>('all');

  // Ambil daftar nama gudang penugasan unik
  const assignedWarehouses: string[] = (() => {
    if (bundle.user.warehouseNames && bundle.user.warehouseNames.length > 0) {
      return Array.from(new Set(bundle.user.warehouseNames));
    }
    const fromHydrants = Array.from(
      new Set(bundle.hydrants.map((h) => h.warehouse_name).filter(Boolean))
    );
    if (fromHydrants.length > 0) return fromHydrants;
    if (bundle.user.warehouseIds && bundle.user.warehouseIds.length > 0) {
      return bundle.user.warehouseIds.map((id) => id.toUpperCase());
    }
    return ['SEMUA GUDANG'];
  })();

  // Filter daftar titik berdasarkan gudang bila ada pilihan
  const filteredHydrants = bundle.hydrants.filter((h) => {
    if (selectedWarehouseFilter === 'all') return true;
    const cleanWh = h.warehouse_name.replace(/^gudang\s+/i, '').trim().toLowerCase();
    const cleanFilter = selectedWarehouseFilter.replace(/^gudang\s+/i, '').trim().toLowerCase();
    return cleanWh === cleanFilter || h.warehouse_id?.toLowerCase() === cleanFilter;
  });

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-4">
        <div className="flex items-center gap-3">
          <Logo size={42} />
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 leading-tight tracking-wider uppercase">CEK HIDRAN</h1>
            <p className="text-[11px] font-semibold text-slate-500 tracking-wider uppercase">ANTARMUKA PETUGAS LAPANGAN</p>
          </div>
        </div>
        <LogoutButton />
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

      {/* Profil Singkat, Lokasi WH & Status Antrean */}
      <div className="card p-4 space-y-3.5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">PETUGAS MASUK</p>
            <p className="text-base font-extrabold text-slate-900">{bundle.user.name}</p>
            <span className="inline-block mt-0.5 text-[10px] font-bold text-slate-500 uppercase tracking-wide">
              ROLE: {bundle.user.role === 'petugas' ? 'PETUGAS LAPANGAN' : bundle.user.role.toUpperCase()}
            </span>
          </div>
          <span className="text-[11px] font-bold px-2.5 py-1 bg-primary-50 text-primary-800 rounded-full uppercase border border-primary-100">
            FREKUENSI: {bundle.frequency === 'bulanan' ? 'BULANAN' : 'HARIAN'}
          </span>
        </div>

        {/* Informasi Lokasi Gudang (WH) Penugasan */}
        <div className="rounded-xl bg-teal-50/80 border border-teal-200/90 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
              <Building2 size={15} className="text-teal-700 shrink-0" />
              LOKASI GUDANG PENUGASAN (WH)
            </span>
            <span className="text-[10px] font-extrabold text-teal-800 bg-teal-100 px-2 py-0.5 rounded-md">
              {assignedWarehouses.length} GUDANG
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {assignedWarehouses.map((wh) => {
              const cleanWh = wh.replace(/^gudang\s+/i, '').trim();
              const countInWh = bundle.hydrants.filter(
                (h) => h.warehouse_name.replace(/^gudang\s+/i, '').trim().toLowerCase() === cleanWh.toLowerCase()
              ).length;
              return (
                <span
                  key={wh}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white text-teal-950 border border-teal-300 text-xs font-black uppercase tracking-wider shadow-2xs"
                >
                  <span className="h-2 w-2 rounded-full bg-teal-600 shrink-0" />
                  GUDANG {cleanWh}
                  {countInWh > 0 && (
                    <span className="text-[10px] font-bold text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">
                      {countInWh} TITIK
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        </div>

        {/* Antrean Offline Widget */}
        <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                queue.length > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
              }`}
            />
            <span className="text-xs font-semibold text-slate-700 uppercase">
              ANTREAN OFFLINE: <strong>{queue.length}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={triggerSync}
            disabled={syncing || queue.length === 0}
            className="btn-secondary text-xs min-h-[32px] px-2.5 py-1 uppercase font-bold"
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
        <Link href="/petugas/periksa" className="btn-primary btn-lg w-full shadow-md text-sm font-bold tracking-wider uppercase">
          <QrCode size={20} /> MULAI PERIKSA HYDRANT (SCAN QR)
        </Link>
      </div>

      {/* Daftar Titik Hydrant Ditugaskan */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-slate-900 tracking-wider uppercase">TITIK HYDRANT YANG DITUGASKAN</h2>
          <span className="text-xs font-bold text-slate-500 uppercase">{filteredHydrants.length} TITIK</span>
        </div>

        {/* Filter Tab Gudang jika lebih dari 1 gudang */}
        {assignedWarehouses.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <button
              type="button"
              onClick={() => setSelectedWarehouseFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-bold uppercase transition whitespace-nowrap ${
                selectedWarehouseFilter === 'all'
                  ? 'bg-primary text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              SEMUA ({bundle.hydrants.length})
            </button>
            {assignedWarehouses.map((wh) => {
              const cleanWh = wh.replace(/^gudang\s+/i, '').trim();
              const isSelected = selectedWarehouseFilter.toLowerCase() === cleanWh.toLowerCase();
              const countInWh = bundle.hydrants.filter(
                (h) => h.warehouse_name.replace(/^gudang\s+/i, '').trim().toLowerCase() === cleanWh.toLowerCase()
              ).length;
              return (
                <button
                  key={wh}
                  type="button"
                  onClick={() => setSelectedWarehouseFilter(cleanWh)}
                  className={`px-3 py-1.5 rounded-lg font-bold uppercase transition whitespace-nowrap ${
                    isSelected
                      ? 'bg-primary text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  WH {cleanWh} ({countInWh})
                </button>
              );
            })}
          </div>
        )}

        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
          {filteredHydrants.map((h) => (
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

          {filteredHydrants.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
              Tidak ada titik hydrant untuk filter ini. Hubungi Admin Sistem.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, useMemo } from 'react';
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

  // State pilihan filter gudang (droplist)
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');

  // Opsi droplist gudang yang ditugaskan
  const warehouseOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string; count: number }>();

    bundle.hydrants.forEach((h) => {
      const rawId = (h.warehouse_id || '').toLowerCase().trim();
      const rawName = (h.warehouse_name || rawId)
        .replace(/^gudang\s+/i, '')
        .trim()
        .toUpperCase();
      const key = rawId || rawName.toLowerCase();

      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          id: key,
          name: rawName || key.toUpperCase(),
          count: 1,
        });
      }
    });

    // Masukkan warehouseIds dari akun jika ada yang belum memiliki titik
    (bundle.user.warehouseIds || []).forEach((wId) => {
      const key = wId.toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, {
          id: key,
          name: key.toUpperCase(),
          count: 0,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [bundle.hydrants, bundle.user.warehouseIds]);

  // Filter daftar titik hydrant sesuai droplist yang dipilih
  const filteredHydrants = useMemo(() => {
    if (selectedWarehouse === 'all') return bundle.hydrants;
    return bundle.hydrants.filter((h) => {
      const rawId = (h.warehouse_id || '').toLowerCase().trim();
      const rawName = (h.warehouse_name || '')
        .replace(/^gudang\s+/i, '')
        .trim()
        .toLowerCase();
      const target = selectedWarehouse.toLowerCase().trim();
      return (
        rawId === target ||
        rawName === target ||
        rawId.includes(target) ||
        target.includes(rawId)
      );
    });
  }, [bundle.hydrants, selectedWarehouse]);

  // Label nama gudang terpilih
  const selectedLabel = useMemo(() => {
    if (selectedWarehouse === 'all') return 'SEMUA GUDANG';
    const opt = warehouseOptions.find((w) => w.id === selectedWarehouse);
    return opt ? `GUDANG ${opt.name}` : `GUDANG ${selectedWarehouse.toUpperCase()}`;
  }, [selectedWarehouse, warehouseOptions]);

  return (
    <div className="space-y-4">
      {/* 1. Header Atas Aplikasi */}
      <div className="flex items-center justify-between border-b border-slate-200/70 pb-3.5">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <div>
            <h1 className="text-base font-extrabold text-slate-900 leading-tight tracking-wider uppercase">
              CEK HIDRAN
            </h1>
            <p className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">
              ANTARMUKA PETUGAS LAPANGAN
            </p>
          </div>
        </div>
        <LogoutButton />
      </div>

      {/* 2. Alert Status Sukses Pemeriksaan */}
      {showSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-medium text-emerald-900 flex items-start gap-2.5 shadow-2xs">
          <CheckCircle2 size={18} className="text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <strong className="font-extrabold tracking-wide uppercase">PEMERIKSAAN BERHASIL DISIMPAN!</strong>
            <p className="mt-0.5 text-emerald-800 text-[11px]">
              Data pemeriksaan telah tercatat dan tersimpan dengan aman (lokal / server).
            </p>
          </div>
        </div>
      )}

      {/* 3. Kartu Profil Petugas & Penugasan Akun */}
      <div className="card p-4 space-y-3 shadow-soft">
        {/* Identitas Petugas */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div>
            <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider">
              PETUGAS MASUK
            </p>
            <p className="text-sm font-extrabold text-slate-900">
              {bundle.user.name}
            </p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
              ROLE: {bundle.user.role === 'petugas' ? 'PETUGAS LAPANGAN' : bundle.user.role.toUpperCase()}
            </p>
          </div>
          <span className="text-[10px] font-extrabold px-2.5 py-1 bg-teal-50 text-teal-800 border border-teal-200 rounded-full uppercase tracking-wider">
            FREKUENSI: {bundle.frequency === 'bulanan' ? 'BULANAN' : 'HARIAN'}
          </span>
        </div>

        {/* Info Gudang Penugasan Akun */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Building2 size={14} className="text-primary-700 shrink-0" />
            PENUGASAN AREA:
          </span>
          <div className="flex flex-wrap gap-1 justify-end">
            {warehouseOptions.map((w) => (
              <span
                key={w.id}
                className="text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200 uppercase tracking-wider"
              >
                WH {w.name}
              </span>
            ))}
          </div>
        </div>

        {/* Antrean Offline Widget */}
        <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                queue.length > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
              }`}
            />
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
              ANTREAN OFFLINE: <strong>{queue.length}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={triggerSync}
            disabled={syncing || queue.length === 0}
            className="btn-secondary text-xs min-h-[30px] px-2.5 py-1 uppercase font-bold"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            {syncing ? 'Sinkron…' : 'Sinkronkan'}
          </button>
        </div>

        {syncMsg && (
          <p className="text-xs text-slate-600 bg-slate-100 p-2 rounded-lg text-center font-medium">
            {syncMsg}
          </p>
        )}
      </div>

      {/* 4. Droplist Pilihan Gudang (WH) */}
      <div className="card p-3.5 space-y-2.5 border-teal-200/90 bg-white shadow-soft">
        <div className="flex items-center justify-between">
          <label
            htmlFor="warehouse-select"
            className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5"
          >
            <Building2 size={15} className="text-primary-700 shrink-0" />
            PILIH LOKASI GUDANG (WH):
          </label>
          <span className="text-[10px] font-extrabold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md uppercase">
            {selectedWarehouse === 'all' ? 'SEMUA WH' : `WH ${selectedWarehouse.toUpperCase()}`}
          </span>
        </div>

        {/* Droplist Element */}
        <div className="relative">
          <select
            id="warehouse-select"
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="w-full min-h-[46px] appearance-none rounded-xl border-2 border-slate-300 bg-white px-3.5 pr-10 text-xs font-extrabold text-slate-900 tracking-wider uppercase transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20 cursor-pointer shadow-2xs"
          >
            <option value="all">
              SEMUA GUDANG (TOTAL {bundle.hydrants.length} TITIK)
            </option>
            {warehouseOptions.map((wh) => (
              <option key={wh.id} value={wh.id}>
                GUDANG {wh.name} ({wh.count} TITIK)
              </option>
            ))}
          </select>
          {/* Custom Arrow Icon */}
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-500">
            <svg
              className="h-4 w-4 fill-current"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
            >
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </div>
        </div>

        {/* Keterangan Status Filter Aktif */}
        <div className="rounded-lg bg-teal-50/90 border border-teal-200 px-3 py-2 flex items-center justify-between text-xs">
          <span className="text-[11px] font-extrabold text-teal-900 uppercase tracking-wide">
            {selectedWarehouse === 'all'
              ? `MENAMPILKAN SEMUA TITIK HYDRANT`
              : `HANYA MENAMPILKAN TITIK ${selectedLabel}`}
          </span>
          <span className="text-[11px] font-black text-teal-800 bg-white px-2 py-0.5 rounded border border-teal-200 shadow-2xs">
            {filteredHydrants.length} TITIK
          </span>
        </div>
      </div>

      {/* 5. Tombol Utama: Mulai Pemeriksaan (Scan QR) */}
      <div>
        <Link
          href="/petugas/periksa"
          className="btn-primary btn-lg w-full shadow-md text-sm font-extrabold tracking-wider uppercase gap-2.5 justify-center"
        >
          <QrCode size={20} className="shrink-0" />
          MULAI PERIKSA HYDRANT (SCAN QR)
        </Link>
      </div>

      {/* 6. Daftar Titik Hydrant yang Ditampilkan Sesuai Pilihan Droplist */}
      <div className="space-y-2.5 pt-1">
        <div className="flex items-center justify-between px-0.5">
          <h2 className="text-xs font-extrabold text-slate-900 tracking-wider uppercase">
            DAFTAR TITIK HYDRANT {selectedWarehouse !== 'all' ? `(${selectedLabel})` : ''}
          </h2>
          <span className="text-xs font-black text-slate-600 uppercase bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
            {filteredHydrants.length} TITIK
          </span>
        </div>

        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          {filteredHydrants.map((h) => (
            <div
              key={h.id}
              className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-primary-300 transition space-y-1.5 shadow-2xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-900 uppercase tracking-wide">
                    {h.number}
                  </span>
                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                    GUDANG {h.warehouse_name.replace(/^gudang\s+/i, '').trim()}
                  </span>
                </div>
                <LocationTag type={h.location_type} />
              </div>

              <p className="text-xs text-slate-600 flex items-center gap-1.5 pt-0.5">
                <MapPin size={13} className="text-slate-400 shrink-0" />
                <span className="truncate font-medium">{h.location_name}</span>
              </p>
            </div>
          ))}

          {filteredHydrants.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl bg-white space-y-1">
              <p className="font-bold text-slate-700">TIDAK ADA TITIK HYDRANT DITEMUKAN</p>
              <p className="text-[11px] text-slate-500">
                Tidak ada titik hydrant yang terdaftar untuk {selectedLabel}. Silakan pilih gudang lainnya.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

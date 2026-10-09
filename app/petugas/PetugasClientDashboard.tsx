'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  QrCode,
  RefreshCw,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building2,
  MapPin,
  Calendar,
  Check,
} from 'lucide-react';
import { listQueue, setBundle, QUEUE_EVENT } from '@/lib/offline/db';
import { syncQueue } from '@/lib/offline/sync';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { jakartaDate } from '@/lib/period';
import type { PetugasBundle, QueuedInspection } from '@/lib/types';
import { Logo } from '@/components/Logo';
import { LocationTag } from '@/components/ui';
import LogoutButton from '@/components/LogoutButton';

function formatCheckDateTime(dateInput: string | Date | undefined): string {
  if (!dateInput) return '-';
  try {
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return String(dateInput);
    return (
      new Intl.DateTimeFormat('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Jakarta',
      }).format(d) + ' WIB'
    );
  } catch {
    return String(dateInput);
  }
}

export default function PetugasClientDashboard({ initialBundle }: { initialBundle: PetugasBundle }) {
  const searchParams = useSearchParams();
  const showSuccess = searchParams.get('sukses') === '1';

  const [bundle, setBundleState] = useState<PetugasBundle>(initialBundle);
  const [queue, setQueue] = useState<QueuedInspection[]>([]);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  // Inspeksi yang dilakukan hari ini (dari server Firestore)
  const [todayInspections, setTodayInspections] = useState<any[]>([]);

  // State pilihan gudang (droplist)
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('all');

  // Tab aktif tampilan daftar: 'checked' (default) atau 'unchecked'
  const [activeTab, setActiveTab] = useState<'checked' | 'unchecked'>('checked');

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

  const loadTodayInspections = async () => {
    try {
      const todayStr = jakartaDate();
      const snap = await getDocs(collection(db, 'inspections'));
      const list: any[] = [];
      snap.forEach((doc) => {
        const data = doc.data();
        const insDate = (data.inspected_at || '').slice(0, 10);
        if (insDate === todayStr) {
          list.push({ ...data, id: doc.id });
        }
      });
      setTodayInspections(list);
    } catch (e) {
      console.error('Error fetching today inspections:', e);
    }
  };

  useEffect(() => {
    loadQueue();
    loadTodayInspections();

    const onQueueChange = () => {
      loadQueue();
      loadTodayInspections();
    };

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
      loadTodayInspections();
    } catch (err: any) {
      setSyncMsg('Gagal menyinkronkan data.');
    } finally {
      setSyncing(false);
    }
  };

  // Opsi droplist gudang
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

  // Gabungkan inspeksi Firestore hari ini dengan antrean offline hari ini
  const todayStr = jakartaDate();
  const combinedInspectedMap = useMemo(() => {
    const map = new Map<
      string,
      { inspectedAt: string; notes?: string; status?: string; isOfflineQueue?: boolean }
    >();

    // 1. Dari Firestore hari ini
    todayInspections.forEach((ins) => {
      const hydId = ins.hydrant_id;
      if (hydId) {
        map.set(hydId, {
          inspectedAt: ins.inspected_at,
          notes: ins.notes,
          status: ins.status,
          isOfflineQueue: false,
        });
      }
    });

    // 2. Dari Queue offline (IndexedDB)
    queue.forEach((q) => {
      const qDate = (q.inspectedAt || '').slice(0, 10);
      if (qDate === todayStr || !qDate) {
        map.set(q.hydrantId, {
          inspectedAt: q.inspectedAt || q.createdAt,
          notes: q.notes,
          status: 'antrean_offline',
          isOfflineQueue: true,
        });
      }
    });

    return map;
  }, [todayInspections, queue, todayStr]);

  // Titik yang cocok dengan filter WH di droplist
  const hydrantsInFilter = useMemo(() => {
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

  // Daftar titik yang SUDAH dicek hari ini
  const checkedHydrants = useMemo(() => {
    return hydrantsInFilter
      .filter((h) => combinedInspectedMap.has(h.id))
      .map((h) => {
        const info = combinedInspectedMap.get(h.id);
        return {
          ...h,
          inspectedAt: info?.inspectedAt,
          notes: info?.notes,
          status: info?.status,
          isOfflineQueue: info?.isOfflineQueue,
        };
      })
      .sort((a, b) => (b.inspectedAt || '').localeCompare(a.inspectedAt || ''));
  }, [hydrantsInFilter, combinedInspectedMap]);

  // Daftar titik yang BELUM dicek hari ini
  const uncheckedHydrants = useMemo(() => {
    return hydrantsInFilter.filter((h) => !combinedInspectedMap.has(h.id));
  }, [hydrantsInFilter, combinedInspectedMap]);

  // Label nama gudang aktif
  const selectedLabel = useMemo(() => {
    if (selectedWarehouse === 'all') return 'SEMUA GUDANG';
    const opt = warehouseOptions.find((w) => w.id === selectedWarehouse);
    return opt ? `GUDANG ${opt.name}` : `GUDANG ${selectedWarehouse.toUpperCase()}`;
  }, [selectedWarehouse, warehouseOptions]);

  // Persentase kelengkapan
  const totalInFilter = hydrantsInFilter.length;
  const checkedCount = checkedHydrants.length;
  const uncheckedCount = uncheckedHydrants.length;
  const percentComplete =
    totalInFilter > 0 ? Math.round((checkedCount / totalInFilter) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* 1. HEADER ATAS */}
      <div className="flex items-center justify-between border-b border-slate-200/70 pb-3">
        <div className="flex items-center gap-3">
          <Logo size={38} />
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

      {/* 2. ANTREAN OFFLINE WIDGET (Tepat di bawah Header, ukuran proporsional) */}
      <div className="rounded-xl bg-slate-50 border border-slate-200/90 px-3 py-2 flex items-center justify-between shadow-2xs">
        <div className="flex items-center gap-2">
          <span
            className={`h-2.5 w-2.5 rounded-full ${
              queue.length > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
            }`}
          />
          <span className="text-xs font-extrabold text-slate-700 uppercase tracking-wide">
            ANTREAN OFFLINE: <strong className="text-slate-900">{queue.length}</strong>
          </span>
        </div>
        <button
          type="button"
          onClick={triggerSync}
          disabled={syncing || queue.length === 0}
          className="btn-secondary text-[11px] min-h-[30px] px-2.5 py-1 uppercase font-extrabold gap-1.5 shadow-2xs"
        >
          <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
          {syncing ? 'SINKRON…' : 'SINKRONKAN'}
        </button>
      </div>

      {syncMsg && (
        <p className="text-xs text-slate-600 bg-slate-100 p-2 rounded-lg text-center font-medium">
          {syncMsg}
        </p>
      )}

      {/* ALERT SUKSES PEMERIKSAAN */}
      {showSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-900 flex items-start gap-2.5 shadow-2xs">
          <CheckCircle2 size={16} className="text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <strong className="font-extrabold tracking-wide uppercase">PEMERIKSAAN BERHASIL DISIMPAN!</strong>
            <p className="mt-0.5 text-emerald-800 text-[11px]">
              Data pemeriksaan telah tercatat dan tersimpan dengan aman (lokal / server).
            </p>
          </div>
        </div>
      )}

      {/* 3. DROPLIST PEMILIHAN GUDANG (WH) */}
      <div className="card p-3 space-y-2 border-slate-200/90 bg-white shadow-soft">
        <div className="flex items-center justify-between">
          <label
            htmlFor="warehouse-select"
            className="text-[11px] font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5"
          >
            <Building2 size={14} className="text-primary-700 shrink-0" />
            LOKASI GUDANG (WH):
          </label>
          <span className="text-[10px] font-extrabold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-md uppercase">
            {selectedWarehouse === 'all' ? 'SEMUA WH' : `WH ${selectedWarehouse.toUpperCase()}`}
          </span>
        </div>

        <div className="relative">
          <select
            id="warehouse-select"
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="w-full min-h-[44px] appearance-none rounded-xl border border-slate-300 bg-white px-3 pr-9 text-xs font-extrabold text-slate-900 tracking-wider uppercase transition focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/20 cursor-pointer shadow-2xs"
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
      </div>

      {/* 4. INFORMASI SEDERHANA: NAMA PETUGAS & FREKUENSI */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
            PETUGAS:
          </span>
          <span className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
            {bundle.user.name}
          </span>
        </div>
        <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 uppercase tracking-wider">
          FREKUENSI: {bundle.frequency === 'bulanan' ? 'BULANAN' : 'HARIAN'}
        </span>
      </div>

      {/* 5. TOMBOL UTAMA: MULAI PERIKSA HYDRANT (SCAN QR) */}
      <div>
        <Link
          href="/petugas/periksa"
          className="btn-primary btn-lg w-full shadow-md text-sm font-extrabold tracking-wider uppercase gap-2.5 justify-center"
        >
          <QrCode size={20} className="shrink-0" />
          MULAI PERIKSA HYDRANT (SCAN QR)
        </Link>
      </div>

      {/* 6. CARD STATISTIK: SUDAH DI CEK & BELUM DI CEK */}
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-3">
          {/* Card Sudah Di Cek */}
          <div
            onClick={() => setActiveTab('checked')}
            className={`card p-3.5 space-y-1.5 border-2 transition cursor-pointer ${
              activeTab === 'checked'
                ? 'border-emerald-500 bg-emerald-50/70 shadow-sm'
                : 'border-slate-200 bg-white hover:border-emerald-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider">
                SUDAH DI CEK
              </span>
              <CheckCircle2 size={16} className="text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-emerald-700 leading-none">
                {checkedCount}
              </span>
              <span className="text-[11px] font-bold text-emerald-600 uppercase">
                / {totalInFilter} TITIK
              </span>
            </div>
            <p className="text-[10px] font-bold text-emerald-700/80 uppercase tracking-wide">
              HARI INI TERPERIKSA
            </p>
          </div>

          {/* Card Belum Di Cek */}
          <div
            onClick={() => setActiveTab('unchecked')}
            className={`card p-3.5 space-y-1.5 border-2 transition cursor-pointer ${
              activeTab === 'unchecked'
                ? 'border-amber-500 bg-amber-50/70 shadow-sm'
                : 'border-slate-200 bg-white hover:border-amber-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-amber-800 uppercase tracking-wider">
                BELUM DI CEK
              </span>
              <Clock size={16} className="text-amber-600" />
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black text-amber-700 leading-none">
                {uncheckedCount}
              </span>
              <span className="text-[11px] font-bold text-amber-600 uppercase">
                / {totalInFilter} TITIK
              </span>
            </div>
            <p className="text-[10px] font-bold text-amber-700/80 uppercase tracking-wide">
              SISA BELUM DI CEK
            </p>
          </div>
        </div>

        {/* Progress Bar Kelengkapan */}
        <div className="rounded-lg bg-slate-100 p-2 border border-slate-200/80 space-y-1">
          <div className="flex items-center justify-between text-[11px] font-extrabold uppercase">
            <span className="text-slate-600">PROGRESS PENGECEKAN {selectedLabel}:</span>
            <span className="text-teal-900 font-black">{percentComplete}% SELESAI</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300 rounded-full"
              style={{ width: `${percentComplete}%` }}
            />
          </div>
        </div>
      </div>

      {/* 7. DAFTAR TITIK HYDRANT */}
      <div className="space-y-2.5 pt-1">
        {/* Tab Toggle: Sudah Di Cek vs Belum Di Cek */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-2 px-0.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('checked')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase transition ${
                activeTab === 'checked'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ✓ SUDAH DI CEK ({checkedCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('unchecked')}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold uppercase transition ${
                activeTab === 'unchecked'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              BELUM DI CEK ({uncheckedCount})
            </button>
          </div>
          <span className="text-[10px] font-black text-slate-400 uppercase">
            {selectedLabel}
          </span>
        </div>

        {/* LIST KONTEN TAB 1: TITIK YANG SUDAH DI CEK HARI INI */}
        {activeTab === 'checked' && (
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {checkedHydrants.map((h) => (
              <div
                key={h.id}
                className="p-3.5 rounded-xl border border-emerald-200 bg-white hover:border-emerald-300 transition space-y-2 shadow-2xs"
              >
                {/* Baris 1: Nomor, Gudang & Lokasi Tag */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-900 uppercase tracking-wide">
                      {h.number}
                    </span>
                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 uppercase">
                      GUDANG {h.warehouse_name.replace(/^gudang\s+/i, '').trim()}
                    </span>
                  </div>
                  <LocationTag type={h.location_type} />
                </div>

                {/* Baris 2: Nama Lokasi */}
                <p className="text-xs text-slate-600 flex items-center gap-1.5">
                  <MapPin size={13} className="text-slate-400 shrink-0" />
                  <span className="truncate font-medium">{h.location_name}</span>
                </p>

                {/* Baris 3: Tanggal & Waktu Pengecekan Hari Ini */}
                <div className="rounded-lg bg-emerald-50/80 border border-emerald-200/90 px-2.5 py-1.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-emerald-900 font-extrabold">
                    <Calendar size={13} className="text-emerald-700 shrink-0" />
                    <span>DICEK: {formatCheckDateTime(h.inspectedAt)}</span>
                  </div>
                  {h.isOfflineQueue ? (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase">
                      OFFLINE (LOKAL)
                    </span>
                  ) : (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase">
                      TERVERIFIKASI
                    </span>
                  )}
                </div>

                {/* Catatan jika ada */}
                {h.notes && (
                  <p className="text-[11px] text-slate-600 italic bg-slate-50 p-1.5 rounded border border-slate-100">
                    Catatan: {h.notes}
                  </p>
                )}
              </div>
            ))}

            {checkedHydrants.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl bg-white space-y-1.5">
                <Clock size={24} className="text-slate-400 mx-auto" />
                <p className="font-extrabold text-slate-700 uppercase">
                  BELUM ADA TITIK HYDRANT YANG DI CEK HARI INI
                </p>
                <p className="text-[11px] text-slate-500">
                  Silakan tekan tombol <strong>"MULAI PERIKSA HYDRANT (SCAN QR)"</strong> di atas untuk mulai melakukan inspeksi.
                </p>
              </div>
            )}
          </div>
        )}

        {/* LIST KONTEN TAB 2: TITIK YANG BELUM DI CEK */}
        {activeTab === 'unchecked' && (
          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {uncheckedHydrants.map((h) => (
              <div
                key={h.id}
                className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-primary-200 transition space-y-1.5 shadow-2xs"
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

                <p className="text-xs text-slate-600 flex items-center gap-1.5">
                  <MapPin size={13} className="text-slate-400 shrink-0" />
                  <span className="truncate font-medium">{h.location_name}</span>
                </p>

                <div className="pt-0.5 flex items-center justify-between text-[11px] text-amber-700 font-bold">
                  <span className="flex items-center gap-1">
                    <Clock size={12} className="text-amber-500" /> Belum Diperiksa Hari Ini
                  </span>
                  <Link
                    href="/petugas/periksa"
                    className="text-[10px] font-black text-primary uppercase underline"
                  >
                    Periksa Sekarang &rarr;
                  </Link>
                </div>
              </div>
            ))}

            {uncheckedHydrants.length === 0 && (
              <div className="p-6 text-center text-xs text-emerald-700 border border-dashed border-emerald-200 rounded-xl bg-emerald-50/50 space-y-1">
                <CheckCircle2 size={24} className="text-emerald-600 mx-auto" />
                <p className="font-extrabold text-emerald-900 uppercase">
                  SEMUA TITIK TELAH SELESAI DI CEK HARI INI!
                </p>
                <p className="text-[11px] text-emerald-800">
                  Luar biasa! Seluruh titik hydrant untuk {selectedLabel} telah diperiksa.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

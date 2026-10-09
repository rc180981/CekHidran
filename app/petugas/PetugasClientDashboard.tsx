'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  QrCode,
  RefreshCw,
  CheckCircle2,
  Clock,
  MapPin,
  Calendar,
  User,
  ArrowRight,
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

  // Gabungkan inspeksi Firestore hari ini dengan antrean offline hari ini
  const todayStr = jakartaDate();
  const combinedInspectedMap = useMemo(() => {
    const map = new Map<
      string,
      {
        inspectedAt: string;
        notes?: string;
        status?: string;
        isOfflineQueue?: boolean;
        inspectorName?: string;
      }
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
          inspectorName: ins.user_name || ins.userName || bundle.user.name,
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
          inspectorName: bundle.user.name,
        });
      }
    });

    return map;
  }, [todayInspections, queue, todayStr, bundle.user.name]);

  // Daftar titik yang SUDAH dicek hari ini (dari seluruh penugasan petugas)
  const checkedHydrants = useMemo(() => {
    return bundle.hydrants
      .filter((h) => combinedInspectedMap.has(h.id))
      .map((h) => {
        const info = combinedInspectedMap.get(h.id);
        return {
          ...h,
          inspectedAt: info?.inspectedAt,
          notes: info?.notes,
          status: info?.status,
          isOfflineQueue: info?.isOfflineQueue,
          inspectorName: info?.inspectorName || bundle.user.name,
        };
      })
      .sort((a, b) => (b.inspectedAt || '').localeCompare(a.inspectedAt || ''));
  }, [bundle.hydrants, combinedInspectedMap, bundle.user.name]);

  // Daftar titik yang BELUM dicek hari ini
  const uncheckedHydrants = useMemo(() => {
    return bundle.hydrants.filter((h) => !combinedInspectedMap.has(h.id));
  }, [bundle.hydrants, combinedInspectedMap]);

  const checkedCount = checkedHydrants.length;
  const uncheckedCount = uncheckedHydrants.length;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* 1. HEADER ATAS DENGAN ANTREAN OFFLINE TERINTEGRASI */}
      <header className="border-b border-slate-200/80 pb-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          {/* Logo & Judul */}
          <div className="flex items-center gap-2.5 min-w-0">
            <Logo size={36} />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight tracking-wider uppercase truncate">
                CEK HIDRAN
              </h1>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 tracking-wider uppercase truncate">
                ANTARMUKA PETUGAS
              </p>
            </div>
          </div>

          {/* Sisi Kanan: Antrean Offline & Tombol Keluar */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={triggerSync}
              disabled={syncing}
              title={
                queue.length > 0
                  ? `${queue.length} antrean offline siap disinkronkan`
                  : 'Tidak ada antrean offline'
              }
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-black transition shadow-2xs select-none active:scale-95 ${
                queue.length > 0
                  ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full shrink-0 ${
                  queue.length > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                }`}
              />
              <span className="text-[10px] sm:text-xs uppercase tracking-wide">
                OFFLINE: <strong>{queue.length}</strong>
              </span>
              <RefreshCw
                size={11}
                className={`text-slate-500 shrink-0 ${
                  syncing ? 'animate-spin text-primary' : ''
                }`}
              />
            </button>

            <LogoutButton />
          </div>
        </div>

        {syncMsg && (
          <p className="text-[11px] text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-lg text-center font-medium leading-relaxed">
            {syncMsg}
          </p>
        )}
      </header>

      {/* ALERT SUKSES PEMERIKSAAN */}
      {showSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-900 flex items-start gap-2.5 shadow-2xs">
          <CheckCircle2 size={16} className="text-emerald-700 shrink-0 mt-0.5" />
          <div>
            <strong className="font-black tracking-wide uppercase text-xs">
              PEMERIKSAAN BERHASIL DISIMPAN!
            </strong>
            <p className="mt-0.5 text-emerald-800 text-[11px] leading-snug">
              Data pemeriksaan telah tercatat dan tersimpan dengan aman (lokal / server).
            </p>
          </div>
        </div>
      )}

      {/* 2. INFORMASI IDENTITAS PETUGAS & FREKUENSI */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-white border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0">
            PETUGAS:
          </span>
          <span className="text-xs sm:text-sm font-black text-slate-900 uppercase truncate tracking-wide">
            {bundle.user.name}
          </span>
        </div>
        <span className="text-[10px] sm:text-[11px] font-black px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200 uppercase tracking-wider shrink-0 whitespace-nowrap">
          FREKUENSI: {bundle.frequency === 'bulanan' ? 'BULANAN' : 'HARIAN'}
        </span>
      </div>

      {/* 3. TOMBOL UTAMA: MULAI PERIKSA HYDRANT (SCAN QR) */}
      <div>
        <Link
          href="/petugas/periksa"
          className="group relative flex items-center justify-between overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-teal-800 p-3 sm:p-4 text-white shadow-md shadow-primary/25 transition-all duration-200 hover:shadow-lg hover:shadow-primary/30 active:scale-[0.99] min-h-[58px]"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-xs ring-1 ring-white/20 transition-transform group-hover:scale-105">
              <QrCode size={24} />
            </div>
            <div className="text-left min-w-0">
              <h2 className="text-xs sm:text-sm font-black tracking-wide uppercase leading-tight text-white truncate">
                MULAI PERIKSA HYDRANT
              </h2>
              <p className="mt-0.5 text-[10px] sm:text-[11px] font-bold tracking-wider uppercase text-teal-100/90 truncate">
                PINDAI QR CODE TITIK PEMERIKSAAN
              </p>
            </div>
          </div>

          <div className="shrink-0 pl-1">
            <span className="inline-flex items-center gap-1 rounded-xl bg-white/20 px-2.5 py-1 text-[10px] sm:text-xs font-black uppercase tracking-wider text-white backdrop-blur-xs ring-1 ring-white/25">
              SCAN <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </Link>
      </div>

      {/* 4. CARD STATISTIK: SUDAH DI CEK & BELUM DI CEK (RESPONSIF & PRESISI) */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        {/* Card Sudah Di Cek */}
        <div
          onClick={() => setActiveTab('checked')}
          className={`card p-3 sm:p-3.5 space-y-1 border-2 transition cursor-pointer select-none active:scale-[0.98] ${
            activeTab === 'checked'
              ? 'border-emerald-500 bg-emerald-50/70 shadow-sm'
              : 'border-slate-200 bg-white hover:border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-emerald-800 uppercase tracking-wider">
              SUDAH DI CEK
            </span>
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-700 leading-none my-1 tabular-nums">
            {checkedCount}
          </div>
          <p className="text-[10px] font-bold text-emerald-700/80 uppercase tracking-wide">
            HARI INI TERPERIKSA
          </p>
        </div>

        {/* Card Belum Di Cek */}
        <div
          onClick={() => setActiveTab('unchecked')}
          className={`card p-3 sm:p-3.5 space-y-1 border-2 transition cursor-pointer select-none active:scale-[0.98] ${
            activeTab === 'unchecked'
              ? 'border-amber-500 bg-amber-50/70 shadow-sm'
              : 'border-slate-200 bg-white hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-amber-800 uppercase tracking-wider">
              BELUM DI CEK
            </span>
            <Clock size={16} className="text-amber-600 shrink-0" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-700 leading-none my-1 tabular-nums">
            {uncheckedCount}
          </div>
          <p className="text-[10px] font-bold text-amber-700/80 uppercase tracking-wide">
            SISA BELUM DI CEK
          </p>
        </div>
      </div>

      {/* 5. DAFTAR TITIK HYDRANT */}
      <div className="space-y-2.5 pt-1">
        {/* Tab Toggle: Segmented Control 50% - 50% Otomatis Presisi di Mobile */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/70 rounded-xl border border-slate-300/60">
          <button
            type="button"
            onClick={() => setActiveTab('checked')}
            className={`min-h-[38px] py-2 px-1 text-center text-xs font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 select-none active:scale-95 ${
              activeTab === 'checked'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 bg-transparent'
            }`}
          >
            <CheckCircle2 size={14} className="shrink-0" />
            <span className="truncate">SUDAH DI CEK ({checkedCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('unchecked')}
            className={`min-h-[38px] py-2 px-1 text-center text-xs font-black uppercase rounded-lg transition-all flex items-center justify-center gap-1.5 select-none active:scale-95 ${
              activeTab === 'unchecked'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 bg-transparent'
            }`}
          >
            <Clock size={14} className="shrink-0" />
            <span className="truncate">BELUM DI CEK ({uncheckedCount})</span>
          </button>
        </div>

        {/* LIST KONTEN TAB 1: TITIK YANG SUDAH DI CEK HARI INI */}
        {activeTab === 'checked' && (
          <div className="space-y-2.5">
            {checkedHydrants.map((h) => (
              <div
                key={h.id}
                className="p-3 sm:p-3.5 rounded-2xl border border-emerald-200/90 bg-white hover:border-emerald-300 transition space-y-2 shadow-2xs"
              >
                {/* Baris 1: Nomor Hydrant, Gudang & Lokasi Tag */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wide shrink-0">
                      {h.number}
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 uppercase tracking-wider truncate">
                      GUDANG {h.warehouse_name.replace(/^gudang\s+/i, '').trim()}
                    </span>
                  </div>
                  <div className="shrink-0">
                    <LocationTag type={h.location_type} />
                  </div>
                </div>

                {/* Baris 2: Nama Lokasi */}
                <p className="text-xs text-slate-600 font-medium flex items-center gap-1.5 leading-snug">
                  <MapPin size={13} className="text-slate-400 shrink-0" />
                  <span className="truncate">{h.location_name}</span>
                </p>

                {/* Baris 3: Info Pengecekan (Nama Petugas, Waktu & Status) */}
                <div className="rounded-xl bg-emerald-50/60 border border-emerald-200/80 p-2.5 space-y-1.5 text-xs">
                  {/* Nama Petugas Pemeriksa */}
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <User size={13} className="text-emerald-700 shrink-0" />
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0">
                        PETUGAS:
                      </span>
                      <span className="font-black text-slate-900 uppercase text-[11px] truncate">
                        {h.inspectorName}
                      </span>
                    </div>
                    {h.isOfflineQueue ? (
                      <span className="text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 uppercase shrink-0">
                        OFFLINE (LOKAL)
                      </span>
                    ) : (
                      <span className="text-[9px] sm:text-[10px] font-black px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase shrink-0">
                        TERVERIFIKASI
                      </span>
                    )}
                  </div>

                  {/* Tanggal & Waktu Pemeriksaan */}
                  <div className="flex items-center gap-1.5 text-emerald-950 border-t border-emerald-100/80 pt-1.5">
                    <Calendar size={13} className="text-emerald-700 shrink-0" />
                    <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider shrink-0">
                      WAKTU:
                    </span>
                    <span className="text-[11px] font-black truncate">
                      {formatCheckDateTime(h.inspectedAt)}
                    </span>
                  </div>
                </div>

                {/* Catatan jika ada */}
                {h.notes && (
                  <p className="text-[11px] text-slate-600 italic bg-slate-50 p-2 rounded-lg border border-slate-100 leading-relaxed">
                    Catatan: {h.notes}
                  </p>
                )}
              </div>
            ))}

            {checkedHydrants.length === 0 && (
              <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl bg-white space-y-1.5">
                <Clock size={24} className="text-slate-400 mx-auto" />
                <p className="font-black text-slate-700 uppercase">
                  BELUM ADA TITIK HYDRANT YANG DI CEK HARI INI
                </p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  Silakan tekan tombol <strong>"MULAI PERIKSA HYDRANT"</strong> di atas untuk mulai melakukan inspeksi.
                </p>
              </div>
            )}
          </div>
        )}

        {/* LIST KONTEN TAB 2: TITIK YANG BELUM DI CEK */}
        {activeTab === 'unchecked' && (
          <div className="space-y-2.5">
            {uncheckedHydrants.map((h) => (
              <div
                key={h.id}
                className="p-3 sm:p-3.5 rounded-2xl border border-slate-200 bg-white hover:border-slate-300 transition space-y-2 shadow-2xs"
              >
                {/* Baris 1: Nomor Hydrant, Gudang & Lokasi Tag */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-wide shrink-0">
                      {h.number}
                    </span>
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider truncate">
                      GUDANG {h.warehouse_name.replace(/^gudang\s+/i, '').trim()}
                    </span>
                  </div>
                  <div className="shrink-0">
                    <LocationTag type={h.location_type} />
                  </div>
                </div>

                {/* Baris 2: Nama Lokasi */}
                <p className="text-xs text-slate-600 font-medium flex items-center gap-1.5 leading-snug">
                  <MapPin size={13} className="text-slate-400 shrink-0" />
                  <span className="truncate">{h.location_name}</span>
                </p>

                {/* Baris 3: Status Ringkas */}
                <div className="pt-0.5 flex items-center gap-1.5 text-[11px] text-amber-700 font-bold">
                  <Clock size={12} className="text-amber-500 shrink-0" />
                  <span>Belum Diperiksa Hari Ini</span>
                </div>
              </div>
            ))}

            {uncheckedHydrants.length === 0 && (
              <div className="p-6 text-center text-xs text-emerald-700 border border-dashed border-emerald-200 rounded-xl bg-emerald-50/50 space-y-1">
                <CheckCircle2 size={24} className="text-emerald-600 mx-auto" />
                <p className="font-black text-emerald-900 uppercase">
                  SEMUA TITIK TELAH SELESAI DI CEK HARI INI!
                </p>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  Luar biasa! Seluruh titik hydrant telah selesai diperiksa hari ini.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

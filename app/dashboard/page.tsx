'use client';

import { useAuth } from '@/lib/firebase/auth-context';
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { currentPeriod, jakartaDate, addDays, formatDate } from '@/lib/period';
import { StatCard, Card, ProgressBar, StatusBadge, LocationTag } from '@/components/ui';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ShieldCheck,
  Building2,
  X,
  ArrowRight,
  Flame,
  Search,
  Filter,
  Activity,
  Wrench,
  MapPin,
  Eye,
  FileText,
  User,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [hydrants, setHydrants] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [findings, setFindings] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [freq, setFreq] = useState<'harian' | 'bulanan'>('harian');

  // Interactive Map State
  const [selectedMapWarehouse, setSelectedMapWarehouse] = useState<string>('all');
  const [selectedPinHydrant, setSelectedPinHydrant] = useState<any | null>(null);

  // Modal State
  const [detailModal, setDetailModal] = useState<'checked' | 'unchecked' | 'findings' | 'compliance' | null>(null);
  const [selectedWarehouseModal, setSelectedWarehouseModal] = useState<any | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [wSnap, hSnap, iSnap, fSnap, itSnap, pSnap] = await Promise.all([
          getDocs(collection(db, 'warehouses')),
          getDocs(collection(db, 'hydrants')),
          getDocs(collection(db, 'inspections')),
          getDocs(collection(db, 'findings')),
          getDocs(collection(db, 'checklist_items')),
          getDocs(collection(db, 'profiles')),
        ]);

        const wList: any[] = [];
        wSnap.forEach((d) => wList.push(d.data()));
        wList.sort((a, b) => a.name.localeCompare(b.name));
        setWarehouses(wList);

        const hList: any[] = [];
        hSnap.forEach((d) => hList.push(d.data()));
        hList.sort((a, b) => a.number.localeCompare(b.number));
        setHydrants(hList);

        const iList: any[] = [];
        iSnap.forEach((d) => iList.push(d.data()));
        setInspections(iList);

        const fList: any[] = [];
        fSnap.forEach((d) => fList.push(d.data()));
        setFindings(fList);

        const itList: any[] = [];
        itSnap.forEach((d) => itList.push(d.data()));
        itList.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        setItems(itList);

        const pList: any[] = [];
        pSnap.forEach((d) => pList.push(d.data()));
        setProfiles(pList);
      } catch (err) {
        console.error('Error loading dashboard data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const period = currentPeriod(freq);
  const totalPoints = hydrants.length;
  
  // Pemeriksaan periode ini (harian berdasarkan tanggal hari ini)
  const todayStr = jakartaDate();
  const todayInspections = inspections.filter((i) => (i.inspected_at || '').slice(0, 10) === todayStr);
  const inspectedHydrantMap = new Map(todayInspections.map((i) => [i.hydrant_id, i]));

  const checkedHydrants = hydrants.filter((h) => inspectedHydrantMap.has(h.id));
  const uncheckedHydrants = hydrants.filter((h) => !inspectedHydrantMap.has(h.id));

  const checkedCount = checkedHydrants.length;
  const uncheckedCount = uncheckedHydrants.length;

  const openFindings = findings.filter((f) => f.status === 'terbuka' || f.status === 'dalam_perbaikan');
  const openFindingsCount = openFindings.length;

  // Tren 7 Hari
  const sevenDaysStats = Array.from({ length: 7 }).map((_, idx) => {
    const dStr = addDays(todayStr, -(6 - idx));
    const dayChecks = inspections.filter((i) => (i.inspected_at || '').slice(0, 10) === dStr).length;
    const dayTarget = totalPoints;
    const pct = dayTarget > 0 ? Math.min(100, Math.round((dayChecks / dayTarget) * 100)) : 100;
    return { date: dStr, count: dayChecks, target: dayTarget, pct };
  });

  const actualChecksCount = sevenDaysStats.reduce((acc, curr) => acc + curr.count, 0);
  const expectedTotalChecks = totalPoints * 7;
  const compliancePct = expectedTotalChecks > 0 ? Math.min(100, Math.round((actualChecksCount / expectedTotalChecks) * 100)) : 100;

  // Analisis Statistik Gudang
  const warehouseStats = warehouses.map((wh) => {
    const whHydrants = hydrants.filter((h) => h.warehouse_id === wh.id);
    const whChecked = whHydrants.filter((h) => inspectedHydrantMap.has(h.id)).length;
    const whTotal = whHydrants.length;
    return {
      id: wh.id,
      name: wh.name,
      total: whTotal,
      checked: whChecked,
      percentage: whTotal > 0 ? Math.round((whChecked / whTotal) * 100) : 0,
      hydrants: whHydrants,
    };
  });

  // 1. Analisis Komponen Sering Rusak (Defect Analytics)
  const itemDefectMap: Record<string, { id: string; name: string; count: number }> = {};
  items.forEach((it) => {
    itemDefectMap[it.id] = { id: it.id, name: it.name, count: 0 };
  });

  inspections.forEach((ins) => {
    (ins.results || []).forEach((r: any) => {
      if (r.result === 'tidak_baik' && itemDefectMap[r.checklistItemId]) {
        itemDefectMap[r.checklistItemId].count += 1;
      }
    });
  });

  const defectStats = Object.values(itemDefectMap).sort((a, b) => b.count - a.count);
  const totalDefects = defectStats.reduce((acc, curr) => acc + curr.count, 0);

  // 2. Log Aktivitas Pemeriksaan Terbaru (5 Terkini)
  const recentInspections = [...inspections]
    .sort((a, b) => (b.inspected_at || '').localeCompare(a.inspected_at || ''))
    .slice(0, 5);

  // 3. Skor Kesiapsiagaan Fasilitas (Emergency Readiness Index)
  const readinessScore = totalPoints > 0 ? Math.max(0, Math.round(((totalPoints - openFindingsCount) / totalPoints) * 100)) : 100;

  // 4. Titik Hydrant untuk Visual Grid Map
  const mapFilteredHydrants =
    selectedMapWarehouse === 'all'
      ? hydrants
      : hydrants.filter((h) => h.warehouse_id === selectedMapWarehouse);

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="h-9 w-9 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-600">Memuat data pemantauan hydrant…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-black tracking-wider text-slate-900 uppercase">DASHBOARD PEMANTAUAN HYDRANT</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 uppercase font-semibold">
            STATUS PEMERIKSAAN PERIODE <strong className="text-slate-800 font-bold">{period.label.toUpperCase()}</strong> ({period.short.toUpperCase()})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 shadow-sm uppercase">
            FREKUENSI: {freq === 'bulanan' ? 'BULANAN' : 'HARIAN'}
          </span>
        </div>
      </div>

      {/* 4 Kartu Metrik Interaktif */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Titik Sudah Dicek"
          value={`${checkedCount} / ${totalPoints}`}
          hint={`${totalPoints > 0 ? Math.round((checkedCount / totalPoints) * 100) : 0}% terlaksana hari ini`}
          tone="green"
          icon={<CheckCircle2 size={24} />}
          onClick={() => setDetailModal('checked')}
        />
        <StatCard
          label="Belum Dicek"
          value={uncheckedCount}
          hint="Klik untuk daftar prioritas"
          tone={uncheckedCount > 0 ? 'amber' : 'slate'}
          icon={<Clock size={24} />}
          onClick={() => setDetailModal('unchecked')}
        />
        <StatCard
          label="Temuan Terbuka"
          value={openFindingsCount}
          hint="Klik untuk rincian K3"
          tone={openFindingsCount > 0 ? 'red' : 'green'}
          icon={<AlertTriangle size={24} />}
          onClick={() => setDetailModal('findings')}
        />
        <StatCard
          label="Kepatuhan 7 Hari"
          value={`${compliancePct}%`}
          hint="Klik untuk tren mingguan"
          tone="primary"
          icon={<ShieldCheck size={24} />}
          onClick={() => setDetailModal('compliance')}
        />
      </div>

      {/* SEKSI 1: PROGRES PEMERIKSAAN PER GUDANG (FULL WIDTH) */}
      <Card
        title={
          <div className="flex items-center justify-between w-full">
            <span className="font-extrabold text-slate-900 text-base uppercase tracking-wider">PROGRES PEMERIKSAAN PER GUDANG</span>
            <span className="text-xs text-slate-400 font-normal">Klik gudang untuk rincian titik</span>
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {warehouseStats.map((wh) => (
            <div
              key={wh.id}
              onClick={() => setSelectedWarehouseModal(wh)}
              className="p-4 rounded-xl border border-slate-200/90 hover:border-primary-400 hover:bg-slate-50/80 transition-all cursor-pointer shadow-sm group select-none space-y-3"
            >
              <div className="flex justify-between items-start text-sm">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center font-bold text-sm group-hover:scale-105 transition-transform">
                    <Building2 size={18} />
                  </div>
                  <div>
                    <strong className="text-slate-900 group-hover:text-primary transition-colors block font-bold">
                      Gudang {wh.name}
                    </strong>
                    <p className="text-xs text-slate-500">
                      {wh.checked} dari {wh.total} titik terperiksa
                    </p>
                  </div>
                </div>
                <span className="font-bold text-lg text-primary">{wh.percentage}%</span>
              </div>
              <ProgressBar
                value={wh.checked}
                max={wh.total}
                tone={wh.percentage === 100 ? 'green' : 'primary'}
              />
              <div className="text-right">
                <span className="text-[11px] text-primary font-semibold group-hover:underline">
                  Lihat 18 Titik →
                </span>
              </div>
            </div>
          ))}

          {warehouseStats.length === 0 && (
            <p className="text-sm text-slate-500 text-center py-6 col-span-3">Belum ada data gudang.</p>
          )}
        </div>
      </Card>

      {/* SEKSI 2: PETA DENAH MATRIKS TITIK HYDRANT INTERAKTIF */}
      <Card
        title={
          <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-3">
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-primary" />
              <span className="font-extrabold text-slate-900 text-base uppercase tracking-wider">
                DENAH & MATRIKS TITIK HYDRANT INTERAKTIF ({mapFilteredHydrants.length} TITIK)
              </span>
            </div>

            {/* Filter Tab Gudang */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setSelectedMapWarehouse('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  selectedMapWarehouse === 'all'
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Semua Gudang
              </button>
              {warehouses.map((wh) => (
                <button
                  key={wh.id}
                  type="button"
                  onClick={() => setSelectedMapWarehouse(wh.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition shrink-0 ${
                    selectedMapWarehouse === wh.id
                      ? 'bg-primary text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Gudang {wh.name}
                </button>
              ))}
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Legend Indikator */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <span className="text-slate-500 font-medium">
              💡 Klik pada kotak titik hydrant untuk rincian inspeksi & foto kondisi cepat.
            </span>
            <div className="flex items-center gap-3.5">
              <span className="flex items-center gap-1.5 font-semibold text-emerald-800">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                Siap & Normal
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-red-800">
                <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
                Temuan Rusak
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-slate-500">
                <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                Belum Dicek
              </span>
            </div>
          </div>

          {/* Grid Matriks Titik Hydrant */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 max-h-[380px] overflow-y-auto p-1 border border-slate-100 rounded-xl">
            {mapFilteredHydrants.map((h) => {
              const ins = inspectedHydrantMap.get(h.id);
              const hasDefect = findings.some(
                (f) => f.hydrant_id === h.id && (f.status === 'terbuka' || f.status === 'dalam_perbaikan')
              );
              const isChecked = !!ins;

              return (
                <div
                  key={h.id}
                  onClick={() => setSelectedPinHydrant(h)}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition-all hover:scale-[1.02] shadow-sm select-none ${
                    hasDefect
                      ? 'bg-red-50/80 border-red-300 hover:border-red-500 hover:bg-red-100/60'
                      : isChecked
                      ? 'bg-emerald-50/70 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-100/60'
                      : 'bg-white border-slate-200 hover:border-primary-400 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <strong className="text-sm font-bold text-slate-900">{h.number}</strong>
                    {hasDefect ? (
                      <span className="h-2 w-2 rounded-full bg-red-600" />
                    ) : isChecked ? (
                      <CheckCircle2 size={14} className="text-emerald-600" />
                    ) : (
                      <Clock size={13} className="text-slate-400" />
                    )}
                  </div>
                  <p className="text-[11px] font-medium text-slate-600 truncate mt-1">
                    Gudang {h.warehouse_name}
                  </p>
                  <p className="text-[10px] text-slate-400 truncate">{h.location_name}</p>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* SEKSI 3: DUA KOLOM BERDAMPINGAN (ANALITIK KERUSAKAN & FEED AKTIVITAS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* KOLOM KIRI: ANALITIK KERUSAKAN KOMPONEN & EMERGENCY READINESS */}
        <div className="lg:col-span-7">
          <Card
            title={
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Wrench size={18} className="text-primary" />
                  <span className="font-extrabold text-slate-900 text-base uppercase tracking-wider">ANALITIK KESEHATAN KOMPONEN</span>
                </div>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
                  {totalDefects} KERUSAKAN DICATAT
                </span>
              </div>
            }
          >
            <div className="space-y-5">
              {/* Emergency Readiness Index */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-teal-50 to-emerald-50 border border-teal-200/80 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-teal-900 uppercase tracking-wider block">
                    Tingkat Kesiapsiagaan Fasilitas Hydrant
                  </span>
                  <p className="text-xs text-teal-700 mt-0.5">
                    {totalPoints - openFindingsCount} dari {totalPoints} titik siap dioperasikan tanpa kendala
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-emerald-700">{readinessScore}%</span>
                  <span className="block text-[10px] font-bold text-emerald-800">
                    {readinessScore >= 90 ? '🟢 KONDISI PRIMA' : '⚠️ BUTUH PERHATIAN'}
                  </span>
                </div>
              </div>

              {/* Progress Bar Kerusakan per Item Checklist */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Frekuensi Kerusakan Berdasarkan Komponen:
                </h4>
                {defectStats.map((item) => {
                  const pct = totalDefects > 0 ? Math.round((item.count / totalDefects) * 100) : 0;
                  return (
                    <div key={item.id} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-slate-800">{item.name}</span>
                        <span className="text-slate-500">
                          {item.count} temuan ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(pct, item.count > 0 ? 5 : 0)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                {defectStats.length === 0 && (
                  <p className="text-xs text-slate-400 py-3 text-center">Belum ada master komponen.</p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* KOLOM KANAN: FEED AKTIVITAS PEMERIKSAAN TERKINI */}
        <div className="lg:col-span-5">
          <Card
            title={
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Activity size={18} className="text-primary" />
                  <span className="font-extrabold text-slate-900 text-base uppercase tracking-wider">AKTIVITAS PEMERIKSAAN TERKINI</span>
                </div>
                <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">REAL-TIME</span>
              </div>
            }
          >
            <div className="divide-y divide-slate-100 space-y-2">
              {recentInspections.map((ins) => {
                const h = hydrants.find((item) => item.id === ins.hydrant_id);
                const inspector = profiles.find((p) => p.id === ins.user_id)?.name || 'Petugas';
                const hasProblem = (ins.results || []).some((r: any) => r.result === 'tidak_baik');

                return (
                  <div key={ins.id} className="pt-2.5 pb-1 flex items-start justify-between text-xs gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold shrink-0">
                        <User size={15} />
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-slate-900 font-semibold">
                          <strong className="text-slate-950">{inspector}</strong> memeriksa{' '}
                          <strong className="text-primary">{h?.number || 'Hydrant'}</strong>
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Gudang {h?.warehouse_name || '-'} · {h?.location_name || '-'}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          hasProblem ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {hasProblem ? '✕ Kendala' : '✓ Normal'}
                      </span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">
                        {ins.inspected_at
                          ? new Date(ins.inspected_at).toLocaleTimeString('id-ID', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                      </span>
                    </div>
                  </div>
                );
              })}

              {recentInspections.length === 0 && (
                <p className="text-xs text-slate-500 text-center py-8">Belum ada riwayat aktivitas.</p>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* SEKSI 4: TEMUAN K3 TERBARU (DI BAWAH) */}
      <Card
        title={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 text-base uppercase tracking-wider">TEMUAN K3 TERBARU</span>
              {openFindingsCount > 0 && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 uppercase">
                  {openFindingsCount} AKTIF
                </span>
              )}
            </div>
            <Link
              href="/dashboard/temuan"
              className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1 uppercase tracking-wider"
            >
              LIHAT SEMUA TEMUAN <ArrowRight size={14} />
            </Link>
          </div>
        }
      >
        <div className="overflow-x-auto -mx-5 -my-2">
          <table className="table-base">
            <thead>
              <tr>
                <th>Titik Hydrant</th>
                <th>Gudang</th>
                <th>Deskripsi Kerusakan</th>
                <th>Status</th>
                <th>Waktu Laporan</th>
              </tr>
            </thead>
            <tbody>
              {findings.slice(0, 8).map((f: any) => {
                const h = hydrants.find((item) => item.id === f.hydrant_id);
                return (
                  <tr key={f.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="font-bold text-slate-900">{h?.number || f.hydrant_number || '-'}</td>
                    <td className="text-xs text-slate-700">Gudang {h?.warehouse_name || f.warehouse_name || '-'}</td>
                    <td className="max-w-md truncate text-slate-800 font-medium text-xs">
                      {f.description}
                    </td>
                    <td>
                      <StatusBadge status={f.status} size="sm" />
                    </td>
                    <td className="text-xs text-slate-500 whitespace-nowrap">
                      {f.created_at ? new Date(f.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '-'}
                    </td>
                  </tr>
                );
              })}

              {findings.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-slate-500 text-sm">
                    <div className="space-y-1">
                      <p className="font-semibold text-emerald-700">✓ Tidak ada temuan kerusakan terbuka!</p>
                      <p className="text-xs text-slate-400">Seluruh peralatan hydrant tercatat dalam kondisi prima.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ================= MODAL DETAIL KARTU STATISTIK ================= */}
      {detailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-bold text-lg text-slate-900">
                  {detailModal === 'checked' && 'Daftar Titik Hydrant yang Sudah Diperiksa'}
                  {detailModal === 'unchecked' && 'Daftar Titik Hydrant yang Belum Diperiksa'}
                  {detailModal === 'findings' && 'Rincian Temuan K3 yang Perlu Tindakan'}
                  {detailModal === 'compliance' && 'Riwayat Kepatuhan Pemeriksaan (7 Hari)'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {detailModal === 'checked' && `${checkedCount} titik selesai diperiksa pada tanggal hari ini (${todayStr})`}
                  {detailModal === 'unchecked' && `${uncheckedCount} titik masih memerlukan pemeriksaan segera`}
                  {detailModal === 'findings' && `${openFindingsCount} temuan dengan status Terbuka atau Dalam Perbaikan`}
                  {detailModal === 'compliance' && 'Persentase penyelesaian pemeriksaan per hari selama satu minggu terakhir'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              {/* DETAIL 1: SUDAH DICEK */}
              {detailModal === 'checked' && (
                <div className="divide-y divide-slate-100">
                  {checkedHydrants.map((h) => {
                    const ins = inspectedHydrantMap.get(h.id);
                    return (
                      <div key={h.id} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <span className="font-bold text-sm text-slate-900">{h.number}</span>
                          <span className="text-slate-500 ml-2">Gudang {h.warehouse_name} · {h.location_name}</span>
                        </div>
                        <div className="text-right">
                          <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-semibold border border-emerald-200">
                            ✓ Diperiksa {ins?.inspected_at ? new Date(ins.inspected_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {checkedHydrants.length === 0 && (
                    <p className="text-center py-6 text-sm text-slate-500">Belum ada titik yang diperiksa hari ini.</p>
                  )}
                </div>
              )}

              {/* DETAIL 2: BELUM DICEK */}
              {detailModal === 'unchecked' && (
                <div className="divide-y divide-slate-100">
                  {uncheckedHydrants.map((h) => (
                    <div key={h.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <strong className="text-sm font-bold text-slate-900">{h.number}</strong>
                        <span className="text-slate-600 ml-2">Gudang {h.warehouse_name}</span>
                        <p className="text-slate-500 mt-0.5">{h.location_name}</p>
                      </div>
                      <LocationTag type={h.location_type} />
                    </div>
                  ))}
                  {uncheckedHydrants.length === 0 && (
                    <p className="text-center py-6 text-sm text-emerald-700 font-semibold">
                      🎉 Luar biasa! Seluruh 54 titik hydrant telah selesai diperiksa hari ini!
                    </p>
                  )}
                </div>
              )}

              {/* DETAIL 3: TEMUAN TERBUKA */}
              {detailModal === 'findings' && (
                <div className="space-y-3">
                  {openFindings.map((f: any) => {
                    const h = hydrants.find((item) => item.id === f.hydrant_id);
                    return (
                      <div key={f.id} className="p-3 rounded-xl border border-red-200 bg-red-50/40 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <strong className="text-slate-900 font-bold">
                            {h?.number || f.hydrant_number} (Gudang {h?.warehouse_name || f.warehouse_name})
                          </strong>
                          <StatusBadge status={f.status} size="sm" />
                        </div>
                        <p className="text-slate-700 font-medium">{f.description}</p>
                        <p className="text-slate-400 text-[11px] pt-1">
                          Dilaporkan pada: {f.created_at ? new Date(f.created_at).toLocaleString('id-ID') : '-'}
                        </p>
                      </div>
                    );
                  })}
                  {openFindings.length === 0 && (
                    <p className="text-center py-6 text-sm text-emerald-700 font-semibold">
                      Tidak ada temuan terbuka saat ini.
                    </p>
                  )}
                </div>
              )}

              {/* DETAIL 4: TREN KEPATUHAN 7 HARI */}
              {detailModal === 'compliance' && (
                <div className="space-y-4">
                  <table className="w-full text-xs border border-slate-200 rounded-xl overflow-hidden">
                    <thead className="bg-slate-100 text-slate-800">
                      <tr>
                        <th className="p-2.5 text-left">Tanggal</th>
                        <th className="p-2.5 text-center">Realisasi Cek</th>
                        <th className="p-2.5 text-center">Target (54 Titik)</th>
                        <th className="p-2.5 text-center">Persentase</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sevenDaysStats.map((row) => (
                        <tr key={row.date} className="hover:bg-slate-50">
                          <td className="p-2.5 font-medium text-slate-800">
                            {new Date(row.date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}
                          </td>
                          <td className="p-2.5 text-center font-bold text-slate-900">{row.count}</td>
                          <td className="p-2.5 text-center text-slate-500">{row.target}</td>
                          <td className="p-2.5 text-center">
                            <span
                              className={`font-bold px-2 py-0.5 rounded-full text-[11px] ${
                                row.pct >= 90
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : row.pct >= 50
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {row.pct}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 text-right">
              <button
                type="button"
                onClick={() => setDetailModal(null)}
                className="btn-secondary text-xs px-4 py-2"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL DETAIL GUDANG INTERAKTIF ================= */}
      {selectedWarehouseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-200">
            {/* Header Modal Gudang */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary-100 text-primary-800 flex items-center justify-center font-bold">
                  <Building2 size={22} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">
                    Status Titik Hydrant – Gudang {selectedWarehouseModal.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Total {selectedWarehouseModal.total} Titik · Selesai Diperiksa: {selectedWarehouseModal.checked} Titik ({selectedWarehouseModal.percentage}%)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedWarehouseModal(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition"
              >
                <X size={20} />
              </button>
            </div>

            {/* List Titik Hydrant di Gudang Tersebut */}
            <div className="p-6 overflow-y-auto space-y-2 flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {selectedWarehouseModal.hydrants.map((h: any) => {
                  const isChecked = inspectedHydrantMap.has(h.id);
                  const ins = inspectedHydrantMap.get(h.id);
                  return (
                    <div
                      key={h.id}
                      className={`p-3 rounded-xl border transition-all ${
                        isChecked
                          ? 'border-emerald-200 bg-emerald-50/40'
                          : 'border-slate-200 bg-slate-50/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <strong className="text-slate-900 text-sm block font-bold">{h.number}</strong>
                          <p className="text-xs text-slate-600 line-clamp-1">{h.location_name}</p>
                          <div className="pt-1">
                            <LocationTag type={h.location_type} />
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          {isChecked ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                              ✓ Selesai
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 bg-slate-200/70 px-2 py-0.5 rounded-full">
                              – Belum
                            </span>
                          )}
                          {ins?.inspected_at && (
                            <p className="text-[10px] text-slate-400 mt-1">
                              {new Date(ins.inspected_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Footer Modal Gudang */}
            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <Link
                href={`/dashboard/riwayat`}
                className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
              >
                Buka Lembar Checksheet Gudang Ini →
              </Link>
              <button
                type="button"
                onClick={() => setSelectedWarehouseModal(null)}
                className="btn-secondary text-xs px-4 py-2"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL DETAIL TITIK HYDRANT INTERAKTIF (PIN POPUP) ================= */}
      {selectedPinHydrant && (() => {
        const ins = inspectedHydrantMap.get(selectedPinHydrant.id);
        const pointFindings = findings.filter(
          (f) => f.hydrant_id === selectedPinHydrant.id && (f.status === 'terbuka' || f.status === 'dalam_perbaikan')
        );
        const hasDefect = pointFindings.length > 0;
        const isChecked = !!ins;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
              {/* Header Modal Titik */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100">
                <div className="flex items-center gap-3">
                  <div className={`h-11 w-11 rounded-xl flex items-center justify-center font-bold text-white shadow-sm ${
                    hasDefect ? 'bg-red-600' : isChecked ? 'bg-emerald-600' : 'bg-slate-700'
                  }`}>
                    <Flame size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg text-slate-900 leading-tight">
                        Titik {selectedPinHydrant.number}
                      </h3>
                      <LocationTag type={selectedPinHydrant.location_type} />
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Gudang {selectedPinHydrant.warehouse_name} · {selectedPinHydrant.location_name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPinHydrant(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body Modal Titik */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {/* Status Hari Ini Banner */}
                <div className={`p-4 rounded-xl border flex items-start gap-3.5 ${
                  hasDefect
                    ? 'bg-red-50/80 border-red-200 text-red-950'
                    : isChecked
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950'
                    : 'bg-amber-50/80 border-amber-200 text-amber-950'
                }`}>
                  <div className="mt-0.5">
                    {hasDefect ? (
                      <AlertTriangle size={20} className="text-red-600" />
                    ) : isChecked ? (
                      <CheckCircle2 size={20} className="text-emerald-600" />
                    ) : (
                      <Clock size={20} className="text-amber-600" />
                    )}
                  </div>
                  <div className="flex-1 text-xs space-y-1">
                    <strong className="block text-sm font-bold">
                      {hasDefect
                        ? 'Memiliki Temuan Kerusakan K3'
                        : isChecked
                        ? 'Sudah Diperiksa Hari Ini'
                        : 'Belum Diperiksa Hari Ini'}
                    </strong>
                    {isChecked ? (
                      <p className="text-slate-700">
                        Diperiksa oleh <span className="font-semibold text-slate-900">{ins.inspector_name || 'Petugas'}</span> pada{' '}
                        {new Date(ins.inspected_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB.
                      </p>
                    ) : (
                      <p className="text-amber-800">
                        Titik hydrant ini belum mendapat checklist verifikasi fisik hari ini ({jakartaDate()}).
                      </p>
                    )}
                  </div>
                </div>

                {/* Temuan Aktif Jika Ada */}
                {hasDefect && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-red-900 uppercase tracking-wider block">
                      Rincian Temuan Kerusakan:
                    </span>
                    <div className="space-y-2">
                      {pointFindings.map((f: any) => (
                        <div key={f.id} className="p-3 bg-red-50/60 rounded-xl border border-red-200 text-xs space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-red-800 capitalize">
                              Item: {items.find((it) => it.id === f.item_id)?.name || 'Komponen Hydrant'}
                            </span>
                            <StatusBadge status={f.status} />
                          </div>
                          {f.notes && <p className="text-slate-700 text-[11px] italic">"{f.notes}"</p>}
                          {f.photo_url && (
                            <div className="mt-2">
                              <img
                                src={f.photo_url}
                                alt="Foto Temuan"
                                className="h-28 w-full object-cover rounded-lg border border-red-200"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Komponen & Status Checklist Hasil Inspeksi */}
                {isChecked && ins?.results && ins.results.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                      Kondisi Komponen Pemeriksaan:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {ins.results.map((r: any, idx: number) => {
                        const itemObj = items.find((it) => it.id === r.checklistItemId);
                        const isGood = r.result === 'baik';
                        return (
                          <div
                            key={idx}
                            className={`p-2.5 rounded-lg border flex items-center justify-between text-xs ${
                              isGood ? 'bg-slate-50 border-slate-200' : 'bg-red-50 border-red-200'
                            }`}
                          >
                            <span className="text-slate-700 font-medium truncate mr-1">
                              {itemObj?.name || `Item #${idx + 1}`}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                isGood ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                              }`}
                            >
                              {isGood ? 'Baik' : 'Rusak'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Info Tambahan */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Tipe Hydrant:</span>
                    <span className="font-semibold text-slate-800 capitalize">{selectedPinHydrant.type?.replace('_', ' ') || 'Hydrant Box'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Posisi Penempatan:</span>
                    <span className="font-semibold text-slate-800">{selectedPinHydrant.location_name}</span>
                  </div>
                </div>
              </div>

              {/* Footer Modal Titik */}
              <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
                <Link
                  href="/dashboard/riwayat"
                  className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                >
                  Buka Lembar Checksheet →
                </Link>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPinHydrant(null)}
                    className="btn-secondary text-xs px-4 py-2"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

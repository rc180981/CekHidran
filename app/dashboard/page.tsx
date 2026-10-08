'use client';

import { useAuth } from '@/lib/firebase/auth-context';
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { currentPeriod, jakartaDate, addDays } from '@/lib/period';
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
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [hydrants, setHydrants] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [findings, setFindings] = useState<any[]>([]);
  const [freq, setFreq] = useState<'harian' | 'bulanan'>('harian');

  // Modal State
  const [detailModal, setDetailModal] = useState<'checked' | 'unchecked' | 'findings' | 'compliance' | null>(null);
  const [selectedWarehouseModal, setSelectedWarehouseModal] = useState<any | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [wSnap, hSnap, iSnap, fSnap] = await Promise.all([
          getDocs(collection(db, 'warehouses')),
          getDocs(collection(db, 'hydrants')),
          getDocs(collection(db, 'inspections')),
          getDocs(collection(db, 'findings')),
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dashboard Pemantauan Hydrant</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Status pemeriksaan periode <strong className="text-slate-800 font-semibold">{period.label}</strong> ({period.short})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 shadow-sm">
            Frekuensi: {freq === 'bulanan' ? 'Bulanan' : 'Harian'}
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

      {/* Grid Utama: Progres Per Gudang (Interaktif) & Temuan Terbaru */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Kolom Kiri (5/12): Progres Per Gudang (Dapat Diklik) */}
        <div className="lg:col-span-5 space-y-4">
          <Card
            title={
              <div className="flex items-center justify-between w-full">
                <span className="font-bold text-slate-900 text-base">Progres Pemeriksaan Per Gudang</span>
                <span className="text-[11px] font-normal text-slate-400">Klik gudang untuk detail</span>
              </div>
            }
          >
            <div className="space-y-4">
              {warehouseStats.map((wh) => (
                <div
                  key={wh.id}
                  onClick={() => setSelectedWarehouseModal(wh)}
                  className="p-3.5 rounded-xl border border-slate-200/80 hover:border-primary-400 hover:bg-slate-50/70 transition-all cursor-pointer shadow-sm group select-none"
                >
                  <div className="flex justify-between items-center text-sm mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-lg bg-primary-50 text-primary-700 flex items-center justify-center font-bold text-xs group-hover:scale-105 transition-transform">
                        <Building2 size={16} />
                      </div>
                      <div>
                        <strong className="text-slate-900 group-hover:text-primary transition-colors">
                          Gudang {wh.name}
                        </strong>
                        <p className="text-xs text-slate-500">
                          {wh.checked} dari {wh.total} titik terperiksa
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="font-bold text-base text-primary block leading-none">
                        {wh.percentage}%
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">Buka titik →</span>
                    </div>
                  </div>
                  <ProgressBar
                    value={wh.checked}
                    max={wh.total}
                    tone={wh.percentage === 100 ? 'green' : 'primary'}
                  />
                </div>
              ))}

              {warehouseStats.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-6">Belum ada data gudang.</p>
              )}
            </div>
          </Card>
        </div>

        {/* Kolom Kanan (7/12): Temuan Kondisi Tidak Baik Terbaru */}
        <div className="lg:col-span-7 space-y-4">
          <Card
            title={
              <div className="flex items-center justify-between w-full">
                <span className="font-bold text-slate-900 text-base">Temuan K3 Terbaru</span>
                <Link
                  href="/dashboard/temuan"
                  className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                >
                  Lihat Semua Temuan <ArrowRight size={14} />
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
                  {findings.slice(0, 6).map((f: any) => {
                    const h = hydrants.find((item) => item.id === f.hydrant_id);
                    return (
                      <tr key={f.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="font-bold text-slate-900">{h?.number || f.hydrant_number || '-'}</td>
                        <td className="text-xs text-slate-700">Gudang {h?.warehouse_name || f.warehouse_name || '-'}</td>
                        <td className="max-w-[180px] truncate text-slate-800 font-medium text-xs">
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
        </div>
      </div>

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
    </div>
  );
}

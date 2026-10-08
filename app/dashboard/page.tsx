'use client';

import { useAuth } from '@/lib/firebase/auth-context';
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { currentPeriod, jakartaDate, addDays, startOfJakartaDay } from '@/lib/period';
import { StatCard, Card, ProgressBar, StatusBadge, LocationTag } from '@/components/ui';
import { CheckCircle2, Clock, AlertTriangle, ShieldCheck, Flame, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [hydrants, setHydrants] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [findings, setFindings] = useState<any[]>([]);
  const [freq, setFreq] = useState<'harian' | 'bulanan'>('harian');

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
  const inspectedHydrantIds = new Set(inspections.map((i) => i.hydrant_id));
  const checkedCount = hydrants.filter((h) => inspectedHydrantIds.has(h.id)).length;
  const uncheckedCount = totalPoints - checkedCount;

  const openFindingsCount = findings.filter((f) => f.status === 'terbuka' || f.status === 'dalam_perbaikan').length;

  const today = jakartaDate();
  const sevenDaysAgo = addDays(today, -6);
  const actualChecksCount = inspections.length;
  const expectedTotalChecks = totalPoints * 7;
  const compliancePct = expectedTotalChecks > 0 ? Math.min(100, Math.round((actualChecksCount / expectedTotalChecks) * 100)) : 100;

  const warehouseStats = warehouses.map((wh) => {
    const whHydrants = hydrants.filter((h) => h.warehouse_id === wh.id);
    const whChecked = whHydrants.filter((h) => inspectedHydrantIds.has(h.id)).length;
    const whTotal = whHydrants.length;
    return {
      id: wh.id,
      name: wh.name,
      total: whTotal,
      checked: whChecked,
      percentage: whTotal > 0 ? Math.round((whChecked / whTotal) * 100) : 0,
    };
  });

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-slate-600">Memuat data pemantauan hydrant…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Pemantauan Hydrant</h1>
          <p className="text-sm text-slate-600 mt-1">
            Status pemeriksaan periode <strong className="text-slate-900">{period.label}</strong> ({period.short})
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800">
            Frekuensi: {freq === 'bulanan' ? 'Bulanan' : 'Harian'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Titik Sudah Dicek"
          value={`${checkedCount} / ${totalPoints}`}
          hint={`${totalPoints > 0 ? Math.round((checkedCount / totalPoints) * 100) : 0}% terlaksana periode ini`}
          tone="green"
          icon={<CheckCircle2 size={24} />}
        />
        <StatCard
          label="Belum Dicek"
          value={uncheckedCount}
          hint="Perlu pemeriksaan segera"
          tone={uncheckedCount > 0 ? 'amber' : 'slate'}
          icon={<Clock size={24} />}
        />
        <StatCard
          label="Temuan Terbuka"
          value={openFindingsCount}
          hint="Memerlukan tindakan K3"
          tone={openFindingsCount > 0 ? 'red' : 'green'}
          icon={<AlertTriangle size={24} />}
        />
        <StatCard
          label="Kepatuhan 7 Hari"
          value={`${compliancePct}%`}
          hint={`${actualChecksCount} pemeriksaan tercatat`}
          tone="primary"
          icon={<ShieldCheck size={24} />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card title="Progres Pemeriksaan Per Gudang" className="lg:col-span-2">
          <div className="space-y-5">
            {warehouseStats.map((wh) => (
              <div key={wh.id} className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <div className="flex items-center gap-2 font-bold text-slate-800">
                    <span>Gudang {wh.name}</span>
                    <span className="text-xs font-normal text-slate-500">
                      ({wh.checked} dari {wh.total} titik)
                    </span>
                  </div>
                  <span className="font-bold text-primary">{wh.percentage}%</span>
                </div>
                <ProgressBar
                  value={wh.checked}
                  max={wh.total}
                  tone={wh.percentage === 100 ? 'green' : 'primary'}
                />
              </div>
            ))}

            {warehouseStats.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">Belum ada data gudang.</p>
            )}
          </div>
        </Card>

        <Card title="Aksi Cepat & Navigasi">
          <div className="space-y-3">
            <Link
              href="/dashboard/riwayat"
              className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-primary-300 hover:bg-slate-50 transition"
            >
              <div>
                <strong className="text-sm text-slate-800 block">Riwayat Checksheet</strong>
                <span className="text-xs text-slate-500">Tampilan lembar checksheet per hydrant</span>
              </div>
              <ExternalLink size={16} className="text-slate-400" />
            </Link>
            <Link
              href="/dashboard/temuan"
              className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-primary-300 hover:bg-slate-50 transition"
            >
              <div>
                <strong className="text-sm text-slate-800 block">Verifikasi Temuan</strong>
                <span className="text-xs text-slate-500">Tindak lanjuti & tutup temuan rusak</span>
              </div>
              <ExternalLink size={16} className="text-slate-400" />
            </Link>
            <Link
              href="/dashboard/laporan"
              className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-primary-300 hover:bg-slate-50 transition"
            >
              <div>
                <strong className="text-sm text-slate-800 block">Ekspor Laporan</strong>
                <span className="text-xs text-slate-500">Unduh PDF / Excel checksheet</span>
              </div>
              <ExternalLink size={16} className="text-slate-400" />
            </Link>
          </div>
        </Card>
      </div>

      <Card
        title="Temuan Kondisi Tidak Baik Terbaru"
        action={
          <Link href="/dashboard/temuan" className="text-xs font-semibold text-primary hover:underline">
            Lihat Semua
          </Link>
        }
      >
        <div className="overflow-x-auto -mx-5 -my-2">
          <table className="table-base">
            <thead>
              <tr>
                <th>Titik Hydrant</th>
                <th>Gudang</th>
                <th>Deskripsi Temuan</th>
                <th>Status</th>
                <th>Tanggal Temuan</th>
              </tr>
            </thead>
            <tbody>
              {findings.slice(0, 5).map((f: any) => (
                <tr key={f.id} className="hover:bg-slate-50/60">
                  <td className="font-bold text-slate-900">{f.hydrant_number || '-'}</td>
                  <td>{f.warehouse_name || '-'}</td>
                  <td className="max-w-xs truncate text-slate-700">{f.description}</td>
                  <td>
                    <StatusBadge status={f.status} />
                  </td>
                  <td className="text-xs text-slate-500">
                    {f.created_at ? new Date(f.created_at).toLocaleDateString('id-ID') : '-'}
                  </td>
                </tr>
              ))}

              {findings.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-6 text-slate-500 text-sm">
                    Tidak ada temuan kondisi tidak baik saat ini. Semua equipment dalam kondisi prima!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

import { requirePermission } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getFrequency } from '@/lib/settings';
import { currentPeriod, jakartaDate, addDays, startOfJakartaDay } from '@/lib/period';
import { StatCard, Card, ProgressBar, StatusBadge, LocationTag } from '@/components/ui';
import { CheckCircle2, Clock, AlertTriangle, ShieldCheck, Flame, ExternalLink } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const user = await requirePermission('lihat_dashboard');
  const supabase = await createClient();
  const freq = await getFrequency(supabase);
  const period = currentPeriod(freq);

  // 1. Ambil data Gudang & Titik Hydrant
  const [{ data: warehouses }, { data: hydrants }, { data: inspections }, { data: findings }] =
    await Promise.all([
      supabase.from('warehouses').select('id, name').order('name'),
      supabase.from('hydrants').select('id, warehouse_id, number, location_name, location_type, active').eq('active', true),
      supabase
        .from('inspections')
        .select('id, hydrant_id, inspected_at, status')
        .gte('inspected_at', period.start.toISOString())
        .lt('inspected_at', period.end.toISOString()),
      supabase
        .from('findings')
        .select('id, description, status, created_at, inspections(hydrant_id, hydrants(number, warehouse_id, warehouses(name)))')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

  const whList = warehouses ?? [];
  const hydrantList = hydrants ?? [];
  const inspList = inspections ?? [];
  const findingList = findings ?? [];

  const totalPoints = hydrantList.length;
  // Hitung titik yang sudah diperiksa dalam periode ini (unik per hydrant)
  const inspectedHydrantIds = new Set(inspList.map((i) => i.hydrant_id));
  const checkedCount = hydrantList.filter((h) => inspectedHydrantIds.has(h.id)).length;
  const uncheckedCount = totalPoints - checkedCount;

  // Temuan terbuka
  const { count: openFindingsCount } = await supabase
    .from('findings')
    .select('id', { count: 'exact', head: true })
    .in('status', ['terbuka', 'dalam_perbaikan']);

  // Hitung Kepatuhan 7 hari terakhir
  const today = jakartaDate();
  const sevenDaysAgo = addDays(today, -6);
  const { data: pastSevenInspections } = await supabase
    .from('inspections')
    .select('hydrant_id, inspected_at')
    .gte('inspected_at', startOfJakartaDay(sevenDaysAgo).toISOString())
    .lte('inspected_at', new Date().toISOString());

  // Kepatuhan 7 hari = % dari target harian (total hydrant * 7)
  const expectedTotalChecks = totalPoints * 7;
  const actualChecksCount = (pastSevenInspections ?? []).length;
  const compliancePct =
    expectedTotalChecks > 0 ? Math.min(100, Math.round((actualChecksCount / expectedTotalChecks) * 100)) : 100;

  // Progres per gudang
  const warehouseStats = whList.map((wh) => {
    const whHydrants = hydrantList.filter((h) => h.warehouse_id === wh.id);
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

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
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

      {/* Kartu Statistik Utama */}
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
          value={openFindingsCount ?? 0}
          hint="Memerlukan tindakan K3"
          tone={(openFindingsCount ?? 0) > 0 ? 'red' : 'green'}
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

      {/* Progres Pemeriksaan Per Gudang */}
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

        {/* Ringkasan Cepat */}
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

      {/* Tabel Temuan Terbaru */}
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
              {findingList.map((f: any) => {
                const hydrant = f.inspections?.hydrants;
                const whName = hydrant?.warehouses?.name ?? '-';
                const hNum = hydrant?.number ?? '-';
                return (
                  <tr key={f.id} className="hover:bg-slate-50/60">
                    <td className="font-bold text-slate-900">{hNum}</td>
                    <td>{whName}</td>
                    <td className="max-w-xs truncate text-slate-700">{f.description}</td>
                    <td>
                      <StatusBadge status={f.status} />
                    </td>
                    <td className="text-xs text-slate-500">
                      {new Date(f.created_at).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                );
              })}

              {findingList.length === 0 && (
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

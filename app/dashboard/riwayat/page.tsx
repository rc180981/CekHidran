import { requirePermission } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, StatusBadge, LocationTag } from '@/components/ui';
import { formatDate, jakartaMonth, monthRange, monthLabel } from '@/lib/period';
import { FileText, Image as ImageIcon, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function RiwayatChecksheetPage({
  searchParams,
}: {
  searchParams: Promise<{ hydrantId?: string; bulan?: string }>;
}) {
  const user = await requirePermission('lihat_riwayat_semua');
  const params = await searchParams;
  const currentMonth = params.bulan || jakartaMonth();
  const selectedHydrantId = params.hydrantId;

  const supabase = await createClient();

  // Ambil daftar hydrant dan gudang untuk filter
  const [{ data: hydrants }, { data: items }] = await Promise.all([
    supabase
      .from('hydrants')
      .select('id, number, type, location_name, location_type, warehouse_id, warehouses(name)')
      .eq('active', true)
      .order('number'),
    supabase.from('checklist_items').select('id, name, sort_order').eq('active', true).order('sort_order'),
  ]);

  const hydrantList = hydrants ?? [];
  const checklistItems = items ?? [];

  // Default hydrant pertama jika belum dipilih
  const activeHydrantId = selectedHydrantId || hydrantList[0]?.id;
  const activeHydrant = hydrantList.find((h) => h.id === activeHydrantId);

  // Hitung rentang tanggal bulan terpilih
  const { start, end, days } = monthRange(currentMonth);

  // Ambil data inspeksi untuk hydrant dan rentang waktu tersebut
  let inspectionsByDate: Record<string, any> = {};

  if (activeHydrantId) {
    const { data: inspections } = await supabase
      .from('inspections')
      .select(`
        id,
        inspected_at,
        notes,
        signature_url,
        inspector_id,
        profiles(name),
        inspection_results(checklist_item_id, result),
        inspection_photos(url, taken_at)
      `)
      .eq('hydrant_id', activeHydrantId)
      .gte('inspected_at', start.toISOString())
      .lt('inspected_at', end.toISOString())
      .order('inspected_at', { ascending: true });

    (inspections ?? []).forEach((ins: any) => {
      const dateKey = new Date(ins.inspected_at).toISOString().slice(0, 10);
      inspectionsByDate[dateKey] = ins;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Riwayat Checksheet Hydrant</h1>
          <p className="text-sm text-slate-600 mt-1">
            Format lembar fisik checksheet per hydrant dan tabel per tanggal
          </p>
        </div>
      </div>

      {/* Filter Hydrant & Bulan */}
      <Card className="p-4">
        <form method="get" className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="hydrantId" className="label text-xs">Pilih Titik Hydrant</label>
            <select
              id="hydrantId"
              name="hydrantId"
              defaultValue={activeHydrantId}
              className="input text-xs"
            >
              {hydrantList.map((h: any) => (
                <option key={h.id} value={h.id}>
                  {h.number} - {h.location_name} (Gudang {h.warehouses?.name})
                </option>
              ))}
            </select>
          </div>

          <div className="w-48">
            <label htmlFor="bulan" className="label text-xs">Pilih Bulan</label>
            <input
              id="bulan"
              type="month"
              name="bulan"
              defaultValue={currentMonth}
              className="input text-xs"
            />
          </div>

          <div className="pt-5">
            <button type="submit" className="btn-primary min-h-[40px] text-xs">
              Tampilkan
            </button>
          </div>
        </form>
      </Card>

      {/* Lembar Checksheet Fisik Style */}
      {activeHydrant ? (
        <div className="card bg-white p-6 sheet shadow-md overflow-x-auto space-y-6">
          {/* Header Lembar Kertas */}
          <div className="border border-slate-400 p-4 rounded-lg bg-slate-50/50">
            <div className="text-center font-bold text-lg text-slate-900 uppercase tracking-wider border-b border-slate-300 pb-2 mb-3">
              Checksheet Pemeriksaan Hydrant Box
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-800">
              <div>
                <span className="text-slate-500">No. Hydrant:</span>{' '}
                <strong className="text-sm text-slate-900">{activeHydrant.number}</strong>
              </div>
              <div>
                <span className="text-slate-500">Jenis Hydrant:</span>{' '}
                <strong>{activeHydrant.type}</strong>
              </div>
              <div>
                <span className="text-slate-500">Gudang:</span>{' '}
                <strong>Gudang {(activeHydrant as any).warehouses?.name}</strong>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-500">Lokasi Hydrant:</span>{' '}
                <strong>{activeHydrant.location_name}</strong>
              </div>
              <div>
                <span className="text-slate-500">Periode Bulan:</span>{' '}
                <strong className="text-primary">{monthLabel(currentMonth)}</strong>
              </div>
            </div>
          </div>

          {/* Tabel Per Tanggal */}
          <table className="w-full text-xs border border-slate-400">
            <thead>
              <tr className="bg-slate-100 text-slate-800 text-center">
                <th className="p-2 border border-slate-400 w-16">Tanggal</th>
                {checklistItems.map((item) => (
                  <th key={item.id} className="p-2 border border-slate-400 min-w-[120px]">
                    {item.name}
                  </th>
                ))}
                <th className="p-2 border border-slate-400 min-w-[140px]">Catatan</th>
                <th className="p-2 border border-slate-400 w-24">Foto Kondisi</th>
                <th className="p-2 border border-slate-400 w-24">TTD Petugas</th>
              </tr>
            </thead>
            <tbody>
              {days.map((dayStr) => {
                const ins = inspectionsByDate[dayStr];
                const dayNum = dayStr.slice(8);
                const resultMap = new Map(
                  (ins?.inspection_results ?? []).map((r: any) => [r.checklist_item_id, r.result])
                );

                return (
                  <tr key={dayStr} className={`hover:bg-slate-50/80 ${ins ? 'bg-white' : 'bg-slate-50/30'}`}>
                    <td className="p-2 border border-slate-400 text-center font-bold text-slate-700">
                      {dayNum}
                    </td>

                    {/* 4 Kolom Checklist Equipment */}
                    {checklistItems.map((item) => {
                      const res = resultMap.get(item.id);
                      return (
                        <td key={item.id} className="p-2 border border-slate-400 text-center">
                          {res === 'baik' && (
                            <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                              ✓ Baik
                            </span>
                          )}
                          {res === 'tidak_baik' && (
                            <span className="text-red-700 font-bold inline-flex items-center gap-1">
                              ✕ Rusak
                            </span>
                          )}
                          {!res && <span className="text-slate-300">-</span>}
                        </td>
                      );
                    })}

                    {/* Kolom Catatan */}
                    <td className="p-2 border border-slate-400 text-slate-700">
                      {ins?.notes || (ins ? <span className="text-slate-400 italic">Nihil</span> : '-')}
                    </td>

                    {/* Kolom Foto Kondisi */}
                    <td className="p-2 border border-slate-400 text-center">
                      {ins?.inspection_photos && ins.inspection_photos.length > 0 ? (
                        <div className="flex justify-center items-center gap-1">
                          {ins.inspection_photos.map((p: any, idx: number) => (
                            <a
                              key={idx}
                              href={`/api/photos/view?path=${encodeURIComponent(p.url)}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:text-primary-800 p-1 hover:bg-slate-100 rounded inline-flex items-center"
                              title={`Buka Foto ${idx + 1}`}
                            >
                              <ImageIcon size={14} />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Kolom Tanda Tangan */}
                    <td className="p-2 border border-slate-400 text-center">
                      {ins ? (
                        <div className="flex flex-col items-center justify-center">
                          <span className="font-semibold text-[11px] text-slate-800 truncate max-w-[90px]">
                            {ins.profiles?.name ?? 'Petugas'}
                          </span>
                          <span className="text-[10px] text-emerald-700 font-mono">Paraf ✓</span>
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <Card>
          <p className="text-sm text-slate-500 text-center py-6">Tidak ada titik hydrant ditemukan.</p>
        </Card>
      )}
    </div>
  );
}

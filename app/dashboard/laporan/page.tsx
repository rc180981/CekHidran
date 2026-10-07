import { requirePermission } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';
import { jakartaMonth } from '@/lib/period';
import { FileText, FileSpreadsheet, Download } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function EksporLaporanPage() {
  await requirePermission('ekspor_laporan');
  const supabase = await createClient();

  const [{ data: warehouses }, { data: hydrants }] = await Promise.all([
    supabase.from('warehouses').select('id, name').order('name'),
    supabase.from('hydrants').select('id, number, location_name, warehouse_id, warehouses(name)').eq('active', true).order('number'),
  ]);

  const whList = warehouses ?? [];
  const hydrantList = hydrants ?? [];
  const defaultMonth = jakartaMonth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ekspor Laporan Checksheet</h1>
        <p className="text-sm text-slate-600 mt-1">
          Unduh laporan checksheet pemeriksaan format resmi PDF (menyerupai lembar kertas) atau format Excel
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Ekspor Dokumen PDF Lembar Kertas */}
        <Card title="Ekspor PDF Checksheet (Format Lembar Fisik)">
          <form action="/api/laporan/pdf" method="get" target="_blank" className="space-y-4">
            <div>
              <label htmlFor="pdf-hydrant" className="label text-xs">Pilih Titik Hydrant</label>
              <select id="pdf-hydrant" name="hydrantId" required className="input text-xs">
                {hydrantList.map((h: any) => (
                  <option key={h.id} value={h.id}>
                    {h.number} - {h.location_name} (Gudang {h.warehouses?.name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="pdf-bulan" className="label text-xs">Periode Bulan</label>
              <input
                id="pdf-bulan"
                type="month"
                name="bulan"
                defaultValue={defaultMonth}
                required
                className="input text-xs"
              />
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Format menyerupai lembar "Checksheet Hydrant" asli: tabel 31 hari, 4 kolom equipment, paraf TTD petugas, dan catatan inspeksi.
            </p>

            <button type="submit" className="btn-primary min-h-[44px] text-xs w-full">
              <FileText size={16} /> Unduh Laporan PDF
            </button>
          </form>
        </Card>

        {/* Ekspor Spreadsheet Excel Rekap */}
        <Card title="Ekspor Excel Rekapitulasi Checksheet">
          <form action="/api/laporan/excel" method="get" target="_blank" className="space-y-4">
            <div>
              <label htmlFor="excel-gudang" className="label text-xs">Pilih Gudang</label>
              <select id="excel-gudang" name="warehouseId" className="input text-xs">
                <option value="">Semua Gudang (WH2, WH3, WH4)</option>
                {whList.map((w) => (
                  <option key={w.id} value={w.id}>
                    Gudang {w.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="excel-bulan" className="label text-xs">Periode Bulan</label>
              <input
                id="excel-bulan"
                type="month"
                name="bulan"
                defaultValue={defaultMonth}
                required
                className="input text-xs"
              />
            </div>

            <p className="text-[11px] text-slate-500 leading-relaxed">
              Format Excel (.xlsx) dengan multi-sheet atau tabel rekapitulasi komprehensif seluruh titik hydrant dan hasil pemeriksaan.
            </p>

            <button type="submit" className="btn-secondary min-h-[44px] text-xs w-full border-slate-300">
              <FileSpreadsheet size={16} /> Unduh Laporan Excel (.xlsx)
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}

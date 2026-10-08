'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Card } from '@/components/ui';
import { jakartaMonth } from '@/lib/period';
import { FileText, FileSpreadsheet } from 'lucide-react';

export default function EksporLaporanPage() {
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [hydrants, setHydrants] = useState<any[]>([]);
  const [defaultMonth, setDefaultMonth] = useState<string>(jakartaMonth());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [wSnap, hSnap] = await Promise.all([
          getDocs(collection(db, 'warehouses')),
          getDocs(collection(db, 'hydrants')),
        ]);

        const wList: any[] = [];
        wSnap.forEach((d) => wList.push(d.data()));
        wList.sort((a, b) => a.name.localeCompare(b.name));
        setWarehouses(wList);

        const hList: any[] = [];
        hSnap.forEach((d) => hList.push(d.data()));
        hList.sort((a, b) => a.number.localeCompare(b.number));
        setHydrants(hList);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-slate-600">Memuat opsi laporan…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Ekspor Laporan Checksheet</h1>
        <p className="text-sm text-slate-600 mt-1">
          Unduh laporan checksheet pemeriksaan format resmi PDF (menyerupai lembar kertas) atau format Excel
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Ekspor PDF Checksheet (Format Lembar Fisik)">
          <form action="/api/laporan/pdf" method="get" target="_blank" className="space-y-4">
            <div>
              <label htmlFor="pdf-hydrant" className="label text-xs">Pilih Titik Hydrant</label>
              <select id="pdf-hydrant" name="hydrantId" required className="input text-xs">
                {hydrants.map((h: any) => (
                  <option key={h.id} value={h.id}>
                    {h.number} - {h.location_name} (Gudang {h.warehouse_name})
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

        <Card title="Ekspor Excel Rekapitulasi Checksheet">
          <form action="/api/laporan/excel" method="get" target="_blank" className="space-y-4">
            <div>
              <label htmlFor="excel-gudang" className="label text-xs">Pilih Gudang</label>
              <select id="excel-gudang" name="warehouseId" className="input text-xs">
                <option value="">Semua Gudang (WH2, WH3, WH4)</option>
                {warehouses.map((w) => (
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

'use client';

import { useAuth } from '@/lib/firebase/auth-context';
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Card } from '@/components/ui';
import { formatDate, jakartaMonth, monthRange, monthLabel } from '@/lib/period';
import { Image as ImageIcon, Building2, Filter, X, ChevronRight, Eye } from 'lucide-react';

export default function RiwayatChecksheetPage() {
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [hydrants, setHydrants] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);

  // Filter States
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('all');
  const [selectedHydrantId, setSelectedHydrantId] = useState<string>('');
  const [currentMonth, setCurrentMonth] = useState<string>(jakartaMonth());

  // Modal Foto Preview
  const [previewPhotos, setPreviewPhotos] = useState<{ photos: string[]; title: string } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [wSnap, hSnap, iSnap, insSnap] = await Promise.all([
          getDocs(collection(db, 'warehouses')),
          getDocs(collection(db, 'hydrants')),
          getDocs(collection(db, 'checklist_items')),
          getDocs(collection(db, 'inspections')),
        ]);

        const wList: any[] = [];
        wSnap.forEach((d) => wList.push(d.data()));
        wList.sort((a, b) => a.name.localeCompare(b.name));
        setWarehouses(wList);

        const hList: any[] = [];
        hSnap.forEach((d) => hList.push(d.data()));
        hList.sort((a, b) => a.number.localeCompare(b.number));
        setHydrants(hList);
        if (hList.length > 0 && !selectedHydrantId) {
          setSelectedHydrantId(hList[0].id);
        }

        const itList: any[] = [];
        iSnap.forEach((d) => itList.push(d.data()));
        itList.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        setItems(itList);

        const inList: any[] = [];
        insSnap.forEach((d) => inList.push(d.data()));
        setInspections(inList);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter Hydrant berdasarkan Gudang terpilih
  const filteredHydrants =
    selectedWarehouseId === 'all'
      ? hydrants
      : hydrants.filter((h) => h.warehouse_id === selectedWarehouseId);

  // Jika hydrant yang sedang aktif tidak ada di gudang yang dipilih, alihkan ke hydrant pertama gudang tersebut
  useEffect(() => {
    if (filteredHydrants.length > 0) {
      const exists = filteredHydrants.some((h) => h.id === selectedHydrantId);
      if (!exists) {
        setSelectedHydrantId(filteredHydrants[0].id);
      }
    }
  }, [selectedWarehouseId, filteredHydrants, selectedHydrantId]);

  const activeHydrant = hydrants.find((h) => h.id === selectedHydrantId) || filteredHydrants[0];
  const { days } = monthRange(currentMonth);

  const inspectionsByDate: Record<string, any> = {};
  inspections
    .filter((ins) => ins.hydrant_id === activeHydrant?.id)
    .forEach((ins) => {
      const d = ins.inspected_at?.slice(0, 10);
      if (d) inspectionsByDate[d] = ins;
    });

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="h-9 w-9 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-600">Memuat riwayat checksheet…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="pb-2 border-b border-slate-200/80">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Riwayat Checksheet Hydrant</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Format lembar fisik resmi pemeriksaan per titik hydrant dan tabel matriks 31 hari
        </p>
      </div>

      {/* FILTER BAR DENGAN PENYARING GUDANG */}
      <Card className="p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Filter 1: Pilih Gudang */}
          <div className="md:col-span-4">
            <label className="label text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <Building2 size={15} className="text-primary" /> Filter Gudang
            </label>
            <select
              value={selectedWarehouseId}
              onChange={(e) => setSelectedWarehouseId(e.target.value)}
              className="input text-xs font-medium"
            >
              <option value="all">Semua Gudang (WH2, WH3, WH4)</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  Gudang {wh.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 2: Pilih Titik Hydrant */}
          <div className="md:col-span-5">
            <label className="label text-xs font-bold text-slate-700 flex items-center gap-1.5 mb-1.5">
              <Filter size={15} className="text-primary" /> Pilih Titik Hydrant ({filteredHydrants.length} Titik)
            </label>
            <select
              value={selectedHydrantId}
              onChange={(e) => setSelectedHydrantId(e.target.value)}
              className="input text-xs font-medium"
            >
              {filteredHydrants.map((h: any) => (
                <option key={h.id} value={h.id}>
                  {h.number} - {h.location_name} (Gudang {h.warehouse_name})
                </option>
              ))}
              {filteredHydrants.length === 0 && (
                <option disabled value="">Tidak ada titik di gudang ini</option>
              )}
            </select>
          </div>

          {/* Filter 3: Periode Bulan */}
          <div className="md:col-span-3">
            <label className="label text-xs font-bold text-slate-700 mb-1.5 block">Periode Bulan</label>
            <input
              type="month"
              value={currentMonth}
              onChange={(e) => setCurrentMonth(e.target.value)}
              className="input text-xs font-medium"
            />
          </div>
        </div>
      </Card>

      {/* LEMBAR CHECKSHEET FISIK */}
      {activeHydrant ? (
        <div className="card bg-white p-6 sheet shadow-md overflow-x-auto space-y-6 border border-slate-300">
          <div className="border border-slate-400 p-4 rounded-xl bg-slate-50/60 shadow-inner">
            <div className="text-center font-bold text-lg text-slate-900 uppercase tracking-wider border-b border-slate-300 pb-2 mb-3">
              Checksheet Pemeriksaan Hydrant Box
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs text-slate-800">
              <div>
                <span className="text-slate-500 font-medium">No. Hydrant:</span>{' '}
                <strong className="text-sm font-bold text-slate-900">{activeHydrant.number}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Jenis Hydrant:</span>{' '}
                <strong className="font-semibold">{activeHydrant.type}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Gudang:</span>{' '}
                <strong className="font-semibold">Gudang {activeHydrant.warehouse_name}</strong>
              </div>
              <div className="sm:col-span-2">
                <span className="text-slate-500 font-medium">Lokasi Hydrant:</span>{' '}
                <strong className="font-semibold">{activeHydrant.location_name}</strong>
              </div>
              <div>
                <span className="text-slate-500 font-medium">Periode Bulan:</span>{' '}
                <strong className="text-primary font-bold">{monthLabel(currentMonth)}</strong>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-400 rounded-lg">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-800 text-center font-bold">
                  <th className="p-2 border border-slate-400 w-16">Tanggal</th>
                  {items.map((it) => (
                    <th key={it.id} className="p-2 border border-slate-400 min-w-[120px]">
                      {it.name}
                    </th>
                  ))}
                  <th className="p-2 border border-slate-400 min-w-[140px]">Catatan / Keterangan</th>
                  <th className="p-2 border border-slate-400 w-24">Foto Kondisi</th>
                  <th className="p-2 border border-slate-400 w-24">TTD Petugas</th>
                </tr>
              </thead>
              <tbody>
                {days.map((dayStr) => {
                  const ins = inspectionsByDate[dayStr];
                  const dayNum = dayStr.slice(8);
                  const resultMap = new Map(
                    (ins?.results ?? []).map((r: any) => [r.checklistItemId, r.result])
                  );

                  return (
                    <tr key={dayStr} className={`hover:bg-slate-50/80 ${ins ? 'bg-white' : 'bg-slate-50/30'}`}>
                      <td className="p-2 border border-slate-400 text-center font-bold text-slate-700">
                        {dayNum}
                      </td>

                      {items.map((it) => {
                        const res = resultMap.get(it.id);
                        return (
                          <td key={it.id} className="p-2 border border-slate-400 text-center font-medium">
                            {res === 'baik' && (
                              <span className="text-emerald-700 font-bold inline-flex items-center gap-0.5">
                                ✓ Baik
                              </span>
                            )}
                            {res === 'tidak_baik' && (
                              <span className="text-red-700 font-bold inline-flex items-center gap-0.5">
                                ✕ Rusak
                              </span>
                            )}
                            {!res && <span className="text-slate-300">-</span>}
                          </td>
                        );
                      })}

                      <td className="p-2 border border-slate-400 text-slate-700 text-xs">
                        {ins?.notes || (ins ? <span className="text-slate-400 italic">Nihil</span> : '-')}
                      </td>

                      <td className="p-2 border border-slate-400 text-center">
                        {ins?.photos && ins.photos.length > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhotos({
                                photos: ins.photos,
                                title: `Foto Pemeriksaan ${activeHydrant.number} (${dayStr})`,
                              })
                            }
                            className="inline-flex items-center gap-1 text-primary hover:underline font-semibold text-xs py-0.5 px-2 rounded bg-primary-50"
                          >
                            <ImageIcon size={13} /> {ins.photos.length} Foto
                          </button>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      <td className="p-2 border border-slate-400 text-center">
                        {ins?.signature_url ? (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewPhotos({
                                photos: [ins.signature_url],
                                title: `Tanda Tangan Petugas (${dayStr})`,
                              })
                            }
                            className="text-emerald-700 font-semibold text-[11px] hover:underline"
                          >
                            Paraf ✓
                          </button>
                        ) : ins ? (
                          <span className="text-emerald-700 font-semibold text-[11px]">Paraf ✓</span>
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
        </div>
      ) : (
        <Card className="p-10 text-center text-slate-500">
          <p className="font-semibold">Tidak ada titik hydrant yang ditemukan pada gudang terpilih.</p>
        </Card>
      )}

      {/* ================= MODAL LIGHTBOX FOTO PREVIEW ================= */}
      {previewPhotos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <strong className="text-sm text-slate-800">{previewPhotos.title}</strong>
              <button
                type="button"
                onClick={() => setPreviewPhotos(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {previewPhotos.photos.map((src, i) => (
                <div key={i} className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-slate-900 text-center">
                  <img
                    src={src}
                    alt={`Preview ${i + 1}`}
                    className="max-h-[60vh] mx-auto object-contain"
                  />
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 text-right">
              <button
                type="button"
                onClick={() => setPreviewPhotos(null)}
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

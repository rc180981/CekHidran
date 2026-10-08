'use client';

import { useAuth } from '@/lib/firebase/auth-context';
import { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Card } from '@/components/ui';
import { formatDate, jakartaMonth, monthRange, monthLabel } from '@/lib/period';
import { Image as ImageIcon } from 'lucide-react';

export default function RiwayatChecksheetPage() {
  const [loading, setLoading] = useState(true);
  const [hydrants, setHydrants] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [selectedHydrantId, setSelectedHydrantId] = useState<string>('');
  const [currentMonth, setCurrentMonth] = useState<string>(jakartaMonth());

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [hSnap, iSnap, insSnap] = await Promise.all([
          getDocs(collection(db, 'hydrants')),
          getDocs(collection(db, 'checklist_items')),
          getDocs(collection(db, 'inspections')),
        ]);

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

  const activeHydrant = hydrants.find((h) => h.id === selectedHydrantId) || hydrants[0];
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
      <div className="py-20 text-center space-y-3">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-slate-600">Memuat riwayat checksheet…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Riwayat Checksheet Hydrant</h1>
        <p className="text-sm text-slate-600 mt-1">
          Format lembar fisik checksheet per hydrant dan tabel per tanggal
        </p>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="label text-xs">Pilih Titik Hydrant</label>
            <select
              value={selectedHydrantId}
              onChange={(e) => setSelectedHydrantId(e.target.value)}
              className="input text-xs"
            >
              {hydrants.map((h: any) => (
                <option key={h.id} value={h.id}>
                  {h.number} - {h.location_name} (Gudang {h.warehouse_name})
                </option>
              ))}
            </select>
          </div>

          <div className="w-48">
            <label className="label text-xs">Pilih Bulan</label>
            <input
              type="month"
              value={currentMonth}
              onChange={(e) => setCurrentMonth(e.target.value)}
              className="input text-xs"
            />
          </div>
        </div>
      </Card>

      {activeHydrant && (
        <div className="card bg-white p-6 sheet shadow-md overflow-x-auto space-y-6">
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
                <strong>Gudang {activeHydrant.warehouse_name}</strong>
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

          <table className="w-full text-xs border border-slate-400">
            <thead>
              <tr className="bg-slate-100 text-slate-800 text-center">
                <th className="p-2 border border-slate-400 w-16">Tanggal</th>
                {items.map((it) => (
                  <th key={it.id} className="p-2 border border-slate-400 min-w-[120px]">
                    {it.name}
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
                        <td key={it.id} className="p-2 border border-slate-400 text-center">
                          {res === 'baik' && (
                            <span className="text-emerald-700 font-bold">✓ Baik</span>
                          )}
                          {res === 'tidak_baik' && (
                            <span className="text-red-700 font-bold">✕ Rusak</span>
                          )}
                          {!res && <span className="text-slate-300">-</span>}
                        </td>
                      );
                    })}

                    <td className="p-2 border border-slate-400 text-slate-700">
                      {ins?.notes || (ins ? <span className="text-slate-400 italic">Nihil</span> : '-')}
                    </td>

                    <td className="p-2 border border-slate-400 text-center">
                      {ins?.photos && ins.photos.length > 0 ? (
                        <span className="text-primary font-semibold text-xs">
                          {ins.photos.length} Foto
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    <td className="p-2 border border-slate-400 text-center">
                      {ins ? (
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
      )}
    </div>
  );
}

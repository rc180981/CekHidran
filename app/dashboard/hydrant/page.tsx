'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Card, LocationTag } from '@/components/ui';
import { Plus, Printer } from 'lucide-react';
import Link from 'next/link';

export default function KelolaHydrantPage() {
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [hydrants, setHydrants] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const [wSnap, hSnap, iSnap] = await Promise.all([
        getDocs(collection(db, 'warehouses')),
        getDocs(collection(db, 'hydrants')),
        getDocs(collection(db, 'checklist_items')),
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
      iList.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      setItems(iList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'hydrants', id), { active: !current });
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Gagal mengubah status');
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-slate-600">Memuat titik hydrant & equipment…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Kelola Titik Hydrant & Equipment</h1>
          <p className="text-sm text-slate-600 mt-1">
            Pengaturan titik hydrant 3 gudang dan master item checklist pemeriksaan
          </p>
        </div>
      </div>

      <Card title="Daftar Master Item Equipment Checklist">
        <div className="overflow-x-auto -mx-5 -my-2">
          <table className="table-base">
            <thead>
              <tr>
                <th className="w-16">Urutan</th>
                <th>Nama Item Equipment</th>
                <th>Deskripsi Petunjuk Pemeriksaan</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id}>
                  <td className="text-center font-bold text-slate-700">{it.sort_order}</td>
                  <td className="font-semibold text-slate-900">{it.name}</td>
                  <td className="text-xs text-slate-600">{it.description || '-'}</td>
                  <td>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${it.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                      {it.active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={`Daftar Titik Hydrant (${hydrants.length} Titik)`}>
        <div className="overflow-x-auto -mx-5 -my-2">
          <table className="table-base">
            <thead>
              <tr>
                <th>No. Hydrant</th>
                <th>Gudang</th>
                <th>Tipe Box</th>
                <th>Lokasi Penempatan</th>
                <th>Posisi</th>
                <th>Kode QR</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {hydrants.map((h: any) => (
                <tr key={h.id} className="hover:bg-slate-50/70">
                  <td className="font-bold text-slate-900">{h.number}</td>
                  <td className="font-medium text-slate-800">Gudang {h.warehouse_name}</td>
                  <td className="text-xs text-slate-600">{h.type}</td>
                  <td className="text-xs text-slate-800">{h.location_name}</td>
                  <td>
                    <LocationTag type={h.location_type} />
                  </td>
                  <td className="font-mono text-[11px] text-slate-500">{h.qr_code}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleToggleActive(h.id, !!h.active)}
                      className={`text-xs font-semibold hover:underline ${h.active ? 'text-red-600' : 'text-emerald-600'}`}
                    >
                      {h.active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

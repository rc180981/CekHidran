'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Card, LocationTag } from '@/components/ui';
import {
  Plus,
  Printer,
  QrCode,
  Edit2,
  Trash2,
  Download,
  X,
  CheckCircle2,
  Building2,
  Sliders,
  Filter,
} from 'lucide-react';
import QRCode from 'qrcode';

export default function KelolaHydrantPage() {
  const [loading, setLoading] = useState(true);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [hydrants, setHydrants] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);

  // Filter Gudang
  const [selectedWarehouseFilter, setSelectedWarehouseFilter] = useState<string>('all');

  // Modal State - QR
  const [qrModal, setQrModal] = useState<{ hydrant: any; qrDataUrl: string } | null>(null);

  // Modal State - Hydrant
  const [hydrantModalOpen, setHydrantModalOpen] = useState(false);
  const [editingHydrant, setEditingHydrant] = useState<any | null>(null);
  const [hydrantForm, setHydrantForm] = useState({
    number: '',
    warehouse_id: '',
    type: 'Box Hydrant Type B',
    location_name: '',
    location_type: 'indoor',
  });

  // Modal State - Checklist Item
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [itemForm, setItemForm] = useState({
    name: '',
    description: '',
    sort_order: 1,
    active: true,
  });

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

      const itList: any[] = [];
      iSnap.forEach((d) => itList.push(d.data()));
      itList.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      setItems(itList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter Hydrant berdasarkan Gudang
  const filteredHydrants =
    selectedWarehouseFilter === 'all'
      ? hydrants
      : hydrants.filter((h) => h.warehouse_id === selectedWarehouseFilter);

  // Handler Tampilkan QR
  const handleShowQr = async (h: any) => {
    try {
      const codeText = h.qr_code || `CEKHIDRAN:${h.warehouse_name}:${h.number}`;
      const url = await QRCode.toDataURL(codeText, {
        width: 450,
        margin: 2,
        color: { dark: '#0f172a', light: '#ffffff' },
      });
      setQrModal({ hydrant: h, qrDataUrl: url });
    } catch (err) {
      console.error('Gagal generate QR Code:', err);
      alert('Gagal membuat gambar QR Code.');
    }
  };

  // Unduh Gambar PNG QR Code
  const handleDownloadQr = () => {
    if (!qrModal) return;
    const a = document.createElement('a');
    a.href = qrModal.qrDataUrl;
    a.download = `QR-${qrModal.hydrant.number}-${qrModal.hydrant.warehouse_name || 'WH'}.png`;
    a.click();
  };

  // Cetak QR Code
  const handlePrintQr = () => {
    if (!qrModal) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>Cetak QR - ${qrModal.hydrant.number}</title>
          <style>
            body { font-family: sans-serif; text-align: center; padding: 40px; }
            .card { border: 2px solid #000; padding: 20px; display: inline-block; border-radius: 12px; }
            h2 { margin: 0 0 8px 0; font-size: 24px; }
            p { margin: 4px 0; font-size: 14px; color: #444; }
            img { width: 300px; height: 300px; margin: 16px 0; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>${qrModal.hydrant.number}</h2>
            <p>Gudang ${qrModal.hydrant.warehouse_name} · ${qrModal.hydrant.type}</p>
            <p>${qrModal.hydrant.location_name}</p>
            <img src="${qrModal.qrDataUrl}" />
            <p style="font-family: monospace; font-size: 11px;">${qrModal.hydrant.qr_code}</p>
          </div>
          <script>window.onload = function() { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Simpan Hydrant (Add / Edit)
  const handleSaveHydrant = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const wh = warehouses.find((w) => w.id === hydrantForm.warehouse_id) || warehouses[0];
      const whId = wh?.id || 'wh2';
      const whName = wh?.name || 'WH2';

      if (editingHydrant) {
        // Update
        await updateDoc(doc(db, 'hydrants', editingHydrant.id), {
          number: hydrantForm.number,
          warehouse_id: whId,
          warehouse_name: whName,
          type: hydrantForm.type,
          location_name: hydrantForm.location_name,
          location_type: hydrantForm.location_type,
          qr_code: `CEKHIDRAN:${whName}:${hydrantForm.number}`,
          updated_at: new Date().toISOString(),
        });
      } else {
        // Create new
        const newId = `${whId}_${hydrantForm.number.replace(/[^a-zA-Z0-9]/g, '')}`;
        await setDoc(doc(db, 'hydrants', newId), {
          id: newId,
          number: hydrantForm.number,
          warehouse_id: whId,
          warehouse_name: whName,
          type: hydrantForm.type,
          location_name: hydrantForm.location_name,
          location_type: hydrantForm.location_type,
          qr_code: `CEKHIDRAN:${whName}:${hydrantForm.number}`,
          active: true,
          created_at: new Date().toISOString(),
        });
      }

      setHydrantModalOpen(false);
      setEditingHydrant(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan data titik hydrant.');
    }
  };

  // Hapus Hydrant
  const handleDeleteHydrant = async (h: any) => {
    if (confirm(`Yakin ingin menghapus titik hydrant ${h.number} (Gudang ${h.warehouse_name})?`)) {
      try {
        await deleteDoc(doc(db, 'hydrants', h.id));
        fetchData();
      } catch (err) {
        console.error(err);
        alert('Gagal menghapus titik hydrant.');
      }
    }
  };

  // Simpan Checklist Item (Add / Edit)
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await updateDoc(doc(db, 'checklist_items', editingItem.id), {
          name: itemForm.name,
          description: itemForm.description,
          sort_order: Number(itemForm.sort_order),
          active: itemForm.active,
        });
      } else {
        const newItemId = `item_${Date.now()}`;
        await setDoc(doc(db, 'checklist_items', newItemId), {
          id: newItemId,
          name: itemForm.name,
          description: itemForm.description,
          sort_order: Number(itemForm.sort_order),
          active: itemForm.active,
        });
      }

      setItemModalOpen(false);
      setEditingItem(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan item checklist.');
    }
  };

  // Hapus Checklist Item
  const handleDeleteItem = async (it: any) => {
    if (confirm(`Yakin ingin menghapus item equipment checklist "${it.name}"?`)) {
      try {
        await deleteDoc(doc(db, 'checklist_items', it.id));
        fetchData();
      } catch (err) {
        console.error(err);
        alert('Gagal menghapus item checklist.');
      }
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="h-9 w-9 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-600">Memuat titik hydrant & master equipment…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Kelola Titik Hydrant & Equipment</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Pengaturan master titik box hydrant 3 gudang, cetak stiker QR Code, dan master equipment checklist
          </p>
        </div>
      </div>

      {/* SEKSI 1 (ATAS): DAFTAR MASTER ITEM CHECKLIST */}
      <Card
        title={
          <span className="font-bold text-slate-900 text-base">
            Daftar Master Item Equipment Checklist ({items.length} Item)
          </span>
        }
        action={
          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setItemForm({
                name: '',
                description: '',
                sort_order: items.length + 1,
                active: true,
              });
              setItemModalOpen(true);
            }}
            className="btn-primary text-xs px-3.5 py-1.5 h-8 flex items-center gap-1.5 shadow-sm"
          >
            <Plus size={15} /> Tambah Item Checklist
          </button>
        }
      >
        <div className="overflow-x-auto -mx-5 -my-2">
          <table className="table-base">
            <thead>
              <tr>
                <th className="w-16 text-center">Urutan</th>
                <th>Nama Item Equipment</th>
                <th>Petunjuk & Deskripsi Pemeriksaan</th>
                <th>Status</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="text-center font-bold text-slate-700">{it.sort_order}</td>
                  <td className="font-bold text-slate-900 text-sm">{it.name}</td>
                  <td className="text-xs text-slate-600 max-w-md">{it.description || '-'}</td>
                  <td>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                        it.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {it.active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingItem(it);
                          setItemForm({
                            name: it.name,
                            description: it.description || '',
                            sort_order: it.sort_order || 1,
                            active: !!it.active,
                          });
                          setItemModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 transition"
                        title="Edit Item"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteItem(it)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
                        title="Hapus Item"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* SEKSI 2 (BAWAH): DAFTAR TITIK HYDRANT */}
      <Card
        title={
          <span className="font-bold text-slate-900 text-base">
            Daftar Titik Hydrant ({filteredHydrants.length} Titik)
          </span>
        }
        action={
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Filter size={14} className="text-slate-400" />
              <select
                value={selectedWarehouseFilter}
                onChange={(e) => setSelectedWarehouseFilter(e.target.value)}
                className="input text-xs py-1 px-2.5 h-8 font-medium bg-slate-50 border-slate-200"
              >
                <option value="all">Semua Gudang</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    Gudang {wh.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingHydrant(null);
                setHydrantForm({
                  number: '',
                  warehouse_id: warehouses[0]?.id || 'wh2',
                  type: 'Box Hydrant Type B',
                  location_name: '',
                  location_type: 'indoor',
                });
                setHydrantModalOpen(true);
              }}
              className="btn-primary text-xs px-3.5 py-1.5 h-8 flex items-center gap-1.5 shadow-sm"
            >
              <Plus size={15} /> Tambah Titik Hydrant
            </button>
          </div>
        }
      >
        <div className="max-h-[520px] overflow-y-auto overflow-x-auto -mx-5 -my-2 border-y border-slate-200 shadow-inner">
          <table className="table-base relative">
            <thead className="sticky top-0 bg-slate-100 z-10 shadow-sm border-b border-slate-200">
              <tr>
                <th className="bg-slate-100 font-bold text-slate-800">No. Hydrant</th>
                <th className="bg-slate-100 font-bold text-slate-800">Gudang</th>
                <th className="bg-slate-100 font-bold text-slate-800">Tipe Box</th>
                <th className="bg-slate-100 font-bold text-slate-800">Lokasi Penempatan</th>
                <th className="bg-slate-100 font-bold text-slate-800">Posisi</th>
                <th className="bg-slate-100 font-bold text-slate-800">Kode QR & Stiker</th>
                <th className="text-right bg-slate-100 font-bold text-slate-800">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredHydrants.map((h: any) => (
                <tr key={h.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="font-bold text-slate-900">{h.number}</td>
                  <td className="font-medium text-slate-800 text-xs">Gudang {h.warehouse_name}</td>
                  <td className="text-xs text-slate-600">{h.type}</td>
                  <td className="text-xs text-slate-800 max-w-xs">{h.location_name}</td>
                  <td>
                    <LocationTag type={h.location_type} />
                  </td>
                  <td>
                    <button
                      type="button"
                      onClick={() => handleShowQr(h)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 hover:bg-teal-100 text-xs font-semibold transition"
                    >
                      <QrCode size={13} /> QR & Cetak
                    </button>
                  </td>
                  <td className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingHydrant(h);
                          setHydrantForm({
                            number: h.number,
                            warehouse_id: h.warehouse_id,
                            type: h.type,
                            location_name: h.location_name,
                            location_type: h.location_type,
                          });
                          setHydrantModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 transition"
                        title="Edit Hydrant"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteHydrant(h)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
                        title="Hapus Hydrant"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredHydrants.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-slate-500 text-sm">
                    Tidak ada titik hydrant ditemukan pada gudang ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ================= MODAL PREVIEW QR CODE & CETAK ================= */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full overflow-hidden border border-slate-200 text-center p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <strong className="text-sm font-bold text-slate-900">
                Stiker QR Code Box Hydrant
              </strong>
              <button
                type="button"
                onClick={() => setQrModal(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                {qrModal.hydrant.number} · Gudang {qrModal.hydrant.warehouse_name}
              </span>
              <p className="text-xs text-slate-600">{qrModal.hydrant.location_name}</p>
            </div>

            <div className="p-3 bg-white border border-slate-200 rounded-2xl shadow-inner inline-block">
              <img
                src={qrModal.qrDataUrl}
                alt="QR Code"
                className="w-56 h-56 mx-auto object-contain"
              />
            </div>

            <p className="font-mono text-[10px] text-slate-400 bg-slate-50 p-1.5 rounded-lg select-all">
              {qrModal.hydrant.qr_code}
            </p>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={handleDownloadQr}
                className="btn-primary text-xs py-2 flex items-center justify-center gap-1.5"
              >
                <Download size={14} /> Simpan PNG
              </button>
              <button
                type="button"
                onClick={handlePrintQr}
                className="btn-secondary text-xs py-2 flex items-center justify-center gap-1.5"
              >
                <Printer size={14} /> Cetak Stiker
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL TAMBAH / EDIT HYDRANT ================= */}
      {hydrantModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <strong className="text-slate-900 text-sm font-bold">
                {editingHydrant ? 'Edit Titik Hydrant' : 'Tambah Titik Hydrant Baru'}
              </strong>
              <button
                type="button"
                onClick={() => setHydrantModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveHydrant} className="p-5 space-y-4">
              <div>
                <label className="label text-xs font-bold text-slate-700 mb-1 block">Nomor Hydrant</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: H-19"
                  value={hydrantForm.number}
                  onChange={(e) => setHydrantForm({ ...hydrantForm, number: e.target.value })}
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="label text-xs font-bold text-slate-700 mb-1 block">Pilih Gudang</label>
                <select
                  value={hydrantForm.warehouse_id}
                  onChange={(e) => setHydrantForm({ ...hydrantForm, warehouse_id: e.target.value })}
                  className="input text-xs"
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      Gudang {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label text-xs font-bold text-slate-700 mb-1 block">Tipe Box Hydrant</label>
                <input
                  type="text"
                  required
                  value={hydrantForm.type}
                  onChange={(e) => setHydrantForm({ ...hydrantForm, type: e.target.value })}
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="label text-xs font-bold text-slate-700 mb-1 block">Lokasi Detail</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Dalam gudang – Area Rak D 1"
                  value={hydrantForm.location_name}
                  onChange={(e) => setHydrantForm({ ...hydrantForm, location_name: e.target.value })}
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="label text-xs font-bold text-slate-700 mb-1 block">Posisi Lokasi</label>
                <select
                  value={hydrantForm.location_type}
                  onChange={(e) => setHydrantForm({ ...hydrantForm, location_type: e.target.value })}
                  className="input text-xs"
                >
                  <option value="indoor">Indoor (Dalam Gudang)</option>
                  <option value="outdoor">Outdoor (Luar Gudang)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setHydrantModalOpen(false)}
                  className="btn-secondary text-xs px-3.5 py-2"
                >
                  Batal
                </button>
                <button type="submit" className="btn-primary text-xs px-4 py-2">
                  Simpan Titik Hydrant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL TAMBAH / EDIT CHECKLIST ITEM ================= */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <strong className="text-slate-900 text-sm font-bold">
                {editingItem ? 'Edit Item Equipment Checklist' : 'Tambah Item Equipment Baru'}
              </strong>
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 space-y-4">
              <div>
                <label className="label text-xs font-bold text-slate-700 mb-1 block">Nama Item Equipment</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Nozzle Spray & Kopling"
                  value={itemForm.name}
                  onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="label text-xs font-bold text-slate-700 mb-1 block">Petunjuk / Kriteria Cek</label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Nozzle terpasang rapi, ulir tidak aus, mudah diputar"
                  value={itemForm.description}
                  onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                  className="input text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs font-bold text-slate-700 mb-1 block">Nomor Urut</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={itemForm.sort_order}
                    onChange={(e) => setItemForm({ ...itemForm, sort_order: Number(e.target.value) })}
                    className="input text-xs"
                  />
                </div>
                <div>
                  <label className="label text-xs font-bold text-slate-700 mb-1 block">Status</label>
                  <select
                    value={itemForm.active ? '1' : '0'}
                    onChange={(e) => setItemForm({ ...itemForm, active: e.target.value === '1' })}
                    className="input text-xs"
                  >
                    <option value="1">Aktif</option>
                    <option value="0">Nonaktif</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
                  className="btn-secondary text-xs px-3.5 py-2"
                >
                  Batal
                </button>
                <button type="submit" className="btn-primary text-xs px-4 py-2">
                  Simpan Item Checklist
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

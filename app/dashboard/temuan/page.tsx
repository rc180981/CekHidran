'use client';

import { useAuth } from '@/lib/firebase/auth-context';
import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Card, StatusBadge } from '@/components/ui';
import { formatDate } from '@/lib/period';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Image as ImageIcon,
  X,
  Eye,
  ArrowRight,
  ShieldAlert,
  Building2,
  Calendar,
} from 'lucide-react';

export default function TemuanPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [findings, setFindings] = useState<any[]>([]);
  const [inspections, setInspections] = useState<any[]>([]);
  const [hydrants, setHydrants] = useState<any[]>([]);

  // Filter Status
  const [statusFilter, setStatusFilter] = useState<'all' | 'terbuka' | 'dalam_perbaikan' | 'selesai'>('all');

  // Modal Lightbox Foto
  const [lightbox, setLightbox] = useState<{ src: string; caption: string } | null>(null);

  // Modal Verifikasi / Update Temuan
  const [updatingFinding, setUpdatingFinding] = useState<any | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [newStatus, setNewStatus] = useState<string>('dalam_perbaikan');

  const fetchData = async () => {
    try {
      const [fSnap, iSnap, hSnap] = await Promise.all([
        getDocs(collection(db, 'findings')),
        getDocs(collection(db, 'inspections')),
        getDocs(collection(db, 'hydrants')),
      ]);

      const fList: any[] = [];
      fSnap.forEach((d) => fList.push({ id: d.id, ...d.data() }));
      fList.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      setFindings(fList);

      const iList: any[] = [];
      iSnap.forEach((d) => iList.push({ id: d.id, ...d.data() }));
      // Urutkan inspeksi dari yang paling baru
      iList.sort((a, b) => (b.inspected_at || '').localeCompare(a.inspected_at || ''));
      setInspections(iList);

      const hList: any[] = [];
      hSnap.forEach((d) => hList.push({ id: d.id, ...d.data() }));
      setHydrants(hList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveResolution = async () => {
    if (!updatingFinding) return;
    try {
      await updateDoc(doc(db, 'findings', updatingFinding.id), {
        status: newStatus,
        resolution_notes: resolutionNote,
        closed_at: newStatus === 'selesai' ? new Date().toISOString() : null,
        closed_by_name: newStatus === 'selesai' ? profile?.name || 'Petugas K3' : null,
        updated_at: new Date().toISOString(),
      });
      setUpdatingFinding(null);
      setResolutionNote('');
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Gagal memperbarui status temuan.');
    }
  };

  const filteredFindings =
    statusFilter === 'all'
      ? findings
      : findings.filter((f) => f.status === statusFilter);

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="h-9 w-9 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-600">Memuat data temuan K3 & arsip foto…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Temuan Kondisi & Perbaikan K3</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Riwayat temuan tidak baik, perbandingan foto kondisi normal vs kerusakan, serta verifikasi tindakan K3
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-800">
            {findings.filter((f) => f.status === 'terbuka').length} Temuan Terbuka
          </span>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { key: 'all', label: `Semua (${findings.length})` },
          { key: 'terbuka', label: `Terbuka (${findings.filter((f) => f.status === 'terbuka').length})` },
          { key: 'dalam_perbaikan', label: `Dalam Perbaikan (${findings.filter((f) => f.status === 'dalam_perbaikan').length})` },
          { key: 'selesai', label: `Selesai (${findings.filter((f) => f.status === 'selesai').length})` },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key as any)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
              statusFilter === tab.key
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* LIST KARTU TEMUAN */}
      <div className="space-y-5">
        {filteredFindings.map((f: any) => {
          const hydrant = hydrants.find((h) => h.id === f.hydrant_id);
          const currentIns = inspections.find((i) => i.id === f.inspection_id);

          // 1. Foto Saat Temuan (Inspeksi saat ini)
          const currentPhoto =
            f.photo_url ||
            (currentIns?.photos && currentIns.photos.length > 0
              ? currentIns.photos[currentIns.photos.length - 1]
              : null);

          // 2. Foto Normal Sebelumnya (Cari inspeksi terdahulu di hydrant yang sama)
          const prevIns = inspections.find(
            (i) =>
              i.hydrant_id === f.hydrant_id &&
              i.id !== f.inspection_id &&
              (i.inspected_at || '') < (currentIns?.inspected_at || f.created_at) &&
              i.photos &&
              i.photos.length > 0
          );
          const previousPhoto = prevIns ? prevIns.photos[0] : null;

          return (
            <Card key={f.id} className="p-5 shadow-sm border border-slate-200">
              <div className="space-y-4">
                {/* Header Kartu Temuan */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-base font-bold text-slate-900">
                      {hydrant?.number || f.hydrant_number || 'Titik Hydrant'}
                    </span>
                    <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      Gudang {hydrant?.warehouse_name || f.warehouse_name || '-'}
                    </span>
                    <span className="text-xs text-slate-500">· {hydrant?.location_name || f.location_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={f.status} />
                    <button
                      type="button"
                      onClick={() => {
                        setUpdatingFinding(f);
                        setNewStatus(f.status === 'terbuka' ? 'dalam_perbaikan' : f.status);
                        setResolutionNote(f.resolution_notes || '');
                      }}
                      className="btn-secondary text-xs px-3 py-1 font-semibold"
                    >
                      Update Tindakan K3
                    </button>
                  </div>
                </div>

                {/* Deskripsi Temuan */}
                <div className="p-3 bg-red-50/60 rounded-xl border border-red-200/80 text-xs space-y-1">
                  <strong className="text-red-950 font-bold block text-sm">
                    ⚠️ Deskripsi Temuan Kerusakan:
                  </strong>
                  <p className="text-red-900 leading-relaxed font-medium">{f.description}</p>
                </div>

                {/* KOMPARASI FOTO BERDAMPINGAN (SEBELUM VS SAAT TEMUAN) */}
                <div className="pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                    <ImageIcon size={14} className="text-primary" /> Perbandingan Bukti Foto (Normal vs Temuan)
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* FOTO 1: KONDISI NORMAL SEBELUMNYA */}
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-2.5 flex items-center gap-3">
                      {previousPhoto ? (
                        <div
                          onClick={() =>
                            setLightbox({
                              src: previousPhoto,
                              caption: `Foto Normal Sebelumnya - ${hydrant?.number} (${formatDate(prevIns?.inspected_at)})`,
                            })
                          }
                          className="relative w-28 h-20 sm:w-32 sm:h-20 rounded-lg overflow-hidden bg-slate-900 cursor-pointer group shadow-sm border border-emerald-300 shrink-0"
                          title="Klik untuk melihat ukuran normal"
                        >
                          <img
                            src={previousPhoto}
                            alt="Foto Normal Sebelumnya"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold gap-1">
                            <Eye size={13} /> Zoom
                          </div>
                        </div>
                      ) : (
                        <div className="w-28 h-20 sm:w-32 sm:h-20 rounded-lg border-2 border-dashed border-emerald-200 bg-white flex flex-col items-center justify-center text-center p-1 text-emerald-600 shrink-0">
                          <CheckCircle2 size={18} className="opacity-60" />
                          <span className="text-[10px] font-medium leading-tight mt-1">Tanpa Foto</span>
                        </div>
                      )}

                      <div className="text-xs space-y-1 overflow-hidden">
                        <div className="font-bold text-emerald-800 flex items-center gap-1">
                          🟢 Kondisi Normal (Lalu)
                        </div>
                        <div className="text-[11px] text-emerald-700 truncate">
                          {prevIns ? formatDate(prevIns.inspected_at) : 'Arsip Awal'}
                        </div>
                        {previousPhoto && (
                          <button
                            type="button"
                            onClick={() =>
                              setLightbox({
                                src: previousPhoto,
                                caption: `Foto Normal Sebelumnya - ${hydrant?.number} (${formatDate(prevIns?.inspected_at)})`,
                              })
                            }
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 hover:underline"
                          >
                            <Eye size={12} /> Buka Ukuran Normal
                          </button>
                        )}
                      </div>
                    </div>

                    {/* FOTO 2: SAAT TEMUAN KERUSAKAN */}
                    <div className="rounded-xl border border-red-200 bg-red-50/40 p-2.5 flex items-center gap-3">
                      {currentPhoto ? (
                        <div
                          onClick={() =>
                            setLightbox({
                              src: currentPhoto,
                              caption: `Foto Bukti Temuan Kerusakan - ${hydrant?.number} (${formatDate(f.created_at)})`,
                            })
                          }
                          className="relative w-28 h-20 sm:w-32 sm:h-20 rounded-lg overflow-hidden bg-slate-900 cursor-pointer group shadow-sm border border-red-300 shrink-0"
                          title="Klik untuk melihat ukuran normal"
                        >
                          <img
                            src={currentPhoto}
                            alt="Foto Temuan Kerusakan"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[10px] font-bold gap-1">
                            <Eye size={13} /> Zoom
                          </div>
                        </div>
                      ) : (
                        <div className="w-28 h-20 sm:w-32 sm:h-20 rounded-lg border-2 border-dashed border-red-200 bg-white flex flex-col items-center justify-center text-center p-1 text-red-600 shrink-0">
                          <AlertTriangle size={18} className="opacity-60" />
                          <span className="text-[10px] font-medium leading-tight mt-1">Belum Ada Foto</span>
                        </div>
                      )}

                      <div className="text-xs space-y-1 overflow-hidden">
                        <div className="font-bold text-red-800 flex items-center gap-1">
                          🔴 Bukti Temuan (Saat Ini)
                        </div>
                        <div className="text-[11px] text-red-700 truncate">
                          {formatDate(f.created_at || currentIns?.inspected_at)}
                        </div>
                        {currentPhoto && (
                          <button
                            type="button"
                            onClick={() =>
                              setLightbox({
                                src: currentPhoto,
                                caption: `Foto Bukti Temuan Kerusakan - ${hydrant?.number} (${formatDate(f.created_at)})`,
                              })
                            }
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-800 hover:underline"
                          >
                            <Eye size={12} /> Buka Ukuran Normal
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Informasi & Catatan Penanganan */}
                <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
                  <div>
                    Dilaporkan pada: <strong>{formatDate(f.created_at, 'long')}</strong>
                    {f.closed_at && (
                      <span className="ml-3 text-emerald-800 font-semibold">
                        ✓ Diselesaikan oleh <strong>{f.closed_by_name || 'Petugas K3'}</strong> pada{' '}
                        {formatDate(f.closed_at)}
                      </span>
                    )}
                  </div>
                </div>

                {f.resolution_notes && (
                  <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-200">
                    <strong className="text-slate-900">Catatan Penanganan K3:</strong> {f.resolution_notes}
                  </div>
                )}
              </div>
            </Card>
          );
        })}

        {filteredFindings.length === 0 && (
          <Card className="p-12 text-center text-slate-500">
            <CheckCircle2 size={40} className="mx-auto text-emerald-600 mb-2" />
            <h3 className="font-bold text-slate-800 text-base">Tidak Ada Temuan Sesuai Filter</h3>
            <p className="text-xs text-slate-500 mt-1">
              Seluruh equipment hydrant berada dalam kondisi operasional yang baik.
            </p>
          </Card>
        )}
      </div>

      {/* ================= MODAL UPDATE TINDAKAN K3 ================= */}
      {updatingFinding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <strong className="text-slate-900 text-sm font-bold">
                Update Tindakan K3 – {updatingFinding.hydrant_number || 'Temuan'}
              </strong>
              <button
                type="button"
                onClick={() => setUpdatingFinding(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label text-xs font-bold text-slate-700 mb-1 block">Pilih Status Penanganan</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="input text-xs font-medium"
                >
                  <option value="terbuka">Terbuka (Belum Ditangani)</option>
                  <option value="dalam_perbaikan">Dalam Perbaikan (Sedang Dikerjakan)</option>
                  <option value="selesai">Selesai (Kerusakan Telah Diperbaiki)</option>
                </select>
              </div>

              <div>
                <label className="label text-xs font-bold text-slate-700 mb-1 block">
                  Catatan Tindakan & Perbaikan
                </label>
                <textarea
                  rows={3}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Contoh: Packing seal telah diganti dengan part baru, tekanan valve sudah normal 6 bar."
                  className="input text-xs"
                />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUpdatingFinding(null)}
                className="btn-secondary text-xs px-3 py-2"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveResolution}
                className="btn-primary text-xs px-4 py-2"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL LIGHTBOX FOTO ZOOM ================= */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-150 cursor-zoom-out"
        >
          <div className="max-w-3xl w-full text-center space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="relative inline-block rounded-2xl overflow-hidden border border-white/20 shadow-2xl bg-black">
              <img src={lightbox.src} alt="Zoom" className="max-h-[80vh] w-auto mx-auto object-contain" />
              <button
                type="button"
                onClick={() => setLightbox(null)}
                className="absolute top-3 right-3 bg-black/60 text-white p-2 rounded-full hover:bg-black/90 transition"
              >
                <X size={20} />
              </button>
            </div>
            <p className="text-white text-xs font-semibold">{lightbox.caption}</p>
          </div>
        </div>
      )}
    </div>
  );
}

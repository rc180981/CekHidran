'use client';

import { useEffect, useState, useCallback } from 'react';
import { doc, getDoc, setDoc, collection, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/lib/firebase/auth-context';
import { Card } from '@/components/ui';
import {
  Save,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Loader2,
  Calendar,
  FileText,
  Image as ImageIcon,
  X,
} from 'lucide-react';
import { jakartaMonth, monthLabel } from '@/lib/period';

export default function PengaturanPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin_sistem';

  // State Pengaturan Frekuensi
  const [frequency, setFrequency] = useState<'harian' | 'bulanan'>('harian');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // State Manajemen Data Input (Admin Only)
  const [inspectionsCount, setInspectionsCount] = useState<number>(0);
  const [findingsCount, setFindingsCount] = useState<number>(0);
  const [photosCount, setPhotosCount] = useState<number>(0);
  const [loadingStats, setLoadingStats] = useState(false);

  // Modal Konfirmasi Hapus Data Input
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteScope, setDeleteScope] = useState<'all' | 'month'>('all');
  const [deleteMonth, setDeleteMonth] = useState<string>(jakartaMonth());
  const [confirmInput, setConfirmInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteFeedback, setDeleteFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // 1. Ambil pengaturan frekuensi
  const fetchSettings = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, 'app_settings', 'inspection_frequency'));
      if (snap.exists()) {
        setFrequency(snap.data().value || 'harian');
      }
    } catch (e) {
      console.error('Gagal mengambil app_settings:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // 2. Ambil statistik data input transaksi (Inspeksi, Temuan, Foto)
  const fetchInputStats = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingStats(true);
    try {
      const [insSnap, fSnap] = await Promise.all([
        getDocs(collection(db, 'inspections')),
        getDocs(collection(db, 'findings')),
      ]);

      let totalPhotos = 0;
      insSnap.forEach((d) => {
        const data = d.data();
        if (Array.isArray(data.photos)) {
          totalPhotos += data.photos.length;
        }
        if (data.signature_url) {
          totalPhotos += 1;
        }
        if (Array.isArray(data.results)) {
          data.results.forEach((r: any) => {
            if (r.photo_url) totalPhotos += 1;
          });
        }
      });

      fSnap.forEach((d) => {
        const data = d.data();
        if (data.resolved_photo_url) totalPhotos += 1;
      });

      setInspectionsCount(insSnap.size);
      setFindingsCount(fSnap.size);
      setPhotosCount(totalPhotos);
    } catch (e) {
      console.error('Gagal mengambil statistik data input:', e);
    } finally {
      setLoadingStats(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (isAdmin) {
      fetchInputStats();
    }
  }, [isAdmin, fetchInputStats]);

  // Handler Simpan Pengaturan Frekuensi
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    try {
      await setDoc(
        doc(db, 'app_settings', 'inspection_frequency'),
        {
          key: 'inspection_frequency',
          value: frequency,
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      );
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      console.error(e);
      alert('Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  // Handler Eksekusi Hapus Data Input (Inspections & Findings beserta gambar)
  const handleExecuteDelete = async () => {
    if (confirmInput.trim().toUpperCase() !== 'HAPUS') {
      alert('Kata konfirmasi salah. Harap ketik "HAPUS" dengan benar.');
      return;
    }

    setDeleting(true);
    setDeleteFeedback(null);

    try {
      // 1. Ambil dokumen target inspeksi & temuan
      const [insSnap, fSnap] = await Promise.all([
        getDocs(collection(db, 'inspections')),
        getDocs(collection(db, 'findings')),
      ]);

      const insDocsToDelete: string[] = [];
      insSnap.forEach((d) => {
        const data = d.data();
        if (deleteScope === 'all') {
          insDocsToDelete.push(d.id);
        } else {
          // Filter bulan YYYY-MM
          const insDate = data.inspected_at || data.created_at || '';
          if (insDate.startsWith(deleteMonth)) {
            insDocsToDelete.push(d.id);
          }
        }
      });

      const fDocsToDelete: string[] = [];
      fSnap.forEach((d) => {
        const data = d.data();
        if (deleteScope === 'all') {
          fDocsToDelete.push(d.id);
        } else {
          const fDate = data.created_at || '';
          // Cek apakah temuan dibuat pada bulan ini atau berasal dari inspeksi yang dihapus
          if (fDate.startsWith(deleteMonth) || insDocsToDelete.includes(data.inspection_id)) {
            fDocsToDelete.push(d.id);
          }
        }
      });

      if (insDocsToDelete.length === 0 && fDocsToDelete.length === 0) {
        setDeleteFeedback({
          type: 'error',
          message: 'Tidak ada data input yang sesuai dengan kriteria yang dipilih.',
        });
        setDeleting(false);
        return;
      }

      // 2. Eksekusi Hapus Dokumen secara Batch (Maksimal 400 dokumen per batch)
      const allDeletes = [
        ...insDocsToDelete.map((id) => ({ col: 'inspections', id })),
        ...fDocsToDelete.map((id) => ({ col: 'findings', id })),
      ];

      const BATCH_SIZE = 350;
      for (let i = 0; i < allDeletes.length; i += BATCH_SIZE) {
        const chunk = allDeletes.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach((item) => {
          batch.delete(doc(db, item.col, item.id));
        });
        await batch.commit();
      }

      // 3. Sukses & Perbarui Statistik
      const totalDeleted = allDeletes.length;
      setShowDeleteModal(false);
      setConfirmInput('');
      setDeleteFeedback({
        type: 'success',
        message: `Berhasil menghapus ${insDocsToDelete.length} data pemeriksaan dan ${fDocsToDelete.length} data temuan K3 beserta seluruh file gambar terkait. Total: ${totalDeleted} dokumen.`,
      });

      // Refresh statistik
      await fetchInputStats();
    } catch (err: any) {
      console.error('Gagal menghapus data input:', err);
      setDeleteFeedback({
        type: 'error',
        message: 'Gagal menghapus data: ' + (err?.message || 'Terjadi kesalahan sistem'),
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-slate-600">Memuat pengaturan…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Halaman */}
      <div className="pb-2 border-b border-slate-200/80">
        <h1 className="text-2xl font-black tracking-wider text-slate-900 uppercase">
          PENGATURAN SISTEM CEK HIDRAN
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 uppercase font-semibold">
          KONFIGURASI FREKUENSI PEMERIKSAAN DAN PARAMETER OPERASIONAL K3
        </p>
      </div>

      {/* Pesan Feedback Global */}
      {deleteFeedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-semibold flex items-start gap-2.5 transition-all ${
            deleteFeedback.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}
        >
          {deleteFeedback.type === 'success' ? (
            <CheckCircle2 size={18} className="text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <span className="font-bold block mb-0.5">
              {deleteFeedback.type === 'success' ? 'Operasi Berhasil' : 'Operasi Gagal'}
            </span>
            <p className="leading-relaxed">{deleteFeedback.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setDeleteFeedback(null)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
          >
            <X size={15} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* KARTU 1: FREKUENSI PEMERIKSAAN */}
        <Card title="FREKUENSI PEMERIKSAAN HYDRANT">
          <form onSubmit={handleSave} className="space-y-5">
            <p className="text-xs text-slate-600 leading-relaxed">
              Pilihan frekuensi menentukan periode acuan dashboard dan laporan dalam menghitung status
              "sudah dicek" atau "belum dicek".
            </p>

            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
                <input
                  type="radio"
                  name="frequency"
                  value="harian"
                  checked={frequency === 'harian'}
                  onChange={() => setFrequency('harian')}
                  className="mt-1 text-primary focus:ring-primary"
                />
                <div>
                  <strong className="text-sm text-slate-900 block">Pemeriksaan Harian (Default)</strong>
                  <span className="text-xs text-slate-500">
                    Target pemeriksaan diulang setiap hari berjalan. Titik yang belum diperiksa hari ini
                    ditandai Belum Dicek.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50 transition">
                <input
                  type="radio"
                  name="frequency"
                  value="bulanan"
                  checked={frequency === 'bulanan'}
                  onChange={() => setFrequency('bulanan')}
                  className="mt-1 text-primary focus:ring-primary"
                />
                <div>
                  <strong className="text-sm text-slate-900 block">Pemeriksaan Bulanan</strong>
                  <span className="text-xs text-slate-500">
                    Target pemeriksaan dihitung satu siklus per bulan kalender.
                  </span>
                </div>
              </label>
            </div>

            {success && (
              <p className="text-xs text-emerald-800 bg-emerald-50 p-3 rounded-xl border border-emerald-200 font-semibold">
                ✓ Pengaturan berhasil disimpan!
              </p>
            )}

            <div className="flex justify-end pt-2">
              <button type="submit" disabled={saving} className="btn-primary text-xs min-h-[44px]">
                <Save size={16} /> {saving ? 'Menyimpan…' : 'Simpan Pengaturan'}
              </button>
            </div>
          </form>
        </Card>

        {/* KARTU 2: FITUR DELETE DATA INPUT (KHUSUS ROLE ADMIN) */}
        {isAdmin && (
          <div className="card p-5 sm:p-6 border-2 border-red-200 bg-gradient-to-b from-white to-red-50/20 shadow-xs space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-red-100">
              <div className="flex items-center gap-2">
                <ShieldAlert size={20} className="text-red-600 shrink-0" />
                <div>
                  <h2 className="text-sm font-black uppercase tracking-wider text-slate-900">
                    MANAJEMEN DATA INPUT &amp; RIWAYAT
                  </h2>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-100/80 px-2 py-0.5 rounded-full inline-block mt-0.5">
                    Khusus Role Admin Sistem
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={fetchInputStats}
                disabled={loadingStats}
                title="Perbarui Statistik Data"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <RefreshCw size={15} className={loadingStats ? 'animate-spin' : ''} />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Fitur ini digunakan oleh Admin Sistem untuk membersihkan atau mereset data input hasil
              pemeriksaan petugas beserta file foto fisik dan tanda tangan digital (misalnya setelah
              masa testing atau awal siklus baru).
            </p>

            {/* Kotak Info Master Data Aman */}
            <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
              <strong className="block font-bold mb-1">🛡️ Keamanan Master Data:</strong>
              Master data sistem (daftar titik hydrant, gudang, checklist acuan K3, dan akun pengguna)
              <strong> TIDAK akan terhapus</strong>. Hanya data transaksi hasil input yang dibersihkan.
            </div>

            {/* Statistik Data Input Saat Ini */}
            <div className="grid grid-cols-3 gap-2.5 pt-1">
              <div className="p-3 rounded-xl bg-white border border-slate-200/90 text-center shadow-2xs">
                <FileText size={16} className="mx-auto text-blue-600 mb-1" />
                <div className="text-lg font-black text-slate-900">
                  {loadingStats ? '…' : inspectionsCount}
                </div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase mt-0.5">
                  Inspeksi
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200/90 text-center shadow-2xs">
                <AlertTriangle size={16} className="mx-auto text-amber-600 mb-1" />
                <div className="text-lg font-black text-slate-900">
                  {loadingStats ? '…' : findingsCount}
                </div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase mt-0.5">
                  Temuan K3
                </div>
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200/90 text-center shadow-2xs">
                <ImageIcon size={16} className="mx-auto text-purple-600 mb-1" />
                <div className="text-lg font-black text-slate-900">
                  {loadingStats ? '…' : photosCount}
                </div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase mt-0.5">
                  Foto &amp; TTD
                </div>
              </div>
            </div>

            {/* Tombol Buka Modal Hapus Data */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(true);
                  setConfirmInput('');
                }}
                disabled={inspectionsCount === 0 && findingsCount === 0}
                className="w-full py-3 px-4 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-[0.99] shadow-sm shadow-red-500/20 transition-all flex items-center justify-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                <Trash2 size={16} /> Hapus Data Input Pemeriksaan &amp; Gambar…
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL KONFIRMASI HAPUS DATA INPUT (ADMIN ONLY) */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl max-w-lg w-full p-5 sm:p-6 space-y-4 shadow-xl border border-red-200 animate-in zoom-in-95 duration-150">
            {/* Header Modal */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-red-100 text-red-600">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase">
                    Konfirmasi Hapus Data Input K3
                  </h3>
                  <p className="text-xs text-red-600 font-bold">
                    Tindakan ini permanen dan tidak dapat dibatalkan!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            {/* Pilihan Cakupan Hapus */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-800 uppercase">
                Pilih Cakupan Data yang Dihapus:
              </label>

              <div className="space-y-2">
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                  <input
                    type="radio"
                    name="deleteScope"
                    value="all"
                    checked={deleteScope === 'all'}
                    onChange={() => setDeleteScope('all')}
                    disabled={deleting}
                    className="mt-0.5 text-red-600 focus:ring-red-500"
                  />
                  <div>
                    <strong className="text-xs text-slate-900 block">
                      Hapus Semua Data Input (Reset Bersih Total)
                    </strong>
                    <span className="text-[11px] text-slate-500">
                      Menghapus seluruh {inspectionsCount} hasil inspeksi dan {findingsCount} temuan K3
                      beserta seluruh file foto &amp; gambar dari awal hingga sekarang.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
                  <input
                    type="radio"
                    name="deleteScope"
                    value="month"
                    checked={deleteScope === 'month'}
                    onChange={() => setDeleteScope('month')}
                    disabled={deleting}
                    className="mt-0.5 text-red-600 focus:ring-red-500"
                  />
                  <div className="flex-1">
                    <strong className="text-xs text-slate-900 block">
                      Hapus Hanya Pada Periode Bulan Tertentu
                    </strong>
                    <span className="text-[11px] text-slate-500 block mb-2">
                      Hanya menghapus riwayat pemeriksaan dan temuan pada bulan yang dipilih.
                    </span>

                    {deleteScope === 'month' && (
                      <input
                        type="month"
                        value={deleteMonth}
                        onChange={(e) => setDeleteMonth(e.target.value)}
                        disabled={deleting}
                        className="input text-xs font-semibold py-1.5 px-3 max-w-[200px]"
                      />
                    )}
                  </div>
                </label>
              </div>
            </div>

            {/* Peringatan Bahaya */}
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-900 space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <AlertTriangle size={14} className="text-red-600 shrink-0" />
                Peringatan Penghapusan Data:
              </div>
              <p className="text-[11px] leading-relaxed">
                Seluruh data hasil inspeksi, catatan temuan, foto kondisi box hydrant, foto temuan item,
                dan tanda tangan digital yang termasuk dalam kriteria di atas akan
                <strong> dihapus secara permanen</strong> dari server database.
              </p>
            </div>

            {/* Input Konfirmasi Text */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-bold text-slate-700">
                Ketik kata <span className="text-red-600 font-black tracking-wider">HAPUS</span> untuk
                mengonfirmasi:
              </label>
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder="Ketik HAPUS di sini"
                disabled={deleting}
                className="input text-xs font-bold tracking-wider uppercase border-red-300 focus:border-red-500 focus:ring-red-500/20"
              />
            </div>

            {/* Tombol Aksi Modal */}
            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="btn-secondary text-xs min-h-[40px] px-4 font-bold"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleExecuteDelete}
                disabled={confirmInput.trim().toUpperCase() !== 'HAPUS' || deleting}
                className="btn-danger text-xs min-h-[40px] px-4 font-bold flex items-center gap-2 disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                {deleting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Menghapus Data…
                  </>
                ) : (
                  <>
                    <Trash2 size={16} /> Konfirmasi Hapus Permanen
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

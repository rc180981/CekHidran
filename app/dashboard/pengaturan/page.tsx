'use client';

import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Card } from '@/components/ui';
import { Save } from 'lucide-react';

export default function PengaturanPage() {
  const [frequency, setFrequency] = useState<'harian' | 'bulanan'>('harian');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'app_settings', 'inspection_frequency'));
        if (snap.exists()) {
          setFrequency(snap.data().value || 'harian');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);
    try {
      await setDoc(doc(db, 'app_settings', 'inspection_frequency'), {
        key: 'inspection_frequency',
        value: frequency,
        updated_at: new Date().toISOString(),
      }, { merge: true });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (e) {
      console.error(e);
      alert('Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
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
      <div className="pb-2 border-b border-slate-200/80">
        <h1 className="text-2xl font-black tracking-wider text-slate-900 uppercase">PENGATURAN SISTEM CEK HIDRAN</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1 uppercase font-semibold">
          KONFIGURASI FREKUENSI PEMERIKSAAN DAN PARAMETER OPERASIONAL K3
        </p>
      </div>

      <Card title="FREKUENSI PEMERIKSAAN HYDRANT" className="max-w-xl">
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
                  Target pemeriksaan diulang setiap hari berjalan. Titik yang belum diperiksa hari ini ditandai Belum Dicek.
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
    </div>
  );
}

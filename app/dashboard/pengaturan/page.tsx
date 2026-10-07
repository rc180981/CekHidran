import { requirePermission } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card } from '@/components/ui';
import { revalidatePath } from 'next/cache';
import { Settings as SettingsIcon, Save } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PengaturanPage() {
  await requirePermission('kelola_pengaturan');
  const supabase = await createClient();

  const { data: settings } = await supabase.from('app_settings').select('*');
  const currentFreq =
    settings?.find((s) => s.key === 'inspection_frequency')?.value || 'harian';

  async function updateSettingsAction(formData: FormData) {
    'use server';
    const frequency = formData.get('frequency') as string;

    const sb = await createClient();
    await sb
      .from('app_settings')
      .upsert({ key: 'inspection_frequency', value: frequency, updated_at: new Date().toISOString() });

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/pengaturan');
    revalidatePath('/petugas');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Pengaturan Sistem Cek Hidran</h1>
        <p className="text-sm text-slate-600 mt-1">
          Konfigurasi frekuensi pemeriksaan dan parameter operasional K3
        </p>
      </div>

      <Card title="Frekuensi Pemeriksaan Hydrant" className="max-w-xl">
        <form action={updateSettingsAction} className="space-y-5">
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
                defaultChecked={currentFreq === 'harian'}
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
                defaultChecked={currentFreq === 'bulanan'}
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

          <div className="flex justify-end pt-2">
            <button type="submit" className="btn-primary text-xs min-h-[44px]">
              <Save size={16} /> Simpan Pengaturan
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

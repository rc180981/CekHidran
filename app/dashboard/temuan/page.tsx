import { requirePermission } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, StatusBadge } from '@/components/ui';
import { formatDate } from '@/lib/period';
import { revalidatePath } from 'next/cache';
import { CheckCircle2, Wrench } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function TemuanPage() {
  const user = await requirePermission('lihat_dashboard');
  const supabase = await createClient();

  const { data: findings } = await supabase
    .from('findings')
    .select(`
      id,
      description,
      status,
      resolution_notes,
      created_at,
      closed_at,
      profiles:closed_by(name),
      inspections(
        id,
        inspected_at,
        notes,
        hydrants(number, location_name, warehouses(name))
      )
    `)
    .order('created_at', { ascending: false });

  const findingList = findings ?? [];

  async function updateFindingAction(formData: FormData) {
    'use server';
    const findingId = formData.get('findingId') as string;
    const newStatus = formData.get('status') as string;
    const notes = formData.get('notes') as string;

    const sb = await createClient();
    await sb
      .from('findings')
      .update({
        status: newStatus as any,
        resolution_notes: notes,
      })
      .eq('id', findingId);

    revalidatePath('/dashboard/temuan');
    revalidatePath('/dashboard');
  }

  const canVerify = user.role === 'admin_sistem' || user.role === 'supervisor_k3';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Temuan Kondisi & Perbaikan K3</h1>
        <p className="text-sm text-slate-600 mt-1">
          Daftar temuan otomatis saat equipment dinyatakan "Tidak baik" pada checklist
        </p>
      </div>

      <div className="space-y-4">
        {findingList.map((f: any) => {
          const hydrant = f.inspections?.hydrants;
          const whName = hydrant?.warehouses?.name;

          return (
            <Card key={f.id} className="p-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base text-slate-900">
                      {hydrant?.number ?? '-'} (Gudang {whName ?? '-'})
                    </span>
                    <span className="text-xs text-slate-500">· {hydrant?.location_name}</span>
                    <StatusBadge status={f.status} />
                  </div>

                  <p className="text-sm text-slate-800 font-medium">{f.description}</p>

                  <div className="text-xs text-slate-500 flex items-center gap-4 flex-wrap pt-1">
                    <span>
                      Dilaporkan:{' '}
                      <strong>{formatDate(f.created_at, 'long')}</strong>
                    </span>
                    {f.closed_at && (
                      <span className="text-emerald-700">
                        Ditutup oleh: <strong>{f.profiles?.name ?? 'Petugas K3'}</strong> pada{' '}
                        {formatDate(f.closed_at)}
                      </span>
                    )}
                  </div>

                  {f.resolution_notes && (
                    <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-200 mt-2">
                      <strong className="text-slate-800">Catatan Penanganan:</strong> {f.resolution_notes}
                    </div>
                  )}
                </div>

                {/* Form Verifikasi & Tutup Temuan (Admin & Supervisor K3) */}
                {canVerify && (
                  <form action={updateFindingAction} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                    <input type="hidden" name="findingId" value={f.id} />
                    <select
                      name="status"
                      defaultValue={f.status}
                      className="input text-xs min-h-[38px] w-auto"
                    >
                      <option value="terbuka">Terbuka</option>
                      <option value="dalam_perbaikan">Dalam Perbaikan</option>
                      <option value="selesai">Selesai (Ditutup)</option>
                    </select>

                    <input
                      name="notes"
                      type="text"
                      placeholder="Catatan perbaikan..."
                      defaultValue={f.resolution_notes || ''}
                      className="input text-xs min-h-[38px] sm:w-44"
                    />

                    <button type="submit" className="btn-secondary min-h-[38px] text-xs">
                      Update Status
                    </button>
                  </form>
                )}
              </div>
            </Card>
          );
        })}

        {findingList.length === 0 && (
          <Card>
            <p className="text-sm text-slate-500 text-center py-8">
              Tidak ada temuan kondisi tidak baik saat ini.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}

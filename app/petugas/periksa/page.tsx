import { requirePermission } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getFrequency } from '@/lib/settings';
import InspectionWizard from '@/components/petugas/InspectionWizard';
import type { PetugasBundle, CachedHydrant } from '@/lib/types';
import { createHash } from 'node:crypto';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function PeriksaPage({
  searchParams,
}: {
  searchParams: Promise<{ qr?: string }>;
}) {
  const user = await requirePermission('isi_checklist');
  const { qr } = await searchParams;
  const supabase = await createClient();

  const [{ data: hydrants }, { data: items }, frequency] = await Promise.all([
    supabase
      .from('hydrants')
      .select('id, number, type, location_name, location_type, qr_code, warehouse_id, warehouses(name)')
      .eq('active', true)
      .in('warehouse_id', user.warehouseIds.length ? user.warehouseIds : ['00000000-0000-0000-0000-000000000000'])
      .order('number'),
    supabase.from('checklist_items').select('id, name, description, sort_order').eq('active', true).order('sort_order'),
    getFrequency(supabase),
  ]);

  const bundle: PetugasBundle = {
    user: { id: user.id, name: user.name, role: user.role, warehouseIds: user.warehouseIds },
    hydrants: (hydrants ?? []).map(
      (h: any): CachedHydrant => ({
        id: h.id,
        number: h.number,
        type: h.type,
        location_name: h.location_name,
        location_type: h.location_type,
        warehouse_id: h.warehouse_id,
        warehouse_name: h.warehouses?.name ?? '',
        qr_hash: createHash('sha256').update(h.qr_code).digest('hex'),
      })
    ),
    items: items ?? [],
    frequency,
    fetchedAt: new Date().toISOString(),
  };

  return (
    <div className="min-h-screen bg-canvas p-4 sm:p-6 pb-20">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center gap-2">
          <Link
            href="/petugas"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition inline-flex items-center"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-base font-bold text-slate-800">Pemeriksaan Hydrant</h1>
        </div>

        <InspectionWizard initialBundle={bundle} initialQr={qr} />
      </div>
    </div>
  );
}

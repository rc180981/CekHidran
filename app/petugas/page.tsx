import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getFrequency } from '@/lib/settings';
import PetugasClientDashboard from './PetugasClientDashboard';
import type { PetugasBundle, CachedHydrant } from '@/lib/types';
import { createHash } from 'node:crypto';

export const dynamic = 'force-dynamic';

export default async function PetugasPage() {
  const user = await requirePermission('isi_checklist');
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
      <div className="max-w-md mx-auto">
        <PetugasClientDashboard initialBundle={bundle} />
      </div>
    </div>
  );
}

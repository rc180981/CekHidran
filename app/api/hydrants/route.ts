import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { assertPermission, errorResponse } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getFrequency } from '@/lib/settings';
import type { CachedHydrant, PetugasBundle } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Data untuk cache offline petugas: hanya hydrant gudang yang ditugaskan (RLS + filter server). */
export async function GET() {
  try {
    const user = await assertPermission('isi_checklist');
    const supabase = await createClient();

    const [{ data: hydrants, error }, { data: items }, frequency] = await Promise.all([
      supabase
        .from('hydrants')
        .select('id, number, type, location_name, location_type, qr_code, warehouse_id, warehouses(name)')
        .eq('active', true)
        .in('warehouse_id', user.warehouseIds.length ? user.warehouseIds : ['00000000-0000-0000-0000-000000000000'])
        .order('number'),
      supabase.from('checklist_items').select('id, name, description, sort_order').eq('active', true).order('sort_order'),
      getFrequency(supabase),
    ]);
    if (error) throw error;

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
          // QR mentah tidak dikirim ke perangkat: petugas tetap harus scan box fisik
          qr_hash: createHash('sha256').update(h.qr_code).digest('hex'),
        }),
      ),
      items: items ?? [],
      frequency,
      fetchedAt: new Date().toISOString(),
    };
    return NextResponse.json(bundle, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return errorResponse(e);
  }
}

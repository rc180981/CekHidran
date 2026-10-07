import { requirePermission } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Card, LocationTag } from '@/components/ui';
import { revalidatePath } from 'next/cache';
import { Plus, Flame, Printer } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function KelolaHydrantPage() {
  await requirePermission('kelola_hydrant');
  const supabase = await createClient();

  const [{ data: warehouses }, { data: hydrants }, { data: items }] = await Promise.all([
    supabase.from('warehouses').select('id, name').order('name'),
    supabase
      .from('hydrants')
      .select('id, number, type, location_name, location_type, active, warehouse_id, qr_code, warehouses(name)')
      .order('warehouse_id')
      .order('number'),
    supabase.from('checklist_items').select('id, name, description, sort_order, active').order('sort_order'),
  ]);

  const whList = warehouses ?? [];
  const hydrantList = hydrants ?? [];
  const itemList = items ?? [];

  async function addHydrantAction(formData: FormData) {
    'use server';
    const warehouse_id = formData.get('warehouse_id') as string;
    const number = formData.get('number') as string;
    const type = (formData.get('type') as string) || 'Box Hydrant';
    const location_name = formData.get('location_name') as string;
    const location_type = formData.get('location_type') as string;

    const sb = await createClient();
    await sb.from('hydrants').insert({
      warehouse_id,
      number,
      type,
      location_name,
      location_type: location_type as any,
    });
    revalidatePath('/dashboard/hydrant');
  }

  async function toggleHydrantAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const currentActive = formData.get('active') === 'true';

    const sb = await createClient();
    await sb.from('hydrants').update({ active: !currentActive }).eq('id', id);
    revalidatePath('/dashboard/hydrant');
  }

  async function addChecklistItemAction(formData: FormData) {
    'use server';
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const sort_order = parseInt(formData.get('sort_order') as string, 10) || 0;

    const sb = await createClient();
    await sb.from('checklist_items').insert({
      name,
      description,
      sort_order,
    });
    revalidatePath('/dashboard/hydrant');
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
        <div>
          <Link
            href="/api/qr/cetak-pdf"
            target="_blank"
            className="btn-primary min-h-[44px] text-xs inline-flex items-center gap-2"
          >
            <Printer size={16} /> Cetak Semua QR Code (PDF)
          </Link>
        </div>
      </div>

      {/* Bagian Master Item Checklist */}
      <Card title="Daftar Master Item Equipment Checklist">
        <div className="space-y-4">
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
                {itemList.map((it) => (
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

          {/* Form Tambah Item Checklist */}
          <div className="border-t border-slate-200/80 pt-4">
            <h3 className="text-xs font-bold uppercase text-slate-600 tracking-wider mb-2">Tambah Item Pemeriksaan Baru</h3>
            <form action={addChecklistItemAction} className="flex flex-wrap items-center gap-3">
              <input name="name" placeholder="Nama item (cth: Tekanan Bar)..." required className="input text-xs w-48" />
              <input name="description" placeholder="Deskripsi/petunjuk..." className="input text-xs flex-1 min-w-[200px]" />
              <input name="sort_order" type="number" defaultValue={itemList.length + 1} placeholder="Urutan" className="input text-xs w-20" />
              <button type="submit" className="btn-secondary text-xs min-h-[44px]">
                <Plus size={16} /> Tambah Item
              </button>
            </form>
          </div>
        </div>
      </Card>

      {/* Bagian Master Titik Hydrant */}
      <Card title={`Daftar Titik Hydrant (${hydrantList.length} Titik)`}>
        <div className="space-y-4">
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
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {hydrantList.map((h: any) => (
                  <tr key={h.id} className="hover:bg-slate-50/70">
                    <td className="font-bold text-slate-900">{h.number}</td>
                    <td className="font-medium text-slate-800">Gudang {h.warehouses?.name}</td>
                    <td className="text-xs text-slate-600">{h.type}</td>
                    <td className="text-xs text-slate-800">{h.location_name}</td>
                    <td>
                      <LocationTag type={h.location_type} />
                    </td>
                    <td className="font-mono text-[11px] text-slate-500">{h.qr_code.slice(0, 8)}…</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/api/qr/cetak-pdf?hydrantId=${h.id}`}
                          target="_blank"
                          className="text-xs font-semibold text-primary hover:underline"
                        >
                          Cetak QR
                        </Link>
                        <span>·</span>
                        <form action={toggleHydrantAction}>
                          <input type="hidden" name="id" value={h.id} />
                          <input type="hidden" name="active" value={String(h.active)} />
                          <button type="submit" className={`text-xs font-medium hover:underline ${h.active ? 'text-red-600' : 'text-emerald-600'}`}>
                            {h.active ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Form Tambah Titik Hydrant */}
          <div className="border-t border-slate-200/80 pt-4">
            <h3 className="text-xs font-bold uppercase text-slate-600 tracking-wider mb-2">Tambah Titik Hydrant Baru</h3>
            <form action={addHydrantAction} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3">
              <div>
                <select name="warehouse_id" required className="input text-xs">
                  {whList.map((w) => (
                    <option key={w.id} value={w.id}>
                      Gudang {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <input name="number" placeholder="No (cth: H-19)" required className="input text-xs" />
              </div>
              <div>
                <input name="type" defaultValue="Box Hydrant" placeholder="Jenis" className="input text-xs" />
              </div>
              <div className="md:col-span-2">
                <input name="location_name" placeholder="Lokasi penempatan detail..." required className="input text-xs" />
              </div>
              <div>
                <select name="location_type" className="input text-xs">
                  <option value="indoor">Dalam Gudang</option>
                  <option value="outdoor">Luar Gudang</option>
                </select>
              </div>
              <div className="md:col-span-6 flex justify-end">
                <button type="submit" className="btn-primary text-xs min-h-[44px]">
                  <Plus size={16} /> Tambah Titik Hydrant
                </button>
              </div>
            </form>
          </div>
        </div>
      </Card>
    </div>
  );
}

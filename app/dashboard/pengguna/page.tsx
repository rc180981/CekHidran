import { requirePermission } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Card } from '@/components/ui';
import { ROLE_LABEL, ROLES, type Role } from '@/lib/rbac';
import { revalidatePath } from 'next/cache';
import { UserPlus, Shield, Building2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function KelolaPenggunaPage() {
  await requirePermission('kelola_pengguna');
  const supabase = await createClient();

  const [{ data: profiles }, { data: warehouses }, { data: userWh }] = await Promise.all([
    supabase.from('profiles').select('id, name, role, active, created_at').order('created_at'),
    supabase.from('warehouses').select('id, name').order('name'),
    supabase.from('user_warehouses').select('user_id, warehouse_id, warehouses(name)'),
  ]);

  const profileList = profiles ?? [];
  const whList = warehouses ?? [];
  const assignments = userWh ?? [];

  // Peta penugasan gudang per pengguna
  const userWarehousesMap: Record<string, string[]> = {};
  assignments.forEach((a: any) => {
    if (!userWarehousesMap[a.user_id]) userWarehousesMap[a.user_id] = [];
    if (a.warehouses?.name) userWarehousesMap[a.user_id].push(a.warehouses.name);
  });

  async function createUserAction(formData: FormData) {
    'use server';
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string;
    const role = formData.get('role') as Role;
    const assignedWh = formData.getAll('warehouses') as string[];

    const admin = createAdminClient();
    const { data: newUser, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
      app_metadata: { role },
    });

    if (error) {
      throw new Error(`Gagal membuat akun: ${error.message}`);
    }

    if (newUser?.user) {
      await admin.from('profiles').upsert({
        id: newUser.user.id,
        name,
        role,
        active: true,
      });

      if (assignedWh.length > 0) {
        const rows = assignedWh.map((warehouse_id) => ({
          user_id: newUser.user.id,
          warehouse_id,
        }));
        await admin.from('user_warehouses').insert(rows);
      }
    }

    revalidatePath('/dashboard/pengguna');
  }

  async function toggleUserAction(formData: FormData) {
    'use server';
    const id = formData.get('id') as string;
    const active = formData.get('active') === 'true';

    const sb = await createClient();
    await sb.from('profiles').update({ active: !active }).eq('id', id);
    revalidatePath('/dashboard/pengguna');
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Kelola Pengguna & Peran (RBAC)</h1>
        <p className="text-sm text-slate-600 mt-1">
          Manajemen hak akses, peran pengguna, dan penugasan area gudang
        </p>
      </div>

      {/* Tabel Pengguna */}
      <Card title={`Daftar Pengguna Aktif (${profileList.length} Akun)`}>
        <div className="overflow-x-auto -mx-5 -my-2">
          <table className="table-base">
            <thead>
              <tr>
                <th>Nama Pengguna</th>
                <th>Peran Sistem</th>
                <th>Gudang Ditugaskan</th>
                <th>Status Akun</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {profileList.map((p) => {
                const whs = userWarehousesMap[p.id] || [];
                return (
                  <tr key={p.id}>
                    <td className="font-semibold text-slate-900">{p.name}</td>
                    <td>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                        {ROLE_LABEL[p.role as Role] || p.role}
                      </span>
                    </td>
                    <td className="text-xs text-slate-700">
                      {p.role === 'petugas' ? (
                        whs.length > 0 ? (
                          whs.join(', ')
                        ) : (
                          <span className="text-amber-600 italic">Belum ada gudang</span>
                        )
                      ) : (
                        <span className="text-slate-400">Semua Gudang</span>
                      )}
                    </td>
                    <td>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${p.active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                        {p.active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td>
                      <form action={toggleUserAction}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="active" value={String(p.active)} />
                        <button type="submit" className={`text-xs font-semibold hover:underline ${p.active ? 'text-red-600' : 'text-emerald-600'}`}>
                          {p.active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Form Tambah Pengguna Baru */}
      <Card title="Tambah Pengguna Baru">
        <form action={createUserAction} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="label text-xs">Nama Lengkap</label>
              <input name="name" required placeholder="Cth: Rudi Hartono" className="input text-xs" />
            </div>
            <div>
              <label className="label text-xs">Email Pengguna</label>
              <input name="email" type="email" required placeholder="nama@cekhidran.id" className="input text-xs" />
            </div>
            <div>
              <label className="label text-xs">Kata Sandi Awal</label>
              <input name="password" type="password" required placeholder="Minimal 8 karakter" className="input text-xs" />
            </div>
            <div>
              <label className="label text-xs">Peran Sistem</label>
              <select name="role" required className="input text-xs">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="label text-xs">Penugasan Gudang (Khusus Peran Petugas)</label>
            <div className="flex items-center gap-4 pt-1">
              {whList.map((w) => (
                <label key={w.id} className="inline-flex items-center gap-1.5 text-xs text-slate-800">
                  <input type="checkbox" name="warehouses" value={w.id} className="rounded text-primary focus:ring-primary" />
                  <span>Gudang {w.name}</span>
                </label>
              ))}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Petugas hanya dapat memeriksa box hydrant yang berada di gudang yang dicentang.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="btn-primary min-h-[44px] text-xs">
              <UserPlus size={16} /> Buat Akun Pengguna
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

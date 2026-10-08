'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Card } from '@/components/ui';
import { ROLE_LABEL, Role } from '@/lib/rbac';
import { Plus, Edit2, Trash2, X, UserCheck, Shield, Building2 } from 'lucide-react';

export default function KelolaPenggunaPage() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // Modal State
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    role: 'petugas' as Role,
    warehouseIds: ['wh2'],
    active: true,
  });

  const fetchData = async () => {
    try {
      const [pSnap, wSnap] = await Promise.all([
        getDocs(collection(db, 'profiles')),
        getDocs(collection(db, 'warehouses')),
      ]);

      const pList: any[] = [];
      pSnap.forEach((d) => pList.push({ id: d.id, ...d.data() }));
      pList.sort((a, b) => a.name.localeCompare(b.name));
      setProfiles(pList);

      const wList: any[] = [];
      wSnap.forEach((d) => wList.push(d.data()));
      wList.sort((a, b) => a.name.localeCompare(b.name));
      setWarehouses(wList);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'profiles', id), { active: !current });
      fetchData();
    } catch (e) {
      console.error(e);
      alert('Gagal mengubah status');
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUser) {
        // Update user
        await updateDoc(doc(db, 'profiles', editingUser.id), {
          name: userForm.name,
          email: userForm.email,
          role: userForm.role,
          warehouseIds: userForm.role === 'petugas' ? userForm.warehouseIds : ['wh2', 'wh3', 'wh4'],
          active: userForm.active,
          updated_at: new Date().toISOString(),
        });
      } else {
        // Create new user profile document
        const newUid = `user_${Date.now()}`;
        await setDoc(doc(db, 'profiles', newUid), {
          id: newUid,
          name: userForm.name,
          email: userForm.email,
          role: userForm.role,
          warehouseIds: userForm.role === 'petugas' ? userForm.warehouseIds : ['wh2', 'wh3', 'wh4'],
          active: true,
          created_at: new Date().toISOString(),
        });
      }

      setUserModalOpen(false);
      setEditingUser(null);
      fetchData();
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan data pengguna.');
    }
  };

  const handleDeleteUser = async (p: any) => {
    if (confirm(`Yakin ingin menghapus pengguna "${p.name}" (${p.email})?`)) {
      try {
        await deleteDoc(doc(db, 'profiles', p.id));
        fetchData();
      } catch (err) {
        console.error(err);
        alert('Gagal menghapus pengguna.');
      }
    }
  };

  const handleWarehouseCheckbox = (whId: string) => {
    setUserForm((prev) => {
      const exists = prev.warehouseIds.includes(whId);
      if (exists) {
        return { ...prev, warehouseIds: prev.warehouseIds.filter((id) => id !== whId) };
      } else {
        return { ...prev, warehouseIds: [...prev.warehouseIds, whId] };
      }
    });
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <div className="h-9 w-9 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-600">Memuat daftar pengguna…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Kelola Pengguna & Peran (RBAC)</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manajemen akun, hak akses sistem, dan penugasan lokasi gudang operasional
          </p>
        </div>
      </div>

      <Card
        title={
          <div className="flex flex-wrap items-center justify-between w-full gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setEditingUser(null);
                  setUserForm({
                    name: '',
                    email: '',
                    role: 'petugas',
                    warehouseIds: ['wh2'],
                    active: true,
                  });
                  setUserModalOpen(true);
                }}
                className="btn-primary text-xs px-3.5 py-1.5 h-8 flex items-center gap-1.5 shadow-sm"
              >
                <Plus size={15} /> Tambah Pengguna Baru
              </button>
              <span className="font-bold text-slate-900 text-base">
                Daftar Pengguna Sistem ({profiles.length} Akun)
              </span>
            </div>
          </div>
        }
      >
        <div className="overflow-x-auto -mx-5 -my-2">
          <table className="table-base">
            <thead>
              <tr>
                <th>Nama Pengguna</th>
                <th>Email</th>
                <th>Peran Sistem</th>
                <th>Gudang Ditugaskan</th>
                <th>Status Akun</th>
                <th className="text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const whs = p.warehouseIds || [];
                return (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="font-bold text-slate-900 text-sm">{p.name}</td>
                    <td className="text-xs text-slate-600 font-mono">{p.email}</td>
                    <td>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                        {ROLE_LABEL[p.role as Role] || p.role}
                      </span>
                    </td>
                    <td className="text-xs text-slate-700">
                      {p.role === 'petugas' ? (
                        whs.length > 0 ? (
                          <span className="font-semibold text-primary">{whs.join(', ').toUpperCase()}</span>
                        ) : (
                          <span className="text-amber-600 italic">Belum ada gudang</span>
                        )
                      ) : (
                        <span className="text-slate-400">Semua Gudang (WH2, WH3, WH4)</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                          p.active ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {p.active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingUser(p);
                            setUserForm({
                              name: p.name,
                              email: p.email,
                              role: p.role,
                              warehouseIds: p.warehouseIds || ['wh2'],
                              active: !!p.active,
                            });
                            setUserModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 transition"
                          title="Edit Pengguna"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(p.id, !!p.active)}
                          className={`text-xs font-semibold px-2 py-1 rounded transition ${
                            p.active ? 'text-amber-700 hover:bg-amber-50' : 'text-emerald-700 hover:bg-emerald-50'
                          }`}
                        >
                          {p.active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUser(p)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-red-50 transition"
                          title="Hapus Pengguna"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {profiles.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-slate-500 text-sm">
                    Belum ada data pengguna.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ================= MODAL TAMBAH / EDIT PENGGUNA ================= */}
      {userModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <strong className="text-slate-900 text-sm font-bold">
                {editingUser ? 'Edit Data Pengguna' : 'Tambah Pengguna Baru'}
              </strong>
              <button
                type="button"
                onClick={() => setUserModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveUser} className="p-5 space-y-4">
              <div>
                <label className="label text-xs font-bold text-slate-700 mb-1 block">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Budi Santoso"
                  value={userForm.name}
                  onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="label text-xs font-bold text-slate-700 mb-1 block">Alamat Email</label>
                <input
                  type="email"
                  required
                  placeholder="Contoh: budi@cekhidran.id"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="input text-xs"
                />
              </div>

              <div>
                <label className="label text-xs font-bold text-slate-700 mb-1 block">Peran Sistem (Role)</label>
                <select
                  value={userForm.role}
                  onChange={(e) => setUserForm({ ...userForm, role: e.target.value as Role })}
                  className="input text-xs font-medium"
                >
                  <option value="petugas">Petugas Lapangan (Pemeriksa Hydrant)</option>
                  <option value="supervisor_k3">Supervisor K3 (Monitoring & Verifikasi)</option>
                  <option value="admin_sistem">Admin Sistem (Akses Penuh)</option>
                  <option value="manajemen">Manajemen (Eksekutif Read-Only)</option>
                </select>
              </div>

              {/* Pilihan Gudang Khusus Petugas */}
              {userForm.role === 'petugas' && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <label className="label text-xs font-bold text-slate-700 block">
                    Penugasan Area Gudang
                  </label>
                  <div className="flex items-center gap-4 flex-wrap">
                    {warehouses.map((wh) => (
                      <label key={wh.id} className="inline-flex items-center gap-1.5 text-xs text-slate-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={userForm.warehouseIds.includes(wh.id)}
                          onChange={() => handleWarehouseCheckbox(wh.id)}
                          className="rounded text-primary focus:ring-primary"
                        />
                        <span>Gudang {wh.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="btn-secondary text-xs px-3.5 py-2"
                >
                  Batal
                </button>
                <button type="submit" className="btn-primary text-xs px-4 py-2">
                  Simpan Pengguna
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Card } from '@/components/ui';
import { ROLE_LABEL, Role } from '@/lib/rbac';

export default function KelolaPenggunaPage() {
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState<any[]>([]);

  const fetchProfiles = async () => {
    try {
      const snap = await getDocs(collection(db, 'profiles'));
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setProfiles(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const handleToggleActive = async (id: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'profiles', id), { active: !current });
      fetchProfiles();
    } catch (e) {
      console.error(e);
      alert('Gagal mengubah status');
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-slate-600">Memuat daftar pengguna…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Kelola Pengguna & Peran (RBAC)</h1>
        <p className="text-sm text-slate-600 mt-1">
          Manajemen hak akses, peran pengguna, dan penugasan area gudang
        </p>
      </div>

      <Card title={`Daftar Pengguna (${profiles.length} Akun)`}>
        <div className="overflow-x-auto -mx-5 -my-2">
          <table className="table-base">
            <thead>
              <tr>
                <th>Nama Pengguna</th>
                <th>Email</th>
                <th>Peran Sistem</th>
                <th>Gudang Ditugaskan</th>
                <th>Status Akun</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const whs = p.warehouseIds || [];
                return (
                  <tr key={p.id}>
                    <td className="font-semibold text-slate-900">{p.name}</td>
                    <td className="text-xs text-slate-600">{p.email}</td>
                    <td>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
                        {ROLE_LABEL[p.role as Role] || p.role}
                      </span>
                    </td>
                    <td className="text-xs text-slate-700">
                      {p.role === 'petugas' ? (
                        whs.length > 0 ? (
                          whs.join(', ').toUpperCase()
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
                      <button
                        type="button"
                        onClick={() => handleToggleActive(p.id, !!p.active)}
                        className={`text-xs font-semibold hover:underline ${p.active ? 'text-red-600' : 'text-emerald-600'}`}
                      >
                        {p.active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

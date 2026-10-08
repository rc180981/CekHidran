'use client';

import { useAuth } from '@/lib/firebase/auth-context';
import { useEffect, useState } from 'react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { Card, StatusBadge } from '@/components/ui';
import { formatDate } from '@/lib/period';

export default function TemuanPage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [findings, setFindings] = useState<any[]>([]);

  const fetchFindings = async () => {
    try {
      const snap = await getDocs(collection(db, 'findings'));
      const list: any[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
      setFindings(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFindings();
  }, []);

  const handleUpdate = async (id: string, newStatus: string, notes: string) => {
    try {
      await updateDoc(doc(db, 'findings', id), {
        status: newStatus,
        resolution_notes: notes,
        closed_at: newStatus === 'selesai' ? new Date().toISOString() : null,
        closed_by_name: newStatus === 'selesai' ? profile?.name : null,
      });
      fetchFindings();
    } catch (e) {
      console.error(e);
      alert('Gagal memperbarui status temuan.');
    }
  };

  const canVerify = profile?.role === 'admin_sistem' || profile?.role === 'supervisor_k3';

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-slate-600">Memuat temuan K3…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Temuan Kondisi & Perbaikan K3</h1>
        <p className="text-sm text-slate-600 mt-1">
          Daftar temuan otomatis saat equipment dinyatakan "Tidak baik" pada checklist
        </p>
      </div>

      <div className="space-y-4">
        {findings.map((f: any) => (
          <Card key={f.id} className="p-5">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-base text-slate-900">
                    {f.hydrant_number || '-'} (Gudang {f.warehouse_name || '-'})
                  </span>
                  <span className="text-xs text-slate-500">· {f.location_name}</span>
                  <StatusBadge status={f.status} />
                </div>

                <p className="text-sm text-slate-800 font-medium">{f.description}</p>

                <div className="text-xs text-slate-500 flex items-center gap-4 flex-wrap pt-1">
                  <span>
                    Dilaporkan: <strong>{formatDate(f.created_at || new Date(), 'long')}</strong>
                  </span>
                  {f.closed_at && (
                    <span className="text-emerald-700">
                      Ditutup oleh: <strong>{f.closed_by_name || 'Petugas K3'}</strong> pada{' '}
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

              {canVerify && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                  <select
                    defaultValue={f.status}
                    id={`status-${f.id}`}
                    className="input text-xs min-h-[38px] w-auto"
                  >
                    <option value="terbuka">Terbuka</option>
                    <option value="dalam_perbaikan">Dalam Perbaikan</option>
                    <option value="selesai">Selesai (Ditutup)</option>
                  </select>

                  <input
                    id={`notes-${f.id}`}
                    type="text"
                    placeholder="Catatan perbaikan..."
                    defaultValue={f.resolution_notes || ''}
                    className="input text-xs min-h-[38px] sm:w-44"
                  />

                  <button
                    type="button"
                    onClick={() => {
                      const sel = (document.getElementById(`status-${f.id}`) as HTMLSelectElement).value;
                      const not = (document.getElementById(`notes-${f.id}`) as HTMLInputElement).value;
                      handleUpdate(f.id, sel, not);
                    }}
                    className="btn-secondary min-h-[38px] text-xs"
                  >
                    Update Status
                  </button>
                </div>
              )}
            </div>
          </Card>
        ))}

        {findings.length === 0 && (
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

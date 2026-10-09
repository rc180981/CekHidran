'use client';

import { useAuth } from '@/lib/firebase/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import PetugasClientDashboard from './PetugasClientDashboard';
import type { PetugasBundle, CachedHydrant, ChecklistItem } from '@/lib/types';
import { sha256Hex } from '@/lib/qr';
import { getBundle, setBundle as saveBundleCache } from '@/lib/offline/db';

export default function PetugasPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [bundle, setBundle] = useState<PetugasBundle | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!user || !profile) {
        router.push('/login');
        return;
      }

      // Ambil data dari Firestore atau cache
      const fetchData = async () => {
        try {
          const cached = await getBundle();
          if (cached && cached.hydrants && cached.hydrants.length > 0) {
            setBundle(cached);
            setLoadingData(false);
          }

          const userWh = (profile.warehouseIds || []).map((w: string) => w.toLowerCase());

          // Ambil daftar master warehouses untuk pemetaan nama
          const wSnap = await getDocs(collection(db, 'warehouses'));
          const warehouseMap = new Map<string, string>();
          wSnap.forEach((doc) => {
            const d = doc.data();
            warehouseMap.set(doc.id.toLowerCase(), d.name || doc.id.toUpperCase());
          });
          
          // Ambil hydrants
          const hSnap = await getDocs(collection(db, 'hydrants'));
          const hydrantsList: CachedHydrant[] = [];
          
          for (const doc of hSnap.docs) {
            const data = doc.data();
            const docWh = (data.warehouse_id || '').toLowerCase();
            if (userWh.length === 0 || userWh.includes(docWh)) {
              const qrVal = data.qr_code || '';
              const hash = qrVal ? await sha256Hex(qrVal) : '';
              const mappedWhName = data.warehouse_name || warehouseMap.get(docWh) || docWh.toUpperCase();
              hydrantsList.push({
                id: data.id,
                number: data.number,
                type: data.type || 'Box Hydrant',
                location_name: data.location_name,
                location_type: data.location_type || 'indoor',
                warehouse_id: data.warehouse_id,
                warehouse_name: mappedWhName,
                qr_hash: hash,
                qr_code: qrVal,
              });
            }
          }

          // Ambil items
          const iSnap = await getDocs(collection(db, 'checklist_items'));
          const itemsList: ChecklistItem[] = [];
          iSnap.forEach((doc) => {
            itemsList.push(doc.data() as ChecklistItem);
          });
          itemsList.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

          const rawWhIds = profile.warehouseIds || [];
          const assignedNames = rawWhIds.length > 0
            ? rawWhIds.map((id: string) => warehouseMap.get(id.toLowerCase()) || id.toUpperCase())
            : Array.from(new Set(hydrantsList.map((h) => h.warehouse_name).filter(Boolean)));

          const newB = {
            user: {
              id: profile.id,
              name: profile.name,
              role: profile.role,
              warehouseIds: profile.warehouseIds || [],
              warehouseNames: assignedNames,
            },
            hydrants: hydrantsList,
            items: itemsList,
            frequency: 'harian' as const,
            fetchedAt: new Date().toISOString(),
          };
          setBundle(newB);
          try {
            await saveBundleCache(newB);
          } catch {}
        } catch (e) {
          console.error('Error fetching hydrants from Firestore:', e);
        } finally {
          setLoadingData(false);
        }
      };

      fetchData();
    }
  }, [user, profile, authLoading, router]);

  if (authLoading || loadingData || !bundle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Memuat data petugas & titik hydrant…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas p-4 sm:p-6 pb-20">
      <div className="max-w-md mx-auto">
        <PetugasClientDashboard initialBundle={bundle} />
      </div>
    </div>
  );
}

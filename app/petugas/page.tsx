'use client';

import { useAuth } from '@/lib/firebase/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import PetugasClientDashboard from './PetugasClientDashboard';
import type { PetugasBundle, CachedHydrant, ChecklistItem } from '@/lib/types';
import { createHash } from 'crypto';

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

      // Ambil data dari Firestore
      const fetchData = async () => {
        try {
          const userWh = profile.warehouseIds || [];
          
          // Ambil hydrants
          const hSnap = await getDocs(collection(db, 'hydrants'));
          const hydrantsList: CachedHydrant[] = [];
          
          hSnap.forEach((doc) => {
            const data = doc.data();
            // Hanya ambil gudang yang ditugaskan ke petugas ini
            if (userWh.includes(data.warehouse_id)) {
              hydrantsList.push({
                id: data.id,
                number: data.number,
                type: data.type || 'Box Hydrant',
                location_name: data.location_name,
                location_type: data.location_type || 'indoor',
                warehouse_id: data.warehouse_id,
                warehouse_name: data.warehouse_name || '',
                qr_hash: data.qr_code ? createHash('sha256').update(data.qr_code).digest('hex') : '',
              });
            }
          });

          // Ambil items
          const iSnap = await getDocs(collection(db, 'checklist_items'));
          const itemsList: ChecklistItem[] = [];
          iSnap.forEach((doc) => {
            itemsList.push(doc.data() as ChecklistItem);
          });
          itemsList.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

          setBundle({
            user: {
              id: profile.id,
              name: profile.name,
              role: profile.role,
              warehouseIds: profile.warehouseIds || [],
            },
            hydrants: hydrantsList,
            items: itemsList,
            frequency: 'harian',
            fetchedAt: new Date().toISOString(),
          });
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

'use client';

import { useAuth } from '@/lib/firebase/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import InspectionWizard from '@/components/petugas/InspectionWizard';
import type { PetugasBundle, CachedHydrant, ChecklistItem } from '@/lib/types';
import { createHash } from 'crypto';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

function PeriksaContent() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qr = searchParams.get('qr') || undefined;

  const [bundle, setBundle] = useState<PetugasBundle | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    if (!authLoading) {
      if (!user || !profile) {
        router.push('/login');
        return;
      }

      const fetchData = async () => {
        try {
          const userWh = profile.warehouseIds || [];
          const hSnap = await getDocs(collection(db, 'hydrants'));
          const hydrantsList: CachedHydrant[] = [];

          hSnap.forEach((doc) => {
            const data = doc.data();
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
          console.error(e);
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
          <p className="text-sm font-medium text-slate-600">Menyiapkan kamera & checklist…</p>
        </div>
      </div>
    );
  }

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

export default function PeriksaPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Memuat halaman pemeriksaan…</p>
        </div>
      </div>
    }>
      <PeriksaContent />
    </Suspense>
  );
}

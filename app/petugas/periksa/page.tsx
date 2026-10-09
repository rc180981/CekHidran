'use client';

import { useAuth } from '@/lib/firebase/auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import InspectionWizard from '@/components/petugas/InspectionWizard';
import type { PetugasBundle, CachedHydrant, ChecklistItem } from '@/lib/types';
import { sha256Hex } from '@/lib/qr';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { getBundle, setBundle as saveBundleCache } from '@/lib/offline/db';

function PeriksaContent() {
  const { user, profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const qr = searchParams.get('qr') || undefined;

  const [bundle, setBundle] = useState<PetugasBundle | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadData = async () => {
    setLoadingData(true);
    setErrorMessage(null);

    // 1. Coba ambil dari IndexedDB cache lokal terlebih dahulu (instan 0ms)
    try {
      const cached = await getBundle();
      if (cached && cached.hydrants && cached.hydrants.length > 0) {
        setBundle(cached);
        setLoadingData(false);
        return;
      }
    } catch (e) {
      console.warn('Gagal membaca cache lokal IndexedDB:', e);
    }

    // 2. Jika cache belum ada, ambil langsung dari Firestore
    try {
      const userWh = (profile?.warehouseIds || []).map((w: string) => w.toLowerCase());
      const hSnap = await getDocs(collection(db, 'hydrants'));
      const hydrantsList: CachedHydrant[] = [];

      for (const doc of hSnap.docs) {
        const data = doc.data();
        const docWh = (data.warehouse_id || '').toLowerCase();
        // Cocokkan gudang jika petugas punya tugas spesifik, atau ambil semua jika profil kosong
        if (userWh.length === 0 || userWh.includes(docWh)) {
          const qrVal = data.qr_code || '';
          const hash = qrVal ? await sha256Hex(qrVal) : '';
          hydrantsList.push({
            id: data.id,
            number: data.number,
            type: data.type || 'Box Hydrant',
            location_name: data.location_name,
            location_type: data.location_type || 'indoor',
            warehouse_id: data.warehouse_id,
            warehouse_name: data.warehouse_name || '',
            qr_hash: hash,
            qr_code: qrVal,
          });
        }
      }

      // Jika filter gudang menghasilkan 0, ambil seluruh hydrant yang ada
      if (hydrantsList.length === 0 && hSnap.docs.length > 0) {
        for (const doc of hSnap.docs) {
          const data = doc.data();
          const qrVal = data.qr_code || '';
          const hash = qrVal ? await sha256Hex(qrVal) : '';
          hydrantsList.push({
            id: data.id,
            number: data.number,
            type: data.type || 'Box Hydrant',
            location_name: data.location_name,
            location_type: data.location_type || 'indoor',
            warehouse_id: data.warehouse_id,
            warehouse_name: data.warehouse_name || '',
            qr_hash: hash,
            qr_code: qrVal,
          });
        }
      }

      const iSnap = await getDocs(collection(db, 'checklist_items'));
      const itemsList: ChecklistItem[] = [];
      iSnap.forEach((doc) => {
        itemsList.push(doc.data() as ChecklistItem);
      });
      itemsList.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

      const newBundle: PetugasBundle = {
        user: {
          id: profile?.id || 'petugas',
          name: profile?.name || 'Petugas Lapangan',
          role: profile?.role || 'petugas',
          warehouseIds: profile?.warehouseIds || ['wh2'],
        },
        hydrants: hydrantsList,
        items: itemsList,
        frequency: 'harian',
        fetchedAt: new Date().toISOString(),
      };

      setBundle(newBundle);
      // Simpan ke cache agar siap offline
      try {
        await saveBundleCache(newBundle);
      } catch {}
    } catch (e: any) {
      console.error('Error loading periksa bundle:', e);
      setErrorMessage(e?.message || 'Gagal memuat data titik hydrant dari server.');
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user || !profile) {
        router.push('/login');
        return;
      }
      loadData();
    }
  }, [user, profile, authLoading, router]);

  if (authLoading || (loadingData && !bundle)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas p-4">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Menyiapkan kamera & checklist…</p>
        </div>
      </div>
    );
  }

  if (errorMessage && !bundle) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas p-6">
        <div className="card p-6 max-w-sm w-full text-center space-y-4">
          <div className="h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto font-bold text-lg">
            !
          </div>
          <div>
            <h2 className="font-bold text-slate-900 text-base">Gagal Menyiapkan Data</h2>
            <p className="text-xs text-slate-600 mt-1">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={loadData}
            className="btn-primary w-full text-sm"
          >
            Coba Lagi
          </button>
          <Link href="/petugas" className="btn-secondary w-full text-xs block text-center">
            Kembali ke Beranda Petugas
          </Link>
        </div>
      </div>
    );
  }

  if (!bundle) return null;

  return (
    <div className="min-h-[100dvh] bg-canvas pb-8 sm:pb-16 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md px-3 py-2 sm:px-6 sm:py-2.5">
        <div className="max-w-xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/petugas"
              aria-label="Kembali ke Dashboard Petugas"
              className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-50 active:scale-95 transition-all"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1 className="text-xs sm:text-sm font-black text-slate-900 tracking-wider uppercase leading-tight">
                PEMERIKSAAN HYDRANT
              </h1>
              <p className="text-[9px] sm:text-[10px] font-bold text-primary tracking-wider uppercase">
                FORM INSPEKSI RUTIN K3
              </p>
            </div>
          </div>
          <span className="text-[9px] sm:text-[10px] font-extrabold uppercase px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200/70">
            HARIAN
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-xl w-full mx-auto px-3 py-2.5 sm:px-6 sm:py-4 flex-1">
        <InspectionWizard initialBundle={bundle} initialQr={qr} />
      </main>
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

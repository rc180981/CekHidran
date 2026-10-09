'use client';

import { listQueue, removeQueued, updateQueued } from './db';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/client';

export interface SyncResult {
  sent: number;
  failed: number;
  remaining: number;
  authRequired: boolean;
}

let running: Promise<SyncResult> | null = null;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** Kirim seluruh antrean ke server Firestore. Aman dipanggil berulang (satu proses sekaligus). */
export function syncQueue(): Promise<SyncResult> {
  if (!running) running = doSync().finally(() => (running = null));
  return running;
}

async function doSync(): Promise<SyncResult> {
  const items = await listQueue();
  let sent = 0;
  let failed = 0;
  let authRequired = false;

  for (const it of items) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) break;

    try {
      // 1. Konversi foto & ttd ke Base64 Data URL
      const photoUrls: string[] = [];
      for (const p of it.photos) {
        if (p.blob) {
          const url = await blobToDataUrl(p.blob);
          photoUrls.push(url);
        }
      }

      let signatureUrl = '';
      if (it.signature) {
        signatureUrl = await blobToDataUrl(it.signature);
      }

      // 2. Simpan dokumen inspeksi ke Firestore
      const insDoc = {
        id: it.id,
        user_id: it.userId || auth.currentUser?.uid || 'petugas',
        hydrant_id: it.hydrantId,
        hydrant_label: it.hydrantLabel,
        qr_code: it.qrCode,
        inspected_at: it.inspectedAt,
        notes: it.notes || '',
        results: it.results || [],
        photos: photoUrls,
        signature_url: signatureUrl,
        created_at: it.createdAt || new Date().toISOString(),
        synced_at: new Date().toISOString(),
      };

      await setDoc(doc(db, 'inspections', it.id), insDoc, { merge: true });

      // 3. Jika ada checklist berstatus 'tidak_baik', buat temuan otomatis di Firestore
      const badItems = (it.results || []).filter((r: any) => r.result === 'tidak_baik');
      for (const bad of badItems) {
        const findingId = `${it.id}_${bad.checklistItemId}`;
        let itemPhotoUrl: string | null = null;
        if (bad.photo?.blob) {
          try {
            itemPhotoUrl = await blobToDataUrl(bad.photo.blob);
          } catch {}
        }

        const findingPhotos = itemPhotoUrl ? [itemPhotoUrl] : photoUrls;

        await setDoc(
          doc(db, 'findings', findingId),
          {
            id: findingId,
            inspection_id: it.id,
            hydrant_id: it.hydrantId,
            check_item_id: bad.checklistItemId,
            description: bad.notes
              ? bad.notes
              : it.notes
              ? `Kondisi tidak baik: ${it.notes}`
              : 'Kondisi tidak baik saat pemeriksaan',
            status: 'terbuka',
            reported_by: it.userId || auth.currentUser?.uid || 'petugas',
            created_at: it.inspectedAt || new Date().toISOString(),
            photo_url: itemPhotoUrl || (photoUrls.length > 0 ? photoUrls[0] : null),
            photos: findingPhotos,
          },
          { merge: true },
        );
      }

      // 4. Hapus dari antrean lokal karena sudah sukses masuk ke database
      await removeQueued(it.id);
      sent++;
    } catch (err: any) {
      console.error('Gagal sinkronisasi antrean ke Firestore:', err);
      const isAuthError = err?.code === 'permission-denied';
      if (isAuthError) {
        authRequired = true;
        await updateQueued({
          ...it,
          lastError: 'Izin database Firebase ditolak. Pastikan aturan Firestore Rules mengizinkan penulisan.',
        });
        break;
      }
      await updateQueued({
        ...it,
        attempts: it.attempts + 1,
        lastError: err?.message || 'Gagal menyimpan ke Firestore',
      });
      failed++;
    }
  }

  const remaining = (await listQueue()).length;
  return { sent, failed, remaining, authRequired };
}

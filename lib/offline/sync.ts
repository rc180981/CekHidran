'use client';

import { listQueue, removeQueued, updateQueued } from './db';
import { doc, setDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/client';

export interface SyncResult {
  sent: number;
  failed: number;
  remaining: number;
  authRequired: boolean;
  errorMessage?: string;
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

/** Kompresi gambar blob sebelum dikonversi ke Base64 agar muat dalam batas dokumen Firestore 1MB */
async function compressImageBlob(blob: Blob, maxWidth = 800, quality = 0.7): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return blobToDataUrl(blob);
  }
  try {
    const bitmap = await createImageBitmap(blob);
    const scale = Math.min(1, maxWidth / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return blobToDataUrl(blob);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', quality);
  } catch {
    return blobToDataUrl(blob);
  }
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
  let lastErrorMessage: string | undefined = undefined;

  for (const it of items) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) break;

    try {
      // 1. Konversi foto & ttd ke Base64 Data URL terkompresi (<1MB)
      const photoUrls: string[] = [];
      for (const p of it.photos) {
        if (p.blob) {
          const url = await compressImageBlob(p.blob, 800, 0.7);
          photoUrls.push(url);
        }
      }

      let signatureUrl = '';
      if (it.signature) {
        signatureUrl = await compressImageBlob(it.signature, 400, 0.8);
      }

      // 2. Bersihkan and sanitasi results (konversi blob foto per checklist ke Base64, hapus custom Blob object)
      const cleanResults = [];
      for (const r of it.results || []) {
        let itemPhotoUrl: string | null = null;
        if (r.photo?.blob) {
          try {
            itemPhotoUrl = await compressImageBlob(r.photo.blob, 800, 0.7);
          } catch (e) {
            console.warn('Gagal kompresi foto checklist item:', e);
          }
        } else if (typeof (r as any).photo_url === 'string') {
          itemPhotoUrl = (r as any).photo_url;
        }

        cleanResults.push({
          checklistItemId: r.checklistItemId,
          result: r.result,
          notes: r.notes || '',
          photo_url: itemPhotoUrl,
          taken_at: r.photo?.takenAt || null,
        });
      }

      // 3. Simpan dokumen inspeksi ke Firestore (bersih dari custom Blob object)
      const insDoc = {
        id: it.id,
        user_id: it.userId || auth.currentUser?.uid || 'petugas',
        hydrant_id: it.hydrantId,
        hydrant_label: it.hydrantLabel,
        qr_code: it.qrCode,
        inspected_at: it.inspectedAt,
        notes: it.notes || '',
        results: cleanResults,
        photos: photoUrls,
        signature_url: signatureUrl,
        created_at: it.createdAt || new Date().toISOString(),
        synced_at: new Date().toISOString(),
      };

      await setDoc(doc(db, 'inspections', it.id), insDoc, { merge: true });

      // 4. Jika ada checklist berstatus 'tidak_baik', buat temuan otomatis di Firestore
      const badItems = cleanResults.filter((r: any) => r.result === 'tidak_baik');
      for (const bad of badItems) {
        const findingId = `${it.id}_${bad.checklistItemId}`;
        const findingPhotos = bad.photo_url ? [bad.photo_url] : photoUrls;

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
            photo_url: bad.photo_url || (photoUrls.length > 0 ? photoUrls[0] : null),
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
      const msg = isAuthError
        ? 'Izin database Firebase ditolak. Pastikan akun memiliki hak akses inspeksi.'
        : err?.message || 'Gagal menyimpan ke server';
      lastErrorMessage = msg;
      if (isAuthError) {
        authRequired = true;
        await updateQueued({
          ...it,
          lastError: msg,
        });
        break;
      }
      await updateQueued({
        ...it,
        attempts: (it.attempts || 0) + 1,
        lastError: msg,
      });
      failed++;
    }
  }

  const remaining = (await listQueue()).length;
  return { sent, failed, remaining, authRequired, errorMessage: lastErrorMessage };
}

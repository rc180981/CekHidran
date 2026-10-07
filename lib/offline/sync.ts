'use client';

import { listQueue, removeQueued, updateQueued } from './db';

export interface SyncResult {
  sent: number;
  failed: number;
  remaining: number;
  authRequired: boolean;
}

let running: Promise<SyncResult> | null = null;

/** Kirim seluruh antrean ke server. Aman dipanggil berulang (satu proses sekaligus). */
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
    const fd = new FormData();
    fd.append(
      'meta',
      JSON.stringify({
        id: it.id,
        userId: it.userId,
        hydrantId: it.hydrantId,
        qrCode: it.qrCode,
        inspectedAt: it.inspectedAt,
        notes: it.notes,
        results: it.results,
        photos: it.photos.map((p) => ({ takenAt: p.takenAt })),
      }),
    );
    it.photos.forEach((p, i) => fd.append(`photo_${i}`, p.blob, `foto-${i + 1}.jpg`));
    fd.append('signature', it.signature, 'ttd.png');

    try {
      const res = await fetch('/api/inspections', { method: 'POST', body: fd, credentials: 'same-origin' });
      if (res.ok) {
        await removeQueued(it.id);
        sent++;
        continue;
      }
      const body = await res.json().catch(() => ({}) as { error?: string });
      const message = body.error ?? `Gagal mengirim (kode ${res.status})`;
      if (res.status === 401) {
        authRequired = true;
        await updateQueued({ ...it, lastError: 'Sesi berakhir. Silakan masuk kembali untuk mengirim.' });
        break;
      }
      // 4xx = ditolak permanen (perlu tindakan), 5xx = coba lagi nanti
      await updateQueued({ ...it, attempts: it.attempts + 1, lastError: message, rejected: res.status < 500 });
      failed++;
    } catch {
      // jaringan putus: hentikan, coba lagi saat online
      break;
    }
  }

  const remaining = (await listQueue()).length;
  return { sent, failed, remaining, authRequired };
}

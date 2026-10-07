'use client';

/** Gambar cap (tanggal, jam, petugas, nomor hydrant) di bagian bawah foto. */
export function drawStamp(ctx: CanvasRenderingContext2D, w: number, h: number, lines: string[]) {
  const fs = Math.max(14, Math.round(w * 0.03));
  const pad = Math.round(fs * 0.7);
  const lh = Math.round(fs * 1.35);
  const boxH = lines.length * lh + pad * 2;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, h - boxH, w, boxH);
  ctx.fillStyle = '#FFFFFF';
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => {
    ctx.font = `${i === 0 ? 700 : 500} ${fs}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
    ctx.fillText(line, pad, h - boxH + pad + i * lh, w - pad * 2);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.8): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Gagal memproses foto'))), type, quality),
  );
}

function fitSize(w: number, h: number, max: number) {
  const scale = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

/** Ambil frame dari video kamera → JPEG terkompresi + cap. */
export async function captureFromVideo(video: HTMLVideoElement, lines: string[], max = 1280): Promise<Blob> {
  const { w, h } = fitSize(video.videoWidth, video.videoHeight, max);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(video, 0, 0, w, h);
  drawStamp(ctx, w, h, lines);
  return canvasToBlob(canvas);
}

/** Fallback (input capture): beri cap pada berkas foto dari kamera. */
export async function stampImageFile(file: File, lines: string[], max = 1280): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const { w, h } = fitSize(bitmap.width, bitmap.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  drawStamp(ctx, w, h, lines);
  return canvasToBlob(canvas);
}

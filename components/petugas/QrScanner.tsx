'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, Image as ImageIcon } from 'lucide-react';

/**
 * Pemindai QR universal:
 * 1. Coba live video stream (getUserMedia).
 * 2. Jika tidak didukung atau diblokir (karena HTTP biasa tanpa HTTPS),
 *    sediakan fallback foto kamera langsung via <input type="file" capture="environment">
 *    sehingga BISA BERJALAN DI SEMUA HP & SEMUA BROWSER.
 */
export default function QrScanner({
  onResult,
  paused = false,
}: {
  onResult: (text: string) => void;
  paused?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);

  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let last = 0;
    let stopped = false;

    async function start() {
      // Browser modern memblokir getUserMedia jika diakses via HTTP IP lokal (non-localhost & non-HTTPS)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setUseFallback(true);
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
          audio: false,
        });
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play();
          setReady(true);
          canvasRef.current = document.createElement('canvas');
          raf = requestAnimationFrame(tick);
        }
      } catch (e: any) {
        console.warn('getUserMedia tidak tersedia atau ditolak, mengalihkan ke mode jepret foto:', e);
        setUseFallback(true);
      }
    }

    function tick(t: number) {
      if (stopped) return;
      raf = requestAnimationFrame(tick);
      if (pausedRef.current || t - last < 200) return;
      last = t;
      const v = videoRef.current;
      const c = canvasRef.current;
      if (!v || !c || v.readyState < 2 || !v.videoWidth) return;
      const scale = Math.min(1, 720 / v.videoWidth);
      c.width = Math.round(v.videoWidth * scale);
      c.height = Math.round(v.videoHeight * scale);
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const img = ctx.getImageData(0, 0, c.width, c.height);
      const code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
      if (code?.data) {
        if (navigator.vibrate) navigator.vibrate(80);
        onResultRef.current(code.data);
      }
    }

    start();
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Handler fallback: jika video stream tidak diizinkan di HTTP, jepret foto QR langsung via kamera native
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setProcessingImage(true);
    setError(null);

    try {
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      const maxDim = 1200;
      const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.round(bitmap.width * scale);
      canvas.height = Math.round(bitmap.height * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas context gagal');

      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'attemptBoth' });

      if (code?.data) {
        if (navigator.vibrate) navigator.vibrate(80);
        onResultRef.current(code.data);
      } else {
        setError('QR Code tidak terdeteksi pada gambar. Pastikan gambar jelas, tidak buram, dan QR terlihat penuh.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Gagal membaca gambar QR. Coba jepret ulang.');
    } finally {
      setProcessingImage(false);
    }
  };

  return (
    <div className="space-y-3">
      {!useFallback ? (
        <div className="relative aspect-[4/3] max-h-[320px] sm:max-h-[380px] w-full overflow-hidden rounded-2xl bg-slate-900 shadow-inner">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-3/5 w-3/5 max-w-[200px] max-h-[200px] rounded-2xl border-4 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)] animate-pulse" />
          </div>
          {!ready && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white bg-slate-900/90">
              <div className="h-7 w-7 border-3 border-white border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold tracking-wide">Menyiapkan kamera live…</p>
            </div>
          )}
        </div>
      ) : (
        <div className="card p-5 text-center space-y-3.5 border-dashed border-2 border-primary/40 bg-teal-50/30">
          <div className="h-14 w-14 mx-auto rounded-2xl bg-teal-100 flex items-center justify-center text-teal-800">
            <Camera size={28} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 uppercase">Pindai QR Code via Kamera HP</h3>
            <p className="text-xs text-slate-600 mt-1">
              Ketuk tombol di bawah untuk membuka kamera bawaan ponsel dan memotret QR Code pada pintu box hydrant.
            </p>
          </div>

          <label className="relative w-full h-12 rounded-xl bg-gradient-to-r from-primary to-teal-800 hover:from-primary-700 hover:to-teal-900 active:scale-[0.98] text-white font-bold text-sm tracking-wide shadow-md shadow-primary/25 transition-all flex items-center justify-center gap-2 cursor-pointer select-none">
            <Camera size={20} />
            <span>{processingImage ? 'MEMBACA QR CODE…' : 'BUKA KAMERA & JEPRET QR'}</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handleFileScan}
              disabled={processingImage}
            />
          </label>
        </div>
      )}

      {/* Tombol alternatif switch jika live scanner lambat atau ingin via foto */}
      {!useFallback && (
        <div className="text-center pt-1">
          <label className="text-xs text-primary font-semibold hover:underline cursor-pointer inline-flex items-center gap-1">
            <Camera size={14} /> Jika kamera live tidak fokus, klik di sini untuk jepret foto QR
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={handleFileScan}
              disabled={processingImage}
            />
          </label>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800">
          {error}
        </div>
      )}
    </div>
  );
}

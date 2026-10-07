'use client';

import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';

/** Pemindai QR berbasis kamera belakang (getUserMedia + jsQR). */
export default function QrScanner({ onResult, paused = false }: { onResult: (text: string) => void; paused?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
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
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Perangkat/browser ini tidak mendukung akses kamera. Gunakan Chrome atau Safari terbaru.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
          audio: false,
        });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        const v = videoRef.current!;
        v.srcObject = stream;
        await v.play();
        setReady(true);
        canvasRef.current = document.createElement('canvas');
        raf = requestAnimationFrame(tick);
      } catch (e: any) {
        setError(
          e?.name === 'NotAllowedError'
            ? 'Izin kamera ditolak. Aktifkan izin kamera untuk aplikasi ini di pengaturan browser.'
            : 'Kamera tidak dapat dibuka. Pastikan tidak sedang dipakai aplikasi lain.',
        );
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
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
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

  if (error) {
    return <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-900">{error}</div>;
  }

  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-slate-900">
      <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div className="h-3/5 w-3/5 rounded-3xl border-4 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      </div>
      {!ready && <p className="absolute inset-0 grid place-items-center text-sm font-medium text-white">Membuka kamera…</p>}
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { captureFromVideo, stampImageFile } from '@/lib/image';

/**
 * Ambil foto LANGSUNG dari kamera (live preview). Tidak ada pemilih galeri.
 * Fallback untuk browser tanpa getUserMedia: input capture="environment"
 * dan menolak berkas yang bukan hasil jepretan baru (> 2 menit).
 */
export default function CameraCapture({
  onCapture,
  disabled,
  getStampLines,
}: {
  onCapture: (blob: Blob, takenAt: Date) => void;
  disabled?: boolean;
  getStampLines: (at: Date) => string[];
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<'loading' | 'live' | 'fallback'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stopped = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setMode('fallback');
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        });
        if (stopped) return stream.getTracks().forEach((t) => t.stop());
        videoRef.current!.srcObject = stream;
        await videoRef.current!.play();
        setMode('live');
      } catch (e: any) {
        if (e?.name === 'NotAllowedError') setError('Izin kamera ditolak. Aktifkan izin kamera untuk melanjutkan.');
        setMode('fallback');
      }
    })();
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function snap() {
    if (!videoRef.current || busy) return;
    setBusy(true);
    try {
      const at = new Date();
      const blob = await captureFromVideo(videoRef.current, getStampLines(at));
      setFlash(true);
      setTimeout(() => setFlash(false), 150);
      onCapture(blob, at);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (Date.now() - file.lastModified > 2 * 60 * 1000) {
      setError('Foto harus diambil langsung dari kamera saat pemeriksaan, bukan dari galeri.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const at = new Date();
      onCapture(await stampImageFile(file, getStampLines(at)), at);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {mode !== 'fallback' && (
        <div className="relative aspect-[4/3] max-h-[320px] sm:max-h-[380px] w-full overflow-hidden rounded-2xl bg-slate-900 shadow-inner">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          {flash && <div className="absolute inset-0 bg-white/80 transition-opacity" />}
          {mode === 'loading' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white bg-slate-900/90">
              <div className="h-7 w-7 border-3 border-white border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold tracking-wide">Membuka kamera…</p>
            </div>
          )}
        </div>
      )}
      {error && (
        <div role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-800 border border-red-200">
          {error}
        </div>
      )}
      {mode === 'live' && (
        <button
          type="button"
          onClick={snap}
          disabled={disabled || busy}
          className="relative w-full h-12 rounded-xl bg-gradient-to-r from-primary to-teal-800 hover:from-primary-700 hover:to-teal-900 active:scale-[0.98] text-white font-bold text-sm tracking-wide shadow-md shadow-primary/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed select-none"
        >
          <Camera size={20} />
          <span>{disabled ? 'MAKSIMAL 3 FOTO' : busy ? 'MEMPROSES CAP FOTO…' : 'AMBIL FOTO DARI KAMERA'}</span>
        </button>
      )}
      {mode === 'fallback' && (
        <label className={`relative w-full h-12 rounded-xl bg-gradient-to-r from-primary to-teal-800 hover:from-primary-700 hover:to-teal-900 active:scale-[0.98] text-white font-bold text-sm tracking-wide shadow-md shadow-primary/25 transition-all flex items-center justify-center gap-2 cursor-pointer select-none ${disabled || busy ? 'pointer-events-none opacity-50' : ''}`}>
          <Camera size={20} />
          <span>{disabled ? 'MAKSIMAL 3 FOTO' : 'BUKA KAMERA HP'}</span>
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFile} disabled={disabled || busy} />
        </label>
      )}
    </div>
  );
}

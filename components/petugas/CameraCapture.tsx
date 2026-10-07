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
        <div className="relative aspect-[3/4] w-full overflow-hidden rounded-2xl bg-slate-900">
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          {flash && <div className="absolute inset-0 bg-white/80" />}
          {mode === 'loading' && <p className="absolute inset-0 grid place-items-center text-sm font-medium text-white">Membuka kamera…</p>}
        </div>
      )}
      {error && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-900">{error}</p>}
      {mode === 'live' && (
        <button type="button" onClick={snap} disabled={disabled || busy} className="btn-primary btn-lg w-full">
          <Camera size={22} /> {disabled ? 'Maksimal 3 foto' : busy ? 'Memproses…' : 'Ambil foto'}
        </button>
      )}
      {mode === 'fallback' && (
        <label className={`btn-primary btn-lg w-full ${disabled || busy ? 'pointer-events-none opacity-50' : ''}`}>
          <Camera size={22} /> {disabled ? 'Maksimal 3 foto' : 'Buka kamera'}
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={onFile} disabled={disabled || busy} />
        </label>
      )}
    </div>
  );
}

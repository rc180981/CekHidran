'use client';

import { useEffect, useRef } from 'react';
import { Eraser } from 'lucide-react';

/** Tanda tangan digital pada canvas (mouse, sentuh, stylus). */
export default function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const widthRef = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  function setup(force = false) {
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    // hindari menghapus tanda tangan saat address bar mobile berubah tinggi
    if (!force && Math.round(rect.width) === widthRef.current) return;
    widthRef.current = Math.round(rect.width);
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(rect.width * dpr);
    c.height = Math.round(rect.height * dpr);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
    onChangeRef.current(null);
  }

  useEffect(() => {
    setup(true);
    const onResize = () => setup(false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const p = pos(e);
    last.current = p;
    const ctx = e.currentTarget.getContext('2d')!;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.2, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !last.current) return;
    const p = pos(e);
    const ctx = e.currentTarget.getContext('2d')!;
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  }

  function up(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    last.current = null;
    onChangeRef.current(e.currentTarget.toDataURL('image/png'));
  }

  return (
    <div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          aria-label="Area tanda tangan"
          className="h-44 w-full touch-none rounded-2xl border-2 border-dashed border-slate-300 bg-white"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
        />
        <span className="pointer-events-none absolute bottom-3 left-4 right-4 border-t border-slate-300 pt-1 text-xs text-slate-400">
          Tanda tangan petugas
        </span>
      </div>
      <button type="button" onClick={() => setup(true)} className="btn-ghost mt-2">
        <Eraser size={18} /> Hapus tanda tangan
      </button>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { QrCode, Trash2, ArrowLeft, ArrowRight, Save, Wifi, WifiOff } from 'lucide-react';
import StepIndicator from '@/components/StepIndicator';
import QrScanner from './QrScanner';
import CameraCapture from './CameraCapture';
import SignaturePad from './SignaturePad';
import { extractQrCode, sha256Hex, safeUUID } from '@/lib/qr';
import { formatDateTime, formatStamp } from '@/lib/period';
import { getBundle, enqueue, refreshBundle } from '@/lib/offline/db';
import { syncQueue } from '@/lib/offline/sync';
import type { CachedHydrant, ChecklistItem, PetugasBundle, CheckResultValue } from '@/lib/types';
import { StatusBadge, LocationTag } from '@/components/ui';

const STEPS = ['INFO HYDRANT', 'FOTO KONDISI', 'CHECKLIST & TTD'];

interface PhotoItem {
  blob: Blob;
  previewUrl: string;
  takenAt: Date;
}

export default function InspectionWizard({
  initialBundle,
  initialQr,
}: {
  initialBundle: PetugasBundle;
  initialQr?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [bundle, setBundle] = useState<PetugasBundle>(initialBundle);
  const [online, setOnline] = useState<boolean>(true);

  // Step 1: Info Hydrant
  const [scannedText, setScannedText] = useState<string>('');
  const [matchedHydrant, setMatchedHydrant] = useState<CachedHydrant | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanMode, setScanMode] = useState<boolean>(true);

  // Step 2: Foto Kondisi
  const [photos, setPhotos] = useState<PhotoItem[]>([]);

  // Step 3: Checklist & TTD
  const [results, setResults] = useState<Record<string, CheckResultValue>>({});
  const [notes, setNotes] = useState<string>('');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Set default checklist hasil 'baik' saat items tersedia
  useEffect(() => {
    if (bundle.items.length > 0 && Object.keys(results).length === 0) {
      const initial: Record<string, CheckResultValue> = {};
      bundle.items.forEach((item) => {
        initial[item.id] = 'baik';
      });
      setResults(initial);
    }
  }, [bundle.items]);

  // Cek jika ada QR dari parameter query
  useEffect(() => {
    const qrParam = initialQr || searchParams.get('qr');
    if (qrParam) {
      handleQrFound(qrParam);
    }
  }, [initialQr, searchParams]);

  async function handleQrFound(rawText: string) {
    setScanError(null);
    const trimmed = rawText.trim();
    const code = extractQrCode(trimmed);
    setScannedText(code);

    let hashRaw = '';
    let hashCode = '';
    try {
      hashRaw = await sha256Hex(trimmed);
      hashCode = await sha256Hex(code);
    } catch (e) {
      console.warn('sha256 calculation failed:', e);
    }

    const cleanSearch = code.toLowerCase().replace(/[^a-z0-9]/g, '');

    const found = bundle.hydrants.find((h) => {
      if (h.qr_hash && (h.qr_hash === hashRaw || h.qr_hash === hashCode)) return true;
      if (h.qr_code && (h.qr_code === trimmed || h.qr_code === code)) return true;
      if (h.qr_code && extractQrCode(h.qr_code) === code) return true;
      if (h.number.toLowerCase() === code.toLowerCase()) return true;

      // Pencocokan nomor hydrant (misal H-01 di dalam QR)
      const cleanNum = h.number.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanSearch.includes(cleanNum)) {
        const matchesWarehouse =
          trimmed.toLowerCase().includes(h.warehouse_name.toLowerCase()) ||
          trimmed.toLowerCase().includes(h.warehouse_id.toLowerCase()) ||
          bundle.hydrants.length <= 18;
        if (matchesWarehouse) return true;
      }
      return false;
    });

    if (found) {
      setMatchedHydrant(found);
      setScanMode(false);
    } else {
      setMatchedHydrant(null);
      setScanError(
        'QR Code tidak cocok dengan daftar hydrant yang ditugaskan ke Anda. Pastikan QR valid dan Anda ditugaskan ke gudang tersebut.'
      );
    }
  }

  function handlePhotoCapture(blob: Blob, takenAt: Date) {
    if (photos.length >= 4) return;
    const previewUrl = URL.createObjectURL(blob);
    setPhotos((prev) => [...prev, { blob, previewUrl, takenAt }]);
  }

  function removePhoto(index: number) {
    setPhotos((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function getStampLines(takenAt: Date): string[] {
    return [
      `No: ${matchedHydrant?.number ?? '-'} (${matchedHydrant?.warehouse_name ?? '-'})`,
      `Waktu: ${formatStamp(takenAt)}`,
      `Petugas: ${bundle.user.name}`,
    ];
  }

  async function handleSaveInspection() {
    if (!matchedHydrant || !scannedText) {
      setSubmitError('Informasi hydrant atau scan QR tidak valid.');
      return;
    }
    if (photos.length < 1) {
      setSubmitError('Wajib melampirkan minimal 1 foto kondisi.');
      return;
    }
    if (!signatureData) {
      setSubmitError('Tanda tangan digital wajib diisi.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const inspectionId = safeUUID();
      const inspectedAt = new Date().toISOString();

      // Convert signature base64 data to Blob
      const resSig = await fetch(signatureData);
      const signatureBlob = await resSig.blob();

      const queuedItem = {
        id: inspectionId,
        userId: bundle.user.id,
        hydrantId: matchedHydrant.id,
        hydrantLabel: `${matchedHydrant.number} - ${matchedHydrant.location_name}`,
        qrCode: scannedText,
        inspectedAt,
        notes,
        results: Object.entries(results).map(([checklistItemId, result]) => ({
          checklistItemId,
          result,
        })),
        photos: photos.map((p) => ({
          blob: p.blob,
          takenAt: p.takenAt.toISOString(),
        })),
        signature: signatureBlob,
        createdAt: new Date().toISOString(),
        attempts: 0,
        lastError: null,
      };

      // Simpan ke IndexedDB queue terlebih dahulu
      await enqueue(queuedItem);

      // Coba sinkronisasi jika online
      if (navigator.onLine) {
        try {
          await syncQueue();
        } catch (e) {
          console.warn('Sync tertunda:', e);
        }
      }

      router.push('/petugas?sukses=1');
    } catch (err: any) {
      console.error(err);
      setSubmitError(err?.message || 'Gagal menyimpan data pemeriksaan.');
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Network banner */}
      <div className="flex items-center justify-between text-xs text-slate-600 bg-white border border-slate-200/80 px-3.5 py-2.5 rounded-xl shadow-xs">
        <div className="flex items-center gap-2 font-semibold">
          {online ? (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/70 text-[11px]">
              <Wifi size={12} className="text-emerald-600" />
              <span>ONLINE</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/70 text-[11px]">
              <WifiOff size={12} className="text-amber-600" />
              <span>OFFLINE (TERSIMPAN LOKAL)</span>
            </span>
          )}
        </div>
        <div className="text-[11px] font-bold text-slate-700 truncate max-w-[160px] sm:max-w-none">
          PETUGAS: <span className="text-primary">{bundle.user.name}</span>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="card p-3 sm:p-4">
        <StepIndicator steps={STEPS} current={step} />
      </div>

      {/* LANGKAH 1: INFO HYDRANT */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="card p-4 sm:p-5 space-y-4">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 uppercase tracking-wider">
                LANGKAH 1: PINDAI QR CODE HYDRANT
              </h2>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Pindai stiker QR Code fisik yang terpasang pada box hydrant untuk memulai inspeksi.
              </p>
            </div>

            {scanMode ? (
              <div className="space-y-3">
                <QrScanner onResult={handleQrFound} />
                <p className="text-center text-[11px] font-medium text-slate-500">
                  Arahkan kamera ke QR Code di pintu box hydrant
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-emerald-200/70">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                    QR CODE TERVERIFIKASI
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setScanMode(true);
                      setMatchedHydrant(null);
                    }}
                    className="text-xs font-bold text-primary hover:text-primary-700 underline"
                  >
                    Pindai Ulang
                  </button>
                </div>

                {matchedHydrant && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs text-slate-500 font-semibold uppercase">Nomor Box Hydrant</span>
                        <p className="font-black text-xl text-slate-900 tracking-wide">{matchedHydrant.number}</p>
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-white border border-emerald-200 text-emerald-800 shadow-xs">
                        {matchedHydrant.warehouse_name || matchedHydrant.warehouse_id}
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 space-y-1 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Jenis Peralatan:</span>
                        <span className="font-bold text-slate-900">{matchedHydrant.type}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-500">Lokasi Penempatan:</span>
                        <span className="font-bold text-slate-900 text-right">{matchedHydrant.location_name}</span>
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-slate-500">Zona Area:</span>
                        <LocationTag type={matchedHydrant.location_type} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {scanError && (
              <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs font-medium leading-relaxed">
                {scanError}
              </div>
            )}

            {/* Rekap info waktu scan */}
            {matchedHydrant && (
              <div className="text-[11px] text-slate-500 border-t border-slate-100 pt-3 flex items-center justify-between">
                <span>Waktu Scan: <strong>{formatDateTime(new Date())}</strong></span>
                <span>Petugas: <strong>{bundle.user.name}</strong></span>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={!matchedHydrant}
            onClick={() => setStep(2)}
            className="relative w-full h-12 rounded-xl bg-gradient-to-r from-primary to-teal-800 hover:from-primary-700 hover:to-teal-900 active:scale-[0.98] text-white font-bold text-sm tracking-wide shadow-md shadow-primary/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed select-none"
          >
            <span>LANJUT KE FOTO KONDISI</span>
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* LANGKAH 2: FOTO KONDISI */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="card p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 uppercase tracking-wider">
                  LANGKAH 2: FOTO KONDISI HYDRANT
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Foto fisik box hydrant sebelum dilakukan pemeriksaan
                </p>
              </div>
              <span className="text-[11px] font-black text-primary bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full uppercase tracking-wider">
                {photos.length} / 3 FOTO
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-200">
              Wajib minimal <strong>1 foto</strong> (maksimal 3 foto). Setiap foto otomatis dibubuhkan cap identitas waktu, petugas, dan nomor box.
            </p>

            {photos.length < 3 && (
              <CameraCapture
                onCapture={handlePhotoCapture}
                getStampLines={getStampLines}
                disabled={photos.length >= 3}
              />
            )}

            {photos.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Foto yang telah diambil ({photos.length}):
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((p, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-xs"
                    >
                      <img src={p.previewUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                      <span className="absolute bottom-1 left-1 bg-black/60 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                        #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-lg shadow-md hover:bg-red-700 active:scale-90 transition-all"
                        title="Hapus foto ini"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="h-12 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
            >
              <ArrowLeft size={18} />
              <span>KEMBALI</span>
            </button>
            <button
              type="button"
              disabled={photos.length === 0}
              onClick={() => setStep(3)}
              className="h-12 rounded-xl bg-gradient-to-r from-primary to-teal-800 hover:from-primary-700 hover:to-teal-900 active:scale-[0.98] text-white font-bold text-sm tracking-wide shadow-md shadow-primary/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>KE CHECKLIST</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* LANGKAH 3: CHECKLIST & TTD */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="card p-4 sm:p-5 space-y-4 sm:space-y-5">
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900 uppercase tracking-wider">
                LANGKAH 3: LEMBAR CHECKLIST &amp; TTD
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Pilih kondisi setiap komponen. Item "Tidak Baik" otomatis dicatat sebagai temuan K3.
              </p>
            </div>

            {/* Daftar Item Checklist */}
            <div className="space-y-2.5">
              {bundle.items.map((item, idx) => {
                const val = results[item.id] || 'baik';
                const isBaik = val === 'baik';
                const numStr = (idx + 1).toString().padStart(2, '0');

                return (
                  <div
                    key={item.id}
                    className={`p-3 sm:p-3.5 rounded-xl border transition-all ${
                      isBaik
                        ? 'border-slate-200 bg-slate-50/60'
                        : 'border-red-300 bg-red-50/40'
                    }`}
                  >
                    <div className="mb-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-black text-primary">{numStr}.</span>
                        <strong className="text-xs sm:text-sm text-slate-900 font-bold leading-snug">
                          {item.name}
                        </strong>
                      </div>
                      {item.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5 pl-5">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setResults((prev) => ({ ...prev, [item.id]: 'baik' }))}
                        className={`h-10 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                          isBaik
                            ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        ✓ BAIK
                      </button>
                      <button
                        type="button"
                        onClick={() => setResults((prev) => ({ ...prev, [item.id]: 'tidak_baik' }))}
                        className={`h-10 rounded-lg text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 active:scale-[0.98] ${
                          !isBaik
                            ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-600/30'
                            : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        ✕ TIDAK BAIK
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* OPSI FOTO BUKTI TEMUAN KERUSAKAN JIKA TERDAPAT STATUS TIDAK BAIK */}
            {Object.values(results).some((r) => r === 'tidak_baik') && (
              <div className="p-4 rounded-xl border border-red-200 bg-red-50/60 space-y-3">
                <div className="flex items-center gap-2 text-red-950 font-bold text-xs uppercase tracking-wider">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse" />
                  <span>Foto Bukti Kerusakan / Temuan K3</span>
                </div>
                <p className="text-xs text-red-800 leading-relaxed">
                  Karena terdapat item dengan status <strong>"TIDAK BAIK"</strong>, Anda dapat melampirkan foto bukti fokus kerusakan untuk dokumentasi tim K3.
                </p>

                {photos.length < 4 ? (
                  <CameraCapture
                    onCapture={handlePhotoCapture}
                    getStampLines={getStampLines}
                    disabled={photos.length >= 4}
                  />
                ) : (
                  <p className="text-xs text-emerald-800 font-semibold bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                    ✓ Batas maksimal foto ({photos.length} foto) telah terpenuhi.
                  </p>
                )}
              </div>
            )}

            {/* Catatan Pemeriksaan */}
            <div>
              <label htmlFor="notes" className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Catatan Pemeriksaan (Opsional)
              </label>
              <textarea
                id="notes"
                rows={3}
                className="input h-auto py-2.5 text-xs sm:text-sm rounded-xl"
                placeholder="Tuliskan catatan kondisi khusus atau kendala lapangan jika ada..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Tanda Tangan Digital */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Tanda Tangan Digital Petugas
              </label>
              <SignaturePad onChange={setSignatureData} />
            </div>

            {submitError && (
              <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs font-medium leading-relaxed">
                {submitError}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setStep(2)}
              className="h-12 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <ArrowLeft size={18} />
              <span>KEMBALI</span>
            </button>
            <button
              type="button"
              disabled={submitting || !signatureData}
              onClick={handleSaveInspection}
              className="h-12 rounded-xl bg-gradient-to-r from-primary to-teal-800 hover:from-primary-700 hover:to-teal-900 active:scale-[0.98] text-white font-bold text-sm tracking-wide shadow-md shadow-primary/25 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed select-none"
            >
              {submitting ? (
                <span>MENYIMPAN…</span>
              ) : (
                <>
                  <Save size={18} />
                  <span>SIMPAN HASIL</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

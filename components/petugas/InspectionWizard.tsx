'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { QrCode, Trash2, ArrowLeft, ArrowRight, Save, Wifi, WifiOff } from 'lucide-react';
import StepIndicator from '@/components/StepIndicator';
import QrScanner from './QrScanner';
import CameraCapture from './CameraCapture';
import SignaturePad from './SignaturePad';
import { extractQrCode, sha256Hex } from '@/lib/qr';
import { formatDateTime, formatStamp } from '@/lib/period';
import { getBundle, enqueue, refreshBundle } from '@/lib/offline/db';
import { syncQueue } from '@/lib/offline/sync';
import type { CachedHydrant, ChecklistItem, PetugasBundle, CheckResultValue } from '@/lib/types';
import { StatusBadge, LocationTag } from '@/components/ui';

const STEPS = ['Info Hydrant', 'Foto Kondisi', 'Checklist'];

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
    if (photos.length >= 3) return;
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
      const inspectionId = crypto.randomUUID();
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
    <div className="space-y-6">
      {/* Network banner */}
      <div className="flex items-center justify-between text-xs text-slate-500 bg-slate-100 p-2.5 rounded-xl">
        <div className="flex items-center gap-1.5 font-medium">
          {online ? (
            <>
              <Wifi size={14} className="text-emerald-600" />
              <span className="text-emerald-800">Online</span>
            </>
          ) : (
            <>
              <WifiOff size={14} className="text-amber-600" />
              <span className="text-amber-800">Mode Luar Ruang / Offline (Tersimpan Lokal)</span>
            </>
          )}
        </div>
        <span>{bundle.user.name}</span>
      </div>

      <StepIndicator steps={STEPS} current={step} />

      {/* LANGKAH 1: INFO HYDRANT */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900">Langkah 1: Scan QR Code Box Hydrant</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Petugas wajib memindai QR Code fisik yang terpasang pada box hydrant sebelum dapat mengisi pemeriksaan.
            </p>

            {scanMode ? (
              <div className="space-y-3">
                <QrScanner onResult={handleQrFound} />
                <p className="text-center text-xs text-slate-500">
                  Arahkan kamera ke QR Code di pintu box hydrant.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">QR Terverifikasi</span>
                  <button
                    type="button"
                    onClick={() => {
                      setScanMode(true);
                      setMatchedHydrant(null);
                    }}
                    className="text-xs font-semibold text-primary underline"
                  >
                    Scan Ulang
                  </button>
                </div>
                {matchedHydrant && (
                  <div className="pt-2 text-sm text-slate-800 space-y-1">
                    <p className="font-bold text-lg text-slate-900">{matchedHydrant.number} ({matchedHydrant.warehouse_name})</p>
                    <p className="text-slate-600">Jenis: {matchedHydrant.type}</p>
                    <p className="text-slate-600">Lokasi: {matchedHydrant.location_name}</p>
                    <div className="pt-1">
                      <LocationTag type={matchedHydrant.location_type} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {scanError && (
              <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs font-medium">
                {scanError}
              </div>
            )}

            {/* Rekap info otomatis */}
            {matchedHydrant && (
              <div className="text-xs text-slate-500 border-t border-slate-100 pt-3 space-y-1">
                <div>Tanggal: <strong>{formatDateTime(new Date())}</strong></div>
                <div>Petugas Pemeriksa: <strong>{bundle.user.name}</strong></div>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={!matchedHydrant}
            onClick={() => setStep(2)}
            className="btn-primary btn-lg w-full"
          >
            Lanjut ke Foto Kondisi <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* LANGKAH 2: FOTO KONDISI */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="card p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">Langkah 2: Foto Kondisi Sebelum Pemeriksaan</h2>
              <span className="text-xs font-bold text-primary bg-primary-50 px-2.5 py-1 rounded-full">
                {photos.length} / 3 Foto
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Wajib minimal 1 foto (maks. 3 foto). Foto diambil langsung dari kamera dengan cap identitas tanggal, jam, petugas, dan nomor hydrant.
            </p>

            {photos.length < 3 && (
              <CameraCapture
                onCapture={handlePhotoCapture}
                getStampLines={getStampLines}
                disabled={photos.length >= 3}
              />
            )}

            {photos.length > 0 && (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-semibold text-slate-700">Foto yang diambil:</p>
                <div className="grid grid-cols-3 gap-2">
                  {photos.map((p, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                      <img src={p.previewUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removePhoto(idx)}
                        className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-lg shadow-md hover:bg-red-700"
                        title="Hapus foto"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="btn-secondary btn-lg flex-1"
            >
              <ArrowLeft size={18} /> Kembali
            </button>
            <button
              type="button"
              disabled={photos.length === 0}
              onClick={() => setStep(3)}
              className="btn-primary btn-lg flex-1"
            >
              Lanjut ke Checklist <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* LANGKAH 3: CHECKLIST & TTD */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="card p-5 space-y-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Langkah 3: Lembar Checklist & TTD</h2>
              <p className="text-xs text-slate-500 mt-1">
                Pilih kondisi setiap item equipment. Kondisi "Tidak baik" otomatis dicatat sebagai Temuan K3.
              </p>
            </div>

            {/* Daftar Item Checklist */}
            <div className="space-y-3">
              {bundle.items.map((item, idx) => {
                const val = results[item.id] || 'baik';
                return (
                  <div key={item.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5">
                    <div>
                      <span className="text-xs font-bold text-primary mr-1.5">{idx + 1}.</span>
                      <strong className="text-sm text-slate-800">{item.name}</strong>
                      {item.description && (
                        <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setResults((prev) => ({ ...prev, [item.id]: 'baik' }))}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          val === 'baik'
                            ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600'
                            : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        ✓ Baik
                      </button>
                      <button
                        type="button"
                        onClick={() => setResults((prev) => ({ ...prev, [item.id]: 'tidak_baik' }))}
                        className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                          val === 'tidak_baik'
                            ? 'bg-red-600 text-white shadow-sm ring-2 ring-red-600'
                            : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        ✕ Tidak baik
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Catatan Pemeriksaan */}
            <div>
              <label htmlFor="notes" className="label text-xs">Catatan Pemeriksaan</label>
              <textarea
                id="notes"
                rows={3}
                className="input text-xs"
                placeholder="Tuliskan catatan kondisi khusus atau kendala lapangan (opsional)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            {/* Tanda Tangan Digital */}
            <div>
              <label className="label text-xs">Tanda Tangan Digital Petugas</label>
              <SignaturePad onChange={setSignatureData} />
            </div>

            {submitError && (
              <div className="p-3 bg-red-50 text-red-800 border border-red-200 rounded-xl text-xs font-medium">
                {submitError}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setStep(2)}
              className="btn-secondary btn-lg flex-1"
            >
              <ArrowLeft size={18} /> Kembali
            </button>
            <button
              type="button"
              disabled={submitting || !signatureData}
              onClick={handleSaveInspection}
              className="btn-primary btn-lg flex-1"
            >
              {submitting ? (
                'Menyimpan…'
              ) : (
                <>
                  <Save size={18} /> Simpan Pemeriksaan
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

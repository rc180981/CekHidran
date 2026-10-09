'use client';

import { useState, useEffect } from 'react';
import { Download, Share2, MoreVertical, Smartphone, X, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PwaInstallGuide() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [isHttps, setIsHttps] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'android' | 'ios'>('android');

  useEffect(() => {
    // 1. Cek apakah sudah berjalan dalam mode PWA Standalone
    const checkStandalone = () => {
      const isStandaloneMedia = window.matchMedia('(display-mode: standalone)').matches;
      const isIosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      return isStandaloneMedia || isIosStandalone;
    };
    setIsStandalone(checkStandalone());

    // 2. Deteksi iOS
    const ua = window.navigator.userAgent.toLowerCase();
    const isAppleIos = /iphone|ipad|ipod/.test(ua);
    setIsIos(isAppleIos);
    if (isAppleIos) {
      setActiveTab('ios');
    }

    // 3. Deteksi protokol HTTPS vs HTTP
    setIsHttps(window.location.protocol === 'https:' || window.location.hostname === 'localhost');

    // 4. Tangkap event beforeinstallprompt (khusus Chrome Android / Desktop)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  // Jika sudah terpasang dan dibuka sebagai aplikasi mandiri, sembunyikan tombol
  if (isStandalone) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      {/* Tombol Pasang / Panduan Instalasi */}
      <div className="mt-4 flex flex-col items-center">
        {deferredPrompt ? (
          <button
            onClick={handleInstallClick}
            type="button"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-semibold shadow-md shadow-primary/20 hover:bg-primary-dark active:scale-[0.99] transition-all"
          >
            <Download className="w-4 h-4" />
            Pasang Aplikasi di HP (Instal PWA)
          </button>
        ) : (
          <button
            onClick={() => setShowModal(true)}
            type="button"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100/90 hover:bg-slate-200/80 text-slate-700 text-[11px] font-semibold border border-slate-200/80 transition-colors"
          >
            <Smartphone className="w-3.5 h-3.5 text-primary" />
            Cara Pasang Aplikasi di Layar Utama HP
          </button>
        )}
      </div>

      {/* Modal Panduan Instalasi */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header Modal */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Panduan Pasang di HP</h3>
                  <p className="text-[10px] text-slate-500">Jadikan aplikasi seperti app asli tanpa Play Store</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Warning jika masih HTTP non-localhost */}
            {!isHttps && (
              <div className="mx-4 mt-3 p-3 rounded-xl bg-amber-50 border border-amber-200/80 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-[11px] text-amber-800 leading-relaxed">
                  <strong className="font-semibold block text-amber-900">Membuka via HTTP (Jaringan Lokal)</strong>
                  Browser HP (Chrome & Safari) membatasi fitur auto-install jika belum menggunakan <strong>HTTPS</strong>. Ikuti panduan manual di bawah ini:
                </div>
              </div>
            )}

            {/* Tab Platform Selector */}
            <div className="flex p-1 mx-4 mt-3 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('android')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'android'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Android (Chrome)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('ios')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  activeTab === 'ios'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                iPhone / iPad (Safari)
              </button>
            </div>

            {/* Body Panduan */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs text-slate-600">
              {activeTab === 'android' ? (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-xs">
                      1
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Buka di Google Chrome</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Pastikan link web dibuka langsung di aplikasi browser <strong>Chrome</strong> (bukan dari browser dalam WhatsApp).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-xs">
                      2
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                        Klik Menu Titik Tiga <MoreVertical className="w-3.5 h-3.5 inline text-slate-700" />
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Tekan ikon titik tiga di pojok kanan atas layar browser Chrome.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-xs">
                      3
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">
                        Pilih &quot;Instal Aplikasi&quot; atau &quot;Tambahkan ke Layar Utama&quot;
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Konfirmasi pemasangan. Ikon <strong>Cek Hidran</strong> akan otomatis muncul di layar beranda HP Anda!
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-xs">
                      1
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">Buka di Browser Safari</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Apple iOS mewajibkan pemasangan melalui browser bawaan <strong>Safari</strong> (bukan Chrome iOS / in-app browser).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-xs">
                      2
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                        Tekan Tombol Bagikan <Share2 className="w-3.5 h-3.5 inline text-primary" />
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Tekan ikon kotak dengan tanda panah ke atas di bilah menu bagian bawah layar Safari.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="w-6 h-6 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center shrink-0 text-xs">
                      3
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">
                        Pilih &quot;Tambahkan ke Layar Utama&quot; (Add to Home Screen)
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Gulir menu ke bawah, tekan <strong>Tambahkan ke Layar Utama</strong>, lalu klik <strong>Tambah</strong> di pojok kanan atas.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Bisa diakses fullscreen &amp; offline
                </span>
                <span className="font-mono text-[10px] text-slate-400">PWA v1.0</span>
              </div>
            </div>

            {/* Footer Tutup */}
            <div className="p-3 bg-slate-50/80 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-full py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Saya Mengerti
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    // Cegah multi-touch gesture zoom pada browser mobile (iOS Safari / Android)
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        e.preventDefault();
      }
    };
    const handleGestureStart = (e: Event) => {
      e.preventDefault();
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('gesturestart', handleGestureStart, { passive: false });

    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          // Paksa periksa pembaruan Service Worker setiap kali aplikasi dibuka
          reg.update().catch(() => undefined);

          reg.addEventListener('updatefound', () => {
            const installing = reg.installing;
            if (installing) {
              installing.addEventListener('statechange', () => {
                if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                  // Ada update baru yang terpasang, reload otomatis sekali untuk menggunakan kode terbaru
                  console.log('Versi baru Cek Hidran terdeteksi, memuat ulang aset...');
                  window.location.reload();
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn('Gagal mendaftarkan service worker', err);
        });

      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    }

    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('gesturestart', handleGestureStart);
    };
  }, []);

  return null;
}

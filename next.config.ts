import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // pustaka pembuat laporan dijalankan apa adanya di Node (tidak dibundel)
  serverExternalPackages: ['jspdf', 'jspdf-autotable', 'exceljs'],
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        // Service Worker: tidak di-cache
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        // Security Headers untuk seluruh aplikasi
        source: '/(.*)',
        headers: [
          // Cegah MIME type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Cegah clickjacking via iframe embed
          { key: 'X-Frame-Options', value: 'DENY' },
          // Kontrol informasi Referer yang dikirim saat navigasi
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Batasi akses fitur browser yang tidak diperlukan
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
          // Content Security Policy — izinkan Firebase Firestore, Auth, Storage, dan Vercel
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Script: izinkan inline (Next.js) dan domain Google/Firebase
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseapp.com https://*.firebase.com https://*.googleapis.com",
              // Style: izinkan inline (Tailwind) dan Google Fonts
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Font
              "font-src 'self' https://fonts.gstatic.com",
              // Gambar: izinkan blob (foto kamera), data URI, Firebase Storage, Google
              "img-src 'self' blob: data: https://*.supabase.co https://*.googleusercontent.com https://*.firebasestorage.app https://*.googleapis.com",
              // Koneksi: izinkan Firestore, Firebase Realtime/Auth, Google APIs, WebSockets
              "connect-src 'self' https://*.googleapis.com https://firestore.googleapis.com https://*.firebase.com https://*.firebaseapp.com https://*.firebaseio.com wss://*.firebaseio.com https://*.supabase.co wss://*.supabase.co https://*.google-analytics.com https://*.analytics.google.com",
              // Frame: tidak diizinkan untuk iframe luar (cegah clickjacking)
              "frame-ancestors 'none'",
              // Objek (Flash dll): diblokir
              "object-src 'none'",
              // Base URI dibatasi ke origin sendiri
              "base-uri 'self'",
              // Form hanya boleh submit ke origin sendiri
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;

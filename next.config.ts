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
          // Content Security Policy — izinkan Firebase, Supabase, dan Vercel
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Script: izinkan inline (Next.js memerlukan ini) dan domain Firebase
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://*.firebaseapp.com https://*.firebase.com",
              // Style: izinkan inline (Tailwind) dan Google Fonts
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Font
              "font-src 'self' https://fonts.gstatic.com",
              // Gambar: izinkan blob (foto kamera), data URI, Supabase storage, Google
              "img-src 'self' blob: data: https://*.supabase.co https://*.googleusercontent.com",
              // Koneksi: izinkan Supabase, Firebase, Vercel analytics
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.firebase.com https://firebaseinstallations.googleapis.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://*.firestore.googleapis.com",
              // Frame: tidak diizinkan (cegah clickjacking)
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

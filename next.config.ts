import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // pustaka pembuat laporan dijalankan apa adanya di Node (tidak dibundel)
  serverExternalPackages: ['jspdf', 'jspdf-autotable', 'exceljs'],
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;

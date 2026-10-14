import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    app: 'Cek Hidran K3',
    version: '1.2.0',
    build_date: new Date().toISOString(),
    latest_commit: '2ab5b5f',
    features: [
      'Fitur Delete Data Input & Foto untuk Role Admin di Pengaturan',
      'Field Kata Sandi (Password) dan Integrasi Firebase Auth di Kelola Pengguna',
      'Format Stiker QR Code Monokrom Label 10 x 15 cm di Laporan',
    ],
  });
}

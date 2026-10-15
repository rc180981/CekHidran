import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuthInstance, getAdminDbInstance } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminUid, targetUid } = body;

    if (!adminUid || !targetUid) {
      return NextResponse.json(
        { error: 'Data tidak lengkap. ID Admin dan ID Pengguna target wajib disertakan.' },
        { status: 400 }
      );
    }

    // 1. Larang keras menghapus akun admin yang sedang login
    if (adminUid === targetUid) {
      return NextResponse.json(
        {
          error:
            'Tidak dapat menghapus akun Anda sendiri yang sedang aktif digunakan. Silakan gunakan akun Admin lain untuk menghapus akun ini.',
        },
        { status: 400 }
      );
    }

    // 2. Coba hapus via Firebase Admin SDK (menghapus Auth & Dokumen Firestore sekaligus)
    try {
      const adminAuth = getAdminAuthInstance();
      const adminDb = getAdminDbInstance();

      // Verifikasi adminUid adalah admin_sistem aktif
      const adminSnap = await adminDb.collection('profiles').doc(adminUid).get();
      if (!adminSnap.exists || adminSnap.data()?.role !== 'admin_sistem' || !adminSnap.data()?.active) {
        return NextResponse.json(
          { error: 'Akses ditolak. Hanya Admin Sistem aktif yang berhak menghapus pengguna.' },
          { status: 403 }
        );
      }

      // Hapus dokumen profil di Firestore
      await adminDb.collection('profiles').doc(targetUid).delete();

      // Hapus akun dari Firebase Authentication
      try {
        await adminAuth.deleteUser(targetUid);
      } catch (authErr: any) {
        // Jika akun tidak ditemukan di Auth (misal user dummy Firestore), abaikan
        if (authErr.code !== 'auth/user-not-found') {
          console.warn('Gagal menghapus akun Auth via Admin SDK:', authErr);
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Pengguna berhasil dihapus secara permanen dari sistem dan autentikasi.',
      });
    } catch (adminErr: any) {
      console.warn('Firebase Admin SDK tidak tersedia atau gagal:', adminErr.message);

      // Jika service account belum diisi di Vercel, beri tahu client agar menghapus Firestore doc via client SDK
      return NextResponse.json(
        {
          success: false,
          fallbackToClient: true,
          message: 'Admin SDK tidak terhubung. Menjalankan fallback client-side.',
        },
        { status: 200 }
      );
    }
  } catch (err: any) {
    console.error('Unhandled delete user API error:', err);
    return NextResponse.json(
      { error: err?.message || 'Terjadi kesalahan server saat menghapus pengguna.' },
      { status: 500 }
    );
  }
}

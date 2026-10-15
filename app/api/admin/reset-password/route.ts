import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuthInstance } from '@/lib/firebase/admin';
import { db } from '@/lib/firebase/client';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { adminUid, targetUid, newPassword } = body;

    if (!adminUid || !targetUid || !newPassword) {
      return NextResponse.json(
        { error: 'Data tidak lengkap. ID Pengguna dan Kata Sandi baru wajib diisi.' },
        { status: 400 }
      );
    }

    if (typeof newPassword !== 'string' || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'Kata sandi baru minimal harus 6 karakter.' },
        { status: 400 }
      );
    }

    // 1. Verifikasi peran pemanggil adalah Admin Sistem aktif
    const adminDoc = await getDoc(doc(db, 'profiles', adminUid));
    if (!adminDoc.exists() || adminDoc.data().role !== 'admin_sistem' || !adminDoc.data().active) {
      return NextResponse.json(
        { error: 'Akses ditolak. Hanya Admin Sistem yang memiliki wewenang mereset kata sandi.' },
        { status: 403 }
      );
    }

    // 2. Update kata sandi langsung di Firebase Auth menggunakan Admin SDK
    try {
      const adminAuth = getAdminAuthInstance();
      await adminAuth.updateUser(targetUid, {
        password: newPassword,
      });

      // 3. Catat timestamp pembaruan kata sandi di profil Firestore
      try {
        await updateDoc(doc(db, 'profiles', targetUid), {
          password_updated_at: new Date().toISOString(),
          password_updated_by: adminDoc.data().name || 'Admin',
        });
      } catch (errDb) {
        console.warn('Gagal mencatat timestamp password di Firestore:', errDb);
      }

      return NextResponse.json({
        success: true,
        message: 'Kata sandi pengguna berhasil direset langsung tanpa email.',
      });
    } catch (authErr: any) {
      console.error('Firebase Admin updateUser error:', authErr);

      if (
        authErr.message?.includes('default credentials') ||
        authErr.message?.includes('credential') ||
        authErr.code === 'app/no-credential'
      ) {
        return NextResponse.json(
          {
            error:
              'Fitur reset kata sandi langsung memerlukan Service Account Firebase di Vercel (FIREBASE_SERVICE_ACCOUNT_KEY).',
            needsServiceAccount: true,
          },
          { status: 503 }
        );
      }

      if (authErr.code === 'auth/user-not-found') {
        return NextResponse.json(
          { error: 'Pengguna tidak ditemukan di database autentikasi.' },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: authErr.message || 'Gagal mereset kata sandi di server auth.' },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error('Unhandled reset password API error:', err);
    return NextResponse.json(
      { error: 'Terjadi kesalahan internal pada server saat mereset kata sandi.' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, errorResponse, AuthError } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError(401, 'Sesi berakhir, silakan masuk kembali.');

    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json({ error: 'Path foto tidak valid' }, { status: 400 });
    }

    const supabase = await createClient();

    // Dapatkan signed URL sementara untuk bucket privat 'inspeksi' (berlaku 60 detik)
    const { data, error } = await supabase.storage.from('inspeksi').createSignedUrl(path, 60);

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: 'Gagal memuat foto kondisi' }, { status: 404 });
    }

    return NextResponse.redirect(data.signedUrl);
  } catch (e) {
    return errorResponse(e);
  }
}

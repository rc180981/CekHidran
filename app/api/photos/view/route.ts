import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await requireUser();
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
  } catch (err: any) {
    return NextResponse.json({ error: 'Tidak diizinkan' }, { status: 403 });
  }
}

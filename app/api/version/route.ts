import { NextResponse } from 'next/server';
import { getCurrentUser, AuthError, errorResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) throw new AuthError(401, 'Sesi berakhir, silakan masuk kembali.');

    return NextResponse.json({
      app: 'Cek Hidran K3',
      version: '1.2.0',
      build_date: new Date().toISOString(),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

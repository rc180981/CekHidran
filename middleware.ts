import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Route yang memerlukan autentikasi (proteksi sisi server)
const PROTECTED_PREFIXES = ['/dashboard', '/petugas'];

// Route yang TIDAK boleh diakses jika sudah login (akan redirect ke home)
const AUTH_ONLY_ROUTES = ['/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Buat respons yang bisa dimodifikasi
  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Cek sesi Supabase dari cookie server-side
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Cek apakah user memiliki sesi aktif
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtectedRoute = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAuthOnlyRoute = AUTH_ONLY_ROUTES.some((route) => pathname.startsWith(route));

  // Jika mengakses route yang dilindungi tanpa sesi → redirect ke /login
  if (isProtectedRoute && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname); // Simpan halaman tujuan
    return NextResponse.redirect(loginUrl);
  }

  // Jika sudah login tapi mengakses /login → redirect ke /dashboard
  if (isAuthOnlyRoute && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|icons/|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)',
  ],
};

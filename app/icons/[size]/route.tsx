import { ImageResponse } from 'next/og';

export const dynamic = 'force-static';

export function generateStaticParams() {
  return [{ size: '180' }, { size: '192' }, { size: '512' }];
}

// Ikon PNG dibuat saat build (tanpa berkas biner di repo)
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const s = Math.min(Math.max(parseInt(size, 10) || 192, 48), 1024);
  const box = Math.round(s * 0.56);
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'center', background: '#0E7C86',
        }}
      >
        <svg width={box} height={box} viewBox="0 0 64 64">
          <rect x="6" y="4" width="52" height="56" rx="8" fill="#ffffff" />
          <rect x="12" y="10" width="40" height="44" rx="5" fill="#E8F5F6" />
          <circle cx="32" cy="30" r="13" fill="none" stroke="#0E7C86" strokeWidth="5" />
          <circle cx="32" cy="30" r="4" fill="#0E7C86" />
          <rect x="22" y="47" width="20" height="4" rx="2" fill="#D92D20" />
        </svg>
      </div>
    ),
    { width: s, height: s },
  );
}

/** Ambil kode QR dari teks hasil scan: URL ".../petugas/periksa?qr=KODE", "CEKHIDRAN:KODE", atau kode mentah. */
export function extractQrCode(text: string): string {
  const raw = text.trim();
  try {
    const u = new URL(raw);
    const q = u.searchParams.get('qr');
    if (q) return q.trim();
  } catch {
    /* bukan URL */
  }
  if (raw.toUpperCase().startsWith('CEKHIDRAN:')) return raw.slice('CEKHIDRAN:'.length).trim();
  return raw;
}

export function qrUrl(origin: string, code: string): string {
  return `${origin.replace(/\/$/, '')}/petugas/periksa?qr=${encodeURIComponent(code)}`;
}

/** SHA-256 hex (Web Crypto, tersedia di browser & Node 18+) */
export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

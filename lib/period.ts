/** Utilitas tanggal berbasis WIB (Asia/Jakarta, UTC+7, tanpa DST). */
export const TZ = 'Asia/Jakarta';
const OFFSET_MS = 7 * 60 * 60 * 1000;

export type Frequency = 'harian' | 'bulanan';

export const MONTHS_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

function toDate(d: Date | string): Date {
  return typeof d === 'string' ? new Date(d) : d;
}

/** YYYY-MM-DD menurut WIB */
export function jakartaDate(d: Date | string = new Date()): string {
  return new Date(toDate(d).getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** YYYY-MM menurut WIB */
export function jakartaMonth(d: Date | string = new Date()): string {
  return jakartaDate(d).slice(0, 7);
}

export function startOfJakartaDay(date: string): Date {
  return new Date(`${date}T00:00:00+07:00`);
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function isValidMonth(m: string | null | undefined): m is string {
  return !!m && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
}

export function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS_ID[m - 1]} ${y}`;
}

export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  const start = startOfJakartaDay(`${month}-01`);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  const end = startOfJakartaDay(`${next}-01`);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
  return { start, end, days };
}

export function currentPeriod(freq: Frequency, now: Date = new Date()) {
  const today = jakartaDate(now);
  if (freq === 'bulanan') {
    const month = today.slice(0, 7);
    const { start, end } = monthRange(month);
    return { start, end, label: monthLabel(month), short: 'bulan ini' };
  }
  return {
    start: startOfJakartaDay(today),
    end: startOfJakartaDay(addDays(today, 1)),
    label: formatDate(now, 'long'),
    short: 'hari ini',
  };
}

export function formatDate(d: Date | string, style: 'short' | 'long' = 'short'): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TZ,
    day: '2-digit',
    month: style === 'long' ? 'long' : 'short',
    year: 'numeric',
    ...(style === 'long' ? { weekday: 'long' } : {}),
  }).format(toDate(d));
}

export function formatTime(d: Date | string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(toDate(d));
}

export function formatDateTime(d: Date | string): string {
  return `${formatDate(d)} ${formatTime(d)} WIB`;
}

/** Format cap foto: 07/10/2026 17:45:12 WIB */
export function formatStamp(d: Date): string {
  const s = new Intl.DateTimeFormat('id-ID', {
    timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(d);
  return `${s.replace(/\./g, ':')} WIB`;
}

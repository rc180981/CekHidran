import Link from 'next/link';
import type { ReactNode } from 'react';

export type StatusKey =
  | 'baik'
  | 'tidak_baik'
  | 'perhatian'
  | 'belum'
  | 'terbuka'
  | 'dalam_perbaikan'
  | 'selesai';

const STATUS: Record<StatusKey, { label: string; icon: string; cls: string }> = {
  baik: { label: 'Baik', icon: '✓', cls: 'bg-green-100 text-green-800 ring-green-700/25' },
  tidak_baik: { label: 'Tidak baik', icon: '✕', cls: 'bg-red-100 text-red-800 ring-red-700/25' },
  perhatian: { label: 'Perhatian', icon: '!', cls: 'bg-amber-100 text-amber-900 ring-amber-700/25' },
  belum: { label: 'Belum dicek', icon: '–', cls: 'bg-slate-100 text-slate-700 ring-slate-500/25' },
  terbuka: { label: 'Terbuka', icon: '!', cls: 'bg-red-100 text-red-800 ring-red-700/25' },
  dalam_perbaikan: { label: 'Dalam perbaikan', icon: '…', cls: 'bg-amber-100 text-amber-900 ring-amber-700/25' },
  selesai: { label: 'Selesai', icon: '✓', cls: 'bg-green-100 text-green-800 ring-green-700/25' },
};

/** Status selalu berisi ikon + teks, tidak hanya warna. */
export function StatusBadge({ status, label, size = 'md' }: { status: StatusKey; label?: string; size?: 'sm' | 'md' }) {
  const s = STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold ring-1 ring-inset ${s.cls} ${
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <span aria-hidden="true">{s.icon}</span>
      {label ?? s.label}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className = '', title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <h2 className="text-base">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function StatCard({
  label, value, hint, tone = 'primary', icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'primary' | 'green' | 'red' | 'amber' | 'slate';
  icon?: ReactNode;
}) {
  const tones = {
    primary: 'bg-primary-50 text-primary-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <div className="card flex items-start gap-4 p-5">
      {icon && <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>{icon}</div>}
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-600">{label}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  );
}

export function ProgressBar({ value, max, tone = 'primary' }: { value: number; max: number; tone?: 'primary' | 'green' | 'red' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const color = tone === 'green' ? 'bg-green-600' : tone === 'red' ? 'bg-red-600' : 'bg-primary';
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{children}</div>;
}

export function Alert({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success' | 'warning'; children: ReactNode }) {
  const cls = {
    info: 'border-primary-200 bg-primary-50 text-primary-900',
    error: 'border-red-200 bg-red-50 text-red-900',
    success: 'border-green-200 bg-green-50 text-green-900',
    warning: 'border-amber-200 bg-amber-50 text-amber-900',
  }[tone];
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export function LinkButton({ href, children, variant = 'secondary', className = '' }: { href: string; children: ReactNode; variant?: 'primary' | 'secondary' | 'ghost'; className?: string }) {
  return (
    <Link href={href} className={`btn-${variant} ${className}`}>
      {children}
    </Link>
  );
}

export function LocationTag({ type }: { type: 'indoor' | 'outdoor' }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${type === 'indoor' ? 'bg-sky-50 text-sky-800' : 'bg-orange-50 text-orange-800'}`}>
      {type === 'indoor' ? 'Dalam gudang' : 'Luar gudang'}
    </span>
  );
}

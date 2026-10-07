import { Check } from 'lucide-react';

export default function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Langkah pemeriksaan">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li key={label} className="flex flex-1 items-center gap-2" aria-current={active ? 'step' : undefined}>
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span
                className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold ${
                  done ? 'bg-primary text-white' : active ? 'bg-primary text-white ring-4 ring-primary/25' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {done ? <Check size={18} aria-hidden="true" /> : n}
              </span>
              <span className={`truncate text-xs font-semibold ${active ? 'text-primary-800' : 'text-slate-600'}`}>
                {label}
                {done && <span className="sr-only"> (selesai)</span>}
              </span>
            </div>
            {n < steps.length && <span className={`mb-5 h-0.5 w-4 shrink-0 rounded ${done ? 'bg-primary' : 'bg-slate-200'}`} />}
          </li>
        );
      })}
    </ol>
  );
}

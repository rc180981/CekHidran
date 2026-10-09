import { Check } from 'lucide-react';

export default function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center justify-between w-full" aria-label="Langkah pemeriksaan">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <li
            key={label}
            className="flex flex-1 items-center"
            aria-current={active ? 'step' : undefined}
          >
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 px-0.5">
              <span
                className={`grid h-8 w-8 sm:h-9 sm:w-9 place-items-center rounded-full text-xs sm:text-sm font-black transition-all ${
                  done
                    ? 'bg-primary text-white shadow-xs'
                    : active
                    ? 'bg-primary text-white ring-4 ring-primary/20 shadow-xs scale-105'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                {done ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : n}
              </span>
              <span
                className={`text-[10px] sm:text-xs font-bold uppercase tracking-tight text-center leading-tight line-clamp-1 max-w-[90px] sm:max-w-none ${
                  active ? 'text-primary' : done ? 'text-slate-700' : 'text-slate-400'
                }`}
              >
                {label}
                {done && <span className="sr-only"> (selesai)</span>}
              </span>
            </div>
            {n < steps.length && (
              <div
                className={`h-0.5 flex-1 min-w-[12px] -mt-5 rounded-full transition-colors ${
                  done ? 'bg-primary' : 'bg-slate-200'
                }`}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

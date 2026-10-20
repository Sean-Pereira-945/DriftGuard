import type { ReactNode } from 'react';
import { Eyebrow } from './Panel';

type Emphasis = 'default' | 'critical' | 'warning' | 'good';

const VALUE_TONE: Record<Emphasis, string> = {
  default: 'text-ink',
  critical: 'text-coral',
  warning: 'text-amber',
  good: 'text-green',
};

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  detail?: ReactNode;
  emphasis?: Emphasis;
  loading?: boolean;
}

/** One engraved reading: plate label, a large figure, and a plain-language note. */
export function MetricCard({ label, value, unit, detail, emphasis = 'default', loading = false }: MetricCardProps) {
  return (
    <div
      className={`flex min-h-[116px] min-w-0 flex-col justify-between gap-2 rounded-md border bg-panel p-4 ${emphasis === 'critical' ? 'border-coral/50' : 'border-hairline'}`}
    >
      <Eyebrow>{label}</Eyebrow>
      <p className="flex items-baseline gap-1.5">
        {loading ? (
          <span className="h-8 w-20 animate-pulse rounded-sm bg-white/5" aria-label="Loading" />
        ) : (
          <>
            <span className={`tabular font-display text-[40px] leading-none font-semibold ${VALUE_TONE[emphasis]}`}>{value}</span>
            {unit && <span className="text-[13px] text-muted">{unit}</span>}
          </>
        )}
      </p>
      <div className="min-h-[18px] text-[13px] text-muted">{loading ? null : detail}</div>
    </div>
  );
}

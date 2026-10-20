export type GaugeTone = 'ok' | 'warning' | 'critical';

export interface GaugeMark {
  at: number;
  label: string;
}

interface BaselineGaugeProps {
  /** Plain-language reading for assistive technology, for example "0.42, 0.18 below the 0.60 floor". */
  summary: string;
  value: number | null | undefined;
  min?: number;
  max: number;
  /** Engraved ticks: the policy floor or the warning and critical limits. */
  marks: GaugeMark[];
  /** The span past the baseline, hatched so it never depends on colour alone. */
  bad?: { from: number; to: number } | null;
  tone?: GaugeTone;
}

const MARKER: Record<GaugeTone, string> = {
  ok: 'bg-route border-route',
  warning: 'bg-amber border-amber',
  critical: 'bg-coral border-coral',
};

const clampPct = (v: number, min: number, max: number) => Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100));

/**
 * A linear instrument: a track, the baseline engraved on it, and a marker for the reading.
 * Drift is the distance between the marker and the baseline.
 */
export function BaselineGauge({ summary, value, min = 0, max, marks, bad, tone = 'ok' }: BaselineGaugeProps) {
  const hasValue = value !== null && value !== undefined && Number.isFinite(value);
  return (
    <div role="img" aria-label={summary} className="relative mt-1 h-11 w-full select-none">
      <div className="absolute inset-x-0 top-3 h-px bg-hairline-strong" />
      {bad && (
        <div
          className="hatch-bad absolute top-[7px] h-[11px]"
          style={{ left: `${clampPct(bad.from, min, max)}%`, width: `${Math.max(0, clampPct(bad.to, min, max) - clampPct(bad.from, min, max))}%` }}
        />
      )}
      {marks.map((mark) => (
        <div key={mark.label} className="absolute top-0" style={{ left: `${clampPct(mark.at, min, max)}%` }}>
          <div className="mx-auto h-[25px] w-px -translate-x-1/2 bg-body" />
          <span className="absolute top-[27px] -translate-x-1/2 text-xs whitespace-nowrap text-muted tabular">{mark.label}</span>
        </div>
      ))}
      {hasValue && (value as number) > max && (
        <span className="absolute top-[27px] right-0 text-xs font-semibold whitespace-nowrap text-coral">off scale</span>
      )}
      {hasValue && (
        <span
          className={`absolute top-[7px] size-[11px] -translate-x-1/2 rotate-45 border ${MARKER[tone]}`}
          style={{ left: `${clampPct(value as number, min, max)}%` }}
        />
      )}
    </div>
  );
}

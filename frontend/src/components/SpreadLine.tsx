import { BarChart3 } from 'lucide-react';
import { fmtPercent, fmtScore } from '../lib/format';
import type { Spread } from '../types';

/**
 * The spread behind an average: the median, the weak end, and the share of events past the
 * floor. A mean can hide a split (half near 1.0, half near 0.6), and these show it.
 * It stays silent below `minSample` readings, where percentiles are just noise.
 */
export function SpreadLine({
  spread,
  minSample,
  tail,
  belowFloorRate,
}: {
  spread: Spread | undefined;
  minSample: number;
  /** `low` for scores where low is bad, `high` for risk where high is bad. */
  tail: 'low' | 'high';
  /** Share of events that broke the floor, 0 to 1. Omit for readings without a floor. */
  belowFloorRate?: number | null;
}) {
  if (!spread || spread.n < minSample || spread.median === null) return null;
  const edge = tail === 'low' ? spread.p10 : spread.p90;
  return (
    <span className="mt-1 flex items-start gap-1.5 text-sm text-muted">
      <BarChart3 aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>
        Median {fmtScore(spread.median)}.
        {edge !== null && ` The ${tail === 'low' ? 'lowest' : 'highest'} 10% are ${fmtScore(edge)} or ${tail === 'low' ? 'below' : 'above'}.`}
        {belowFloorRate !== undefined && belowFloorRate !== null && ` ${fmtPercent(belowFloorRate, 0)} of events are under the floor.`}
      </span>
    </span>
  );
}

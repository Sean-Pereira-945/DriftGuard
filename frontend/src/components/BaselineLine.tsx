import { Info, Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { fmtScore } from '../lib/format';
import { shiftPhrase, windowPhrase } from '../lib/baseline';
import type { Baseline, BaselineMetric } from '../types';

/** Below this many events on either side, a real small change is often missed (see research/BASELINE_STUDY.md). */
const THIN_SAMPLE = 30;

/**
 * One line that says how a reading compares with the period before it, and refuses to
 * say anything when there are too few events to know. Always an icon plus words.
 */
export function BaselineLine({ metric, baseline, total }: { metric: BaselineMetric | undefined; baseline: Baseline; total: number }) {
  const base = 'mt-1 flex items-start gap-1.5 text-sm';
  if (!baseline.available) {
    if (total > 0 && total < baseline.min_sample) {
      return (
        <span className={`${base} text-muted`}>
          <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          Only {total} {total === 1 ? 'event' : 'events'}: too few to trust this average.
        </span>
      );
    }
    return null;
  }
  if (!metric || (metric.n_current === 0 && metric.n_baseline === 0)) return null;

  if (metric.status === 'insufficient') {
    return (
      <span className={`${base} text-muted`}>
        <Info aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        Too few events to compare: {metric.n_current} now, {metric.n_baseline} before. Needs {baseline.min_sample} on each side.
      </span>
    );
  }
  const counts = `${metric.n_current} events now, ${metric.n_baseline} before`;
  if (metric.status === 'steady') {
    // "No clear change" is not "no change": with few events a real drop is often missed.
    const thin = Math.min(metric.n_current, metric.n_baseline) < THIN_SAMPLE;
    return (
      <span className={`${base} text-muted`}>
        <Minus aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        <span>
          No clear change against {windowPhrase(baseline.window_seconds)}: was {fmtScore(metric.baseline)} ({counts}).
          {thin && ' With this few events, a small drop could be missed.'}
        </span>
      </span>
    );
  }
  const Icon = (metric.delta ?? 0) < 0 ? TrendingDown : TrendingUp;
  const worse = metric.status === 'worse';
  return (
    <span className={`${base} ${worse ? 'font-semibold text-amber' : 'text-body'}`}>
      <Icon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
      <span>
        {worse ? 'Worse' : 'Better'}: {shiftPhrase(metric, baseline)} ({counts}).
      </span>
    </span>
  );
}

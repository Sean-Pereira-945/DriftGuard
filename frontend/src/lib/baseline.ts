import type { Baseline, BaselineMetric } from '../types';
import { fmtScore } from './format';

export type BaselineKey = 'retrieval_score' | 'response_quality' | 'risk_score';

export const BASELINE_LABEL: Record<BaselineKey, string> = {
  retrieval_score: 'Retrieval score',
  response_quality: 'Response quality',
  risk_score: 'Mean risk score',
};

/** "the 24 hours before" or "the 7 days before": the period the window is compared with. */
export function windowPhrase(seconds: number | undefined): string {
  const hours = Math.round((seconds ?? 86400) / 3600);
  if (hours < 48) return `the ${hours} hours before`;
  return `the ${Math.round(hours / 24)} days before`;
}

/** One sentence about a meaningful shift, such as "0.23 lower than the 24 hours before". */
export function shiftPhrase(metric: BaselineMetric, baseline: Baseline): string | null {
  if (metric.delta === null) return null;
  const direction = metric.delta < 0 ? 'lower' : 'higher';
  return `${fmtScore(Math.abs(metric.delta))} ${direction} than ${windowPhrase(baseline.window_seconds)}`;
}

/** The metrics that got meaningfully worse, as full sentences. Empty when none did. */
export function worseSentences(baseline: Baseline | undefined): string[] {
  if (!baseline?.available) return [];
  const out: string[] = [];
  for (const key of Object.keys(BASELINE_LABEL) as BaselineKey[]) {
    const metric = baseline.metrics[key];
    if (metric?.status !== 'worse') continue;
    const phrase = shiftPhrase(metric, baseline);
    if (phrase) out.push(`${BASELINE_LABEL[key]} is ${phrase}.`);
  }
  return out;
}

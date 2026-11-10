import { describe, expect, it } from 'vitest';
import type { Summary } from '../types';
import { reportedScores } from './reported';

interface Counts {
  total?: number;
  retrievalNow?: number;
  retrievalBefore?: number;
  qualityNow?: number;
  qualityBefore?: number;
}

function summary(counts: Counts): Summary {
  const spread = (n: number) => ({ n, median: null, p10: null, p90: null });
  const metric = (n_baseline: number) => ({
    current: null,
    baseline: null,
    n_current: 0,
    n_baseline,
    delta: null,
    z: null,
    status: 'insufficient' as const,
  });
  return {
    total_events: counts.total ?? 10,
    spread: {
      retrieval_score: spread(counts.retrievalNow ?? 0),
      response_quality: spread(counts.qualityNow ?? 0),
      risk_score: spread(10),
    },
    baseline: {
      available: true,
      reason: null,
      min_sample: 10,
      metrics: {
        retrieval_score: metric(counts.retrievalBefore ?? 0),
        response_quality: metric(counts.qualityBefore ?? 0),
      },
    },
  } as unknown as Summary;
}

describe('reportedScores', () => {
  it('assumes both scores with no summary or no events', () => {
    expect(reportedScores(undefined)).toEqual({ retrieval: true, quality: true });
    expect(reportedScores(summary({ total: 0 }))).toEqual({ retrieval: true, quality: true });
  });

  it('drops a score that no event in the window or before carried', () => {
    expect(reportedScores(summary({ qualityNow: 3 }))).toEqual({ retrieval: false, quality: true });
  });

  it('keeps a score seen only in the period before, so a quiet spell does not hide it', () => {
    expect(reportedScores(summary({ retrievalBefore: 4, qualityNow: 1 }))).toEqual({ retrieval: true, quality: true });
  });
});

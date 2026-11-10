import { describe, expect, it } from 'vitest';
import type { Baseline, BaselineMetric } from '../types';
import { shiftPhrase, windowPhrase, worseSentences } from './baseline';

const metric = (overrides: Partial<BaselineMetric>): BaselineMetric => ({
  current: 0.6,
  baseline: 0.8,
  n_current: 40,
  n_baseline: 40,
  delta: -0.2,
  z: -4,
  status: 'worse',
  ...overrides,
});

const baseline = (metrics: Baseline['metrics'], window_seconds = 86400): Baseline => ({
  available: true,
  reason: null,
  window_seconds,
  min_sample: 10,
  metrics,
});

describe('windowPhrase', () => {
  it('says hours under two days and days after', () => {
    expect(windowPhrase(undefined)).toBe('the 24 hours before');
    expect(windowPhrase(900)).toBe('the 0 hours before');
    expect(windowPhrase(7 * 86400)).toBe('the 7 days before');
  });
});

describe('shiftPhrase', () => {
  it('describes the size and direction of a shift', () => {
    const b = baseline({});
    expect(shiftPhrase(metric({ delta: -0.23 }), b)).toBe('0.23 lower than the 24 hours before');
    expect(shiftPhrase(metric({ delta: 0.1 }), b)).toBe('0.10 higher than the 24 hours before');
    expect(shiftPhrase(metric({ delta: null }), b)).toBeNull();
  });
});

describe('worseSentences', () => {
  it('lists only the metrics that got worse', () => {
    const b = baseline({
      retrieval_score: metric({ status: 'worse', delta: -0.2 }),
      response_quality: metric({ status: 'steady', delta: -0.01 }),
      risk_score: metric({ status: 'worse', delta: 0.15 }),
    });
    expect(worseSentences(b)).toEqual([
      'Retrieval score is 0.20 lower than the 24 hours before.',
      'Mean risk score is 0.15 higher than the 24 hours before.',
    ]);
  });

  it('is empty when the comparison is unavailable', () => {
    expect(worseSentences(undefined)).toEqual([]);
    expect(worseSentences({ ...baseline({ retrieval_score: metric({}) }), available: false })).toEqual([]);
  });
});

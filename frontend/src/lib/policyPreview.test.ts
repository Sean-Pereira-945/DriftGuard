import { describe, expect, it } from 'vitest';
import type { AgentTask, TelemetryEvent } from '../types';
import { flagged } from './policyPreview';

const event = (overrides: Partial<TelemetryEvent>): TelemetryEvent =>
  ({ prompt_tokens: 1000, context_length: 2000, retrieval_score: 0.8, response_quality: 0.9, latency_ms: 1000, ...overrides }) as TelemetryEvent;
const task = (consecutive_failures: number): AgentTask => ({ consecutive_failures }) as AgentTask;

const events = [
  event({ prompt_tokens: 500, retrieval_score: 0.9 }),
  event({ prompt_tokens: 4500, retrieval_score: 0.4 }),
  event({ prompt_tokens: 9000, retrieval_score: null, response_quality: null }),
];
const tasks = [task(0), task(2), task(3), task(5)];

describe('flagged', () => {
  it('counts events over a token limit', () => {
    expect(flagged('prompt_token_limit', 4000, events, tasks)).toEqual({ count: 2, of: 3, noun: 'events' });
    expect(flagged('context_length_limit', 2000, events, tasks)).toEqual({ count: 0, of: 3, noun: 'events' });
  });

  it('counts only the events that carry a score, so the denominator stays honest', () => {
    expect(flagged('retrieval_score_floor', 0.7, events, tasks)).toEqual({ count: 1, of: 2, noun: 'events' });
    expect(flagged('response_quality_floor', 0.95, events, tasks)).toEqual({ count: 2, of: 2, noun: 'events' });
  });

  it('reports 0 of 0 when no event carries the reading', () => {
    const noScores = [event({ retrieval_score: null }), event({ retrieval_score: null })];
    expect(flagged('retrieval_score_floor', 0.5, noScores, [])).toEqual({ count: 0, of: 0, noun: 'events' });
  });

  it('never flags at a floor of 0', () => {
    expect(flagged('retrieval_score_floor', 0, events, tasks)?.count).toBe(0);
  });

  it('counts tasks at or over the block threshold', () => {
    expect(flagged('blocked_after_failures', 3, events, tasks)).toEqual({ count: 2, of: 4, noun: 'tasks' });
    expect(flagged('blocked_after_failures', 1, events, tasks)?.count).toBe(3);
  });

  it('counts events slower than the latency limit, only those that report latency', () => {
    const evs = [event({ latency_ms: 500 }), event({ latency_ms: 20000 }), event({ latency_ms: null })];
    expect(flagged('latency_limit_ms', 10000, evs, [])).toEqual({ count: 1, of: 2, noun: 'events' });
  });

  it('has no preview for the retry window', () => {
    expect(flagged('retry_window_minutes', 10, events, tasks)).toBeNull();
  });
});

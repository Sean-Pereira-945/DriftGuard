import type { AgentTask, PolicyField, TelemetryEvent } from '../types';

export interface Flagged {
  /** Events or tasks the rule would flag at this value. */
  count: number;
  /** Events that carry the reading (or all tasks), so "8 of 25" is honest about coverage. */
  of: number;
  noun: 'events' | 'tasks';
}

/**
 * How many of the loaded events or tasks a rule would flag at a given value. An event that does
 * not carry the reading (a source that sends no retrieval score, or only some turns with a
 * quality score) is not counted in either number, so "54 of 417" never hides that only a few
 * events had the reading. Returns null for fields that flag nothing (the retry window).
 */
export function flagged(key: PolicyField, value: number, events: TelemetryEvent[], tasks: AgentTask[]): Flagged | null {
  const reading = (pick: (e: TelemetryEvent) => number | null, test: (v: number) => boolean): Flagged => {
    const values = events.map(pick).filter((v): v is number => v !== null);
    return { count: values.filter(test).length, of: values.length, noun: 'events' };
  };
  switch (key) {
    case 'prompt_token_limit':
      return reading((e) => e.prompt_tokens, (v) => v > value);
    case 'context_length_limit':
      return reading((e) => e.context_length, (v) => v > value);
    case 'retrieval_score_floor':
      return reading((e) => e.retrieval_score, (v) => v < value);
    case 'response_quality_floor':
      return reading((e) => e.response_quality, (v) => v < value);
    case 'blocked_after_failures':
      return { count: tasks.filter((t) => t.consecutive_failures >= value).length, of: tasks.length, noun: 'tasks' };
    default:
      return null;
  }
}

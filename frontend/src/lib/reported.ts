import type { Summary } from '../types';

export interface ReportedScores {
  retrieval: boolean;
  quality: boolean;
}

/**
 * Whether this source sends each score. A source that never reports one (Claude Code has no
 * retrieval step) would otherwise leave an empty cell on every screen, so the screens leave
 * it out. A score counts as reported if it appears in this window or in the period before,
 * so a quiet few minutes doesn't make it vanish. With no events at all we can't tell, so we
 * assume it is reported and let the normal empty states speak.
 */
export function reportedScores(summary: Summary | undefined): ReportedScores {
  if (!summary || summary.total_events === 0) return { retrieval: true, quality: true };
  const seen = (key: 'retrieval_score' | 'response_quality') =>
    summary.spread[key].n > 0 || (summary.baseline.metrics[key]?.n_baseline ?? 0) > 0;
  return { retrieval: seen('retrieval_score'), quality: seen('response_quality') };
}

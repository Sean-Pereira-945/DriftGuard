import { fmtDuration, parseTime } from '../lib/format';
import type { AgentEvent } from '../types';

const MAX_ROWS = 40;

interface Row {
  event: AgentEvent;
  start: number;
  end: number;
}

const FAILED = new Set(['failed', 'failure', 'error', 'timeout']);
const SUCCEEDED = new Set(['success', 'succeeded', 'ok', 'completed']);

function barClass(status: string): string {
  if (FAILED.has(status)) return 'bg-coral';
  if (SUCCEEDED.has(status)) return 'bg-route';
  return 'bg-faint';
}

/**
 * When each attempt ran. One row per tool call, on a shared time axis. A bar ends when the
 * attempt was recorded and runs back by its duration, so a retry loop shows as a bunch of
 * red bars with the gaps between them. The list below it is the text version of the same data.
 */
export function Waterfall({ events }: { events: AgentEvent[] }) {
  const all: Row[] = [];
  for (const event of events) {
    const end = parseTime(event.created_at)?.getTime();
    if (end === undefined) continue;
    all.push({ event, end, start: end - (event.duration_ms ?? 0) });
  }
  if (all.length === 0) return null;

  const rows = all.slice(-MAX_ROWS);
  const t0 = Math.min(...rows.map((r) => r.start));
  const t1 = Math.max(...rows.map((r) => r.end));
  const span = Math.max(t1 - t0, 1000);
  const pct = (t: number) => ((t - t0) / span) * 100;
  const failed = rows.filter((r) => FAILED.has(r.event.status)).length;
  const hasDurations = rows.some((r) => (r.event.duration_ms ?? 0) > 0);
  const summary = `${rows.length} attempts over ${fmtDuration(t1 - t0)}, ${failed} failed.`;

  return (
    <figure className="mb-5">
      <div role="img" aria-label={summary} className="space-y-1">
        {rows.map(({ event, start, end }) => {
          const left = pct(start);
          const width = Math.max(pct(end) - left, 0.8);
          return (
            <div key={event.id} className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2">
              <span className="truncate font-mono text-xs text-muted" title={`${event.tool_name}, attempt ${event.attempt}`}>
                {event.tool_name} #{event.attempt}
              </span>
              <span className="relative block h-4 rounded-sm bg-white/[0.04]">
                <span
                  className={`absolute top-0.5 h-3 rounded-sm ${barClass(event.status)}`}
                  style={{ left: `${Math.min(left, 99.2)}%`, width: `${Math.min(width, 100 - Math.min(left, 99.2))}%` }}
                  title={`${event.tool_name}, attempt ${event.attempt}: ${event.status}, ${fmtDuration(event.duration_ms)}`}
                />
              </span>
            </div>
          );
        })}
        <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2" aria-hidden>
          <span />
          <span className="flex justify-between border-t border-hairline-strong pt-1 font-mono text-xs text-muted">
            <span>0</span>
            <span>+{fmtDuration((t1 - t0) / 2)}</span>
            <span>+{fmtDuration(t1 - t0)}</span>
          </span>
        </div>
      </div>
      <figcaption className="mt-2 text-xs text-muted">
        {summary} Red bars are failed attempts.
        {!hasDurations && ' No durations were recorded, so each attempt is a thin mark at the time it was recorded.'}
        {all.length > MAX_ROWS && ` Showing the latest ${MAX_ROWS} of ${all.length}.`}
      </figcaption>
    </figure>
  );
}

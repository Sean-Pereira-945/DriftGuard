import { CartesianGrid, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtAxisTime, fmtCompact, fmtDateTime, fmtInt, fmtScore } from '../lib/format';
import { AXIS_PROPS, ChartLegend, COLORS, GRID_PROPS, timeDomain, TooltipCard, tooltipTime } from './common';
import type { EventPoint } from './points';

interface Props {
  points: EventPoint[];
  promptTokenLimit?: number;
  retrievalFloor?: number;
  qualityFloor?: number;
  /** Set false when the source never reports a score, so its line and floor are left out. */
  showRetrieval?: boolean;
  showQuality?: boolean;
}

/**
 * Prompt tokens (left axis) with retrieval and quality scores (fixed 0–1, right axis).
 * The right axis is a fixed score domain, not a rescaled second measure.
 * The policy limit and floors are drawn as dashed baselines; the span under the lower
 * floor is hatched so a breach reads as distance from the baseline.
 */
export function TimelineChart({
  points,
  promptTokenLimit,
  retrievalFloor: retrievalFloorIn,
  qualityFloor: qualityFloorIn,
  showRetrieval = true,
  showQuality = true,
}: Props) {
  const retrievalFloor = showRetrieval ? retrievalFloorIn : undefined;
  const qualityFloor = showQuality ? qualityFloorIn : undefined;
  const showScores = showRetrieval || showQuality;
  // A score that only some events carry (one per checked turn) gets a dot on each reading.
  const retrievalCount = points.filter((p) => p.retrieval_score !== null).length;
  const qualityCount = points.filter((p) => p.response_quality !== null).length;
  // When most events carry no value (a score sent once per checked turn), joining the few readings
  // with a line draws slopes that mean nothing. Show them as dots instead.
  const retrievalSparse = retrievalCount < points.length / 2;
  const qualitySparse = qualityCount < points.length / 2;
  const [start, end] = timeDomain(points);
  const span = end - start;
  const showDots = points.length <= 40;
  const lowestFloor = Math.min(retrievalFloor ?? Infinity, qualityFloor ?? Infinity);
  const recent = points.slice(-12).reverse();

  return (
    <div>
      <ChartLegend
        items={[
          { label: 'Prompt tokens (left)', color: COLORS.route },
          ...(showRetrieval ? [{ label: 'Retrieval score (right)', color: COLORS.steel }] : []),
          ...(showQuality
            ? [
                qualitySparse
                  ? { label: 'Response quality, one dot per checked turn (right)', color: COLORS.steel, shape: 'dot' as const }
                  : { label: 'Response quality (right)', color: COLORS.steel, dashed: true },
              ]
            : []),
          ...(promptTokenLimit ? [{ label: 'Prompt token limit', color: COLORS.muted, dashed: true }] : []),
          ...(Number.isFinite(lowestFloor) ? [{ label: 'Hatched: below both score floors', color: COLORS.coral, shape: 'square' as const }] : []),
        ]}
      />
      <div className="h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <pattern id="floor-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke={COLORS.coral} strokeWidth="1.5" strokeOpacity="0.25" />
              </pattern>
            </defs>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis
              {...AXIS_PROPS}
              dataKey="t"
              type="number"
              scale="time"
              domain={[start, end]}
              tickFormatter={(value: number) => fmtAxisTime(value, span)}
              minTickGap={48}
            />
            <YAxis
              {...AXIS_PROPS}
              yAxisId="tokens"
              width={48}
              tickFormatter={(value: number) => fmtCompact(value)}
              label={{ value: 'tokens', angle: -90, position: 'insideLeft', fill: COLORS.axis, fontSize: 12, dy: 20 }}
            />
            {showScores && (
              <YAxis
                {...AXIS_PROPS}
                yAxisId="score"
                orientation="right"
                domain={[0, 1]}
                ticks={[0, 0.25, 0.5, 0.75, 1]}
                width={40}
                tickFormatter={(value: number) => value.toFixed(2)}
              />
            )}
            {Number.isFinite(lowestFloor) && (
              <ReferenceArea yAxisId="score" y1={0} y2={lowestFloor} fill="url(#floor-hatch)" stroke="none" ifOverflow="hidden" />
            )}
            {retrievalFloor !== undefined && (
              <ReferenceLine yAxisId="score" y={retrievalFloor} stroke={COLORS.steel} strokeDasharray="2 4" strokeOpacity={0.9} />
            )}
            {qualityFloor !== undefined && (
              <ReferenceLine yAxisId="score" y={qualityFloor} stroke={COLORS.steel} strokeDasharray="2 4" strokeOpacity={0.9} />
            )}
            {promptTokenLimit !== undefined && (
              <ReferenceLine yAxisId="tokens" y={promptTokenLimit} stroke={COLORS.muted} strokeDasharray="4 4" strokeOpacity={0.9} ifOverflow="extendDomain" />
            )}
            <Tooltip
              cursor={{ stroke: '#4b6e60', strokeWidth: 1 }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const point = active ? (payload?.[0]?.payload as EventPoint | undefined) : undefined;
                if (!point) return null;
                return (
                  <TooltipCard
                    title={tooltipTime(point.t)}
                    rows={[
                      { key: 'p', label: 'Prompt tokens', value: fmtInt(point.prompt_tokens), color: COLORS.route },
                      { key: 'r', label: 'Retrieval', value: fmtScore(point.retrieval_score), color: COLORS.steel },
                      { key: 'q', label: 'Quality', value: fmtScore(point.response_quality), color: COLORS.steel, dashed: true },
                    ]}
                    footer={`Event #${point.id} · ${point.severity ?? 'unscored'}`}
                  />
                );
              }}
            />
            <Line
              yAxisId="tokens"
              type="monotone"
              dataKey="prompt_tokens"
              name="Prompt tokens"
              stroke={COLORS.route}
              strokeWidth={2}
              dot={showDots ? { r: 2.5, strokeWidth: 0, fill: COLORS.route } : false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: '#080d0b' }}
              isAnimationActive={false}
            />
            {showRetrieval && (
              <Line
                yAxisId="score"
                type="monotone"
                dataKey="retrieval_score"
                name="Retrieval score"
                stroke={COLORS.steel}
                strokeWidth={retrievalSparse ? 0 : 2}
                connectNulls={!retrievalSparse}
                dot={retrievalSparse || retrievalCount <= 40 ? { r: 3, strokeWidth: 0, fill: COLORS.steel } : false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#080d0b' }}
                isAnimationActive={false}
              />
            )}
            {showQuality && (
              <Line
                yAxisId="score"
                type="monotone"
                dataKey="response_quality"
                name="Response quality"
                stroke={COLORS.steel}
                strokeWidth={qualitySparse ? 0 : 2}
                strokeDasharray="5 4"
                connectNulls={!qualitySparse}
                dot={qualitySparse || qualityCount <= 40 ? { r: 3, strokeWidth: 0, fill: COLORS.steel } : false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: '#080d0b' }}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <details className="group mt-3">
        <summary className="inline-flex min-h-9 cursor-pointer list-none items-center text-sm font-semibold text-muted select-none hover:text-ink [&::-webkit-details-marker]:hidden">
          View the latest {recent.length} readings as a table
        </summary>
        <div className="mt-2 overflow-x-auto" role="region" aria-label="Latest telemetry readings" tabIndex={0}>
          <table className="w-full min-w-[480px] border-collapse text-left text-sm">
            <caption className="sr-only">Latest telemetry readings, newest first</caption>
            <thead>
              <tr className="text-muted">
                <th scope="col" className="plate-label h-9 pr-4">Time</th>
                <th scope="col" className="plate-label h-9 pr-4 text-right">Prompt tokens</th>
                <th scope="col" className="plate-label h-9 pr-4 text-right">Retrieval</th>
                <th scope="col" className="plate-label h-9 text-right">Quality</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((point) => (
                <tr key={point.id} className="border-t border-hairline">
                  <td className="h-9 pr-4 font-mono text-muted">{fmtDateTime(new Date(point.t).toISOString())}</td>
                  <td className="tabular pr-4 text-right font-mono">{fmtInt(point.prompt_tokens)}</td>
                  <td className="tabular pr-4 text-right font-mono">{fmtScore(point.retrieval_score)}</td>
                  <td className="tabular text-right font-mono">{fmtScore(point.response_quality)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

import { ArrowRight, ChevronRight } from 'lucide-react';
import { api } from '../api';
import { TimelineChart } from '../charts/TimelineChart';
import { RiskBreakdown } from '../charts/RiskBreakdown';
import { toPoints } from '../charts/points';
import { AlertRow } from '../components/AlertRow';
import { BaselineGauge } from '../components/BaselineGauge';
import { Button } from '../components/Button';
import { Lamp, worst, type LampState } from '../components/Lamp';
import { Instrument, InstrumentStrip } from '../components/Instrument';
import { PageHeader, Panel } from '../components/Panel';
import { EmptyState, ErrorState, ResourceView } from '../components/States';
import { TrackDiagram } from '../components/TrackDiagram';
import { fmtCompact, fmtDateTime, fmtDuration, fmtInt, fmtPercent, fmtRelative, fmtScore, TIME_RANGE_LABELS } from '../lib/format';
import type { ViewId } from '../lib/route';
import { useProjectQuery } from '../state/queries';
import { useProject, useWorkspace } from '../state/workspace';
import type { AgentDiagnosis, Summary } from '../types';

// Server-side risk thresholds (driftguard/policy.py): warning ≥ 0.4, critical ≥ 0.75.
const WARNING_RISK = 0.4;
const CRITICAL_RISK = 0.75;

const STATE_WORD: Record<LampState, string> = { critical: 'Critical', warning: 'Warning', stable: 'Stable', idle: 'No data' };

const below = (value: number | null | undefined, limit: number | undefined) =>
  value !== null && value !== undefined && limit !== undefined && value < limit;

const TONE_TEXT = { ok: 'text-ink', warning: 'text-amber', critical: 'text-coral' } as const;

function OverviewInstruments({ summary, loading }: { summary: Summary | undefined; loading: boolean }) {
  if (loading || !summary) {
    return (
      <Panel bodyClassName="p-5">
        <div className="h-28 animate-pulse rounded-sm bg-white/5" aria-label="Loading readings" />
      </Panel>
    );
  }

  const avg = summary.averages;
  const policy = summary.policy;
  const activity = summary.agent_activity;
  const hasTelemetry = summary.total_events > 0;

  const risk = avg.risk_score ?? null;
  const riskTone = risk === null ? 'ok' : risk >= CRITICAL_RISK ? 'critical' : risk >= WARNING_RISK ? 'warning' : 'ok';

  const quality = avg.response_quality ?? null;
  const qualityFloor = policy.response_quality_floor;
  const qualityBelow = below(quality, qualityFloor);

  const rate = activity && activity.events > 0 ? activity.failure_rate : null;
  const rateTone = rate === null ? 'ok' : rate >= 0.25 ? 'critical' : rate >= 0.1 ? 'warning' : 'ok';

  return (
    <InstrumentStrip label="Instruments">
      <Instrument
        label="Open alerts"
        figure={fmtInt(summary.open_alerts)}
        figureTone={summary.critical_alerts > 0 ? 'text-coral' : summary.warning_alerts > 0 ? 'text-amber' : 'text-ink'}
      >
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-body">
          <span className="inline-flex items-center gap-1.5">
            <Lamp state="critical" size="sm" />
            {fmtInt(summary.critical_alerts)} critical
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Lamp state="warning" size="sm" />
            {fmtInt(summary.warning_alerts)} warning
          </span>
        </p>
      </Instrument>
      <Instrument
        label="Mean risk score"
        figure={fmtScore(risk)}
        figureTone={TONE_TEXT[riskTone]}
        note={risk === null ? 'No scored events in this window' : 'Warning from 0.40, critical from 0.75'}
      >
        <BaselineGauge
          summary={risk === null ? 'Mean risk score: no reading.' : `Mean risk score ${fmtScore(risk)}. Warning from 0.40, critical from 0.75.`}
          value={risk}
          max={1}
          marks={[
            { at: WARNING_RISK, label: '0.40' },
            { at: CRITICAL_RISK, label: '0.75' },
          ]}
          bad={{ from: CRITICAL_RISK, to: 1 }}
          tone={riskTone}
        />
      </Instrument>
      <Instrument
        label="Response quality"
        figure={fmtScore(quality)}
        figureTone={qualityBelow ? 'text-amber' : 'text-ink'}
        note={
          hasTelemetry && quality === null
            ? 'Not reported by this source'
            : quality !== null
              ? qualityBelow
                ? `${fmtScore(qualityFloor - quality)} below the floor`
                : `${fmtScore(quality - qualityFloor)} above the floor`
              : 'No scored events in this window'
        }
      >
        <BaselineGauge
          summary={
            quality === null
              ? 'Mean response quality: no reading.'
              : `Mean response quality ${fmtScore(quality)} against a floor of ${fmtScore(qualityFloor)}.`
          }
          value={quality}
          max={1}
          marks={[{ at: qualityFloor, label: `floor ${fmtScore(qualityFloor)}` }]}
          bad={{ from: 0, to: qualityFloor }}
          tone={qualityBelow ? 'warning' : 'ok'}
        />
      </Instrument>
      <Instrument
        label="Tool failure rate"
        figure={rate === null ? '—' : fmtPercent(rate, 1)}
        figureTone={TONE_TEXT[rateTone]}
        note={rate === null ? 'No agent activity in this window' : `${fmtInt(activity.failed_tool_calls)} of ${fmtInt(activity.tool_calls)} tool calls failed`}
      >
        <BaselineGauge
          summary={
            rate === null
              ? 'Tool failure rate: no reading.'
              : `Tool failure rate ${fmtPercent(rate, 1)}. Warning from 10 percent, critical from 25 percent.`
          }
          value={rate}
          max={0.5}
          marks={[
            { at: 0.1, label: '10%' },
            { at: 0.25, label: '25%' },
          ]}
          bad={{ from: 0.25, to: 0.5 }}
          tone={rateTone}
        />
      </Instrument>
    </InstrumentStrip>
  );
}

/** Everything the strip leaves out, one click away. */
function AllReadings({ summary }: { summary: Summary }) {
  const a = summary.agent_activity;
  const avg = summary.averages;
  const p = summary.policy;
  const rows: [string, string, string][] = [
    [
      'Total events',
      fmtInt(summary.total_events),
      summary.total_events > 0
        ? `${fmtInt(summary.events_by_severity.critical ?? 0)} critical · ${fmtInt(summary.events_by_severity.warning ?? 0)} warning`
        : 'No telemetry in this window',
    ],
    ['Tokens at stake', fmtInt(summary.saved_tokens), 'Across open alerts'],
    [
      'Mean retrieval score',
      fmtScore(avg.retrieval_score),
      summary.total_events > 0 && avg.retrieval_score == null ? 'Not reported by this source' : `Floor ${fmtScore(p.retrieval_score_floor)}`,
    ],
  ];
  if (a && a.events > 0) {
    rows.push(
      ['Tool calls', fmtInt(a.tool_calls), `${fmtInt(a.failed_tool_calls)} failed`],
      ['Tasks', fmtInt(a.tasks), `${fmtInt(a.turns)} completed`],
      ['Tokens used', fmtCompact(a.total_tokens), 'New input + output, by agent tasks'],
      ['Avg tool duration', fmtDuration(a.avg_tool_duration_ms), 'Call to result'],
      ['Agent events', fmtInt(a.events), a.last_activity ? `Last ${fmtRelative(a.last_activity)}` : 'In this window'],
    );
  }
  return (
    <details className="group rounded-md border border-hairline bg-panel">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-4 text-sm font-semibold text-body select-none hover:text-ink sm:px-5 [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="size-4 transition-transform duration-150 group-open:rotate-90" />
        All readings
        <span className="font-normal text-muted">({rows.length})</span>
      </summary>
      <dl className="grid gap-px border-t border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
        {rows.map(([label, value, note]) => (
          <div key={label} className="bg-panel p-4">
            <dt className="plate-label text-muted">{label}</dt>
            <dd className="tabular mt-1 font-display text-[30px] leading-none font-semibold text-ink">{value}</dd>
            <dd className="mt-1 text-sm text-muted">{note}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

/** The status plate: one lamp, one verdict, the diagnosis, and the track of the most urgent task. */
function StatusPlate({
  summary,
  diagnosis,
  onNavigate,
}: {
  summary: Summary | undefined;
  diagnosis: AgentDiagnosis | undefined;
  onNavigate: (view: ViewId) => void;
}) {
  const driftState: LampState = summary && summary.total_events > 0 ? summary.status : 'idle';
  const agentState: LampState = diagnosis && diagnosis.task_count > 0 ? diagnosis.status : 'idle';
  const state = worst(driftState, agentState);
  const agentUrgent = diagnosis !== undefined && diagnosis.task_count > 0 && diagnosis.status !== 'stable';
  const driftUrgent = summary !== undefined && summary.total_events > 0 && summary.status !== 'stable';
  const topCause = summary?.top_root_causes[0]?.root_cause;
  const tasks = diagnosis?.tasks ?? [];
  const lead = tasks[0];

  let headline: string;
  let advice: string | null = null;
  let action: { label: string; view: ViewId } | null = null;
  if (agentUrgent && diagnosis) {
    headline = diagnosis.diagnosis;
    advice = diagnosis.recommendation;
    action = { label: 'Open Agent Diagnosis', view: 'agents' };
  } else if (driftUrgent && summary) {
    headline = `${fmtInt(summary.events_by_severity.critical ?? 0)} critical and ${fmtInt(summary.events_by_severity.warning ?? 0)} warning events in this window.${topCause ? ` Most frequent cause: ${topCause}.` : ''}`;
    advice = 'Open Events to see the recommended mitigation for each scored event.';
    action = { label: 'Open Events', view: 'events' };
  } else if (state === 'stable') {
    headline = 'No blocked tasks and no drift beyond policy in this window.';
  } else {
    headline = 'No telemetry or agent events in this window yet.';
    advice = 'Send data with the SDK or the Claude Code hook, or widen the time range.';
    action = { label: 'How to send data', view: 'sdk' };
  }

  return (
    <section aria-labelledby="overview-status" className="animate-rise rounded-md border border-hairline bg-panel">
      <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center lg:gap-8">
        <div className="flex items-center gap-4">
          <Lamp state={state} size="lg" />
          <div>
            <h2 id="overview-status" className="font-display text-[44px] leading-none font-bold">
              {STATE_WORD[state]}
            </h2>
          </div>
        </div>
        <div className="min-w-0 space-y-1.5">
          <p className={`max-w-[75ch] text-lg leading-snug ${state === 'critical' || state === 'warning' ? 'text-ink' : 'text-body'}`}>
            {headline}
          </p>
          {advice && (
            <p className="max-w-[75ch] text-[15px] text-muted">
              {agentUrgent && <span className="font-semibold text-body">Recommendation: </span>}
              {advice}
            </p>
          )}
          {agentUrgent && diagnosis && (
            <dl className="flex flex-wrap gap-x-6 gap-y-1 pt-1 text-sm text-muted">
              <div className="flex gap-1.5">
                <dt>Blocking tool</dt>
                <dd className="font-mono text-body">{diagnosis.blocking_tool ?? '—'}</dd>
              </div>
              <div className="flex gap-1.5">
                <dt>Wasted tokens (all tasks)</dt>
                <dd className={`tabular font-mono ${diagnosis.wasted_tokens > 0 ? 'text-coral' : 'text-body'}`}>
                  {fmtInt(diagnosis.wasted_tokens)}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt>Blocked / failing tasks</dt>
                <dd className="tabular font-mono text-body">
                  {diagnosis.blocked_tasks} / {diagnosis.failing_tasks}
                </dd>
              </div>
            </dl>
          )}
        </div>
        {action && (
          <Button
            variant={state === 'critical' ? 'primary' : 'secondary'}
            onClick={() => onNavigate(action.view)}
            icon={<ArrowRight aria-hidden className="size-4" />}
          >
            {action.label}
          </Button>
        )}
      </div>
      {lead && (
        <div className="border-t border-hairline p-4 sm:p-5">
          <TrackDiagram task={lead} />
          {tasks.length > 1 && (
            <p className="mt-3 text-sm text-muted">
              {tasks.length - 1} more {tasks.length - 1 === 1 ? 'task' : 'tasks'} in this window.{' '}
              <button type="button" onClick={() => onNavigate('agents')} className="font-semibold text-route hover:underline">
                See all tasks
              </button>
            </p>
          )}
        </div>
      )}
    </section>
  );
}

export function Overview({ onNavigate }: { onNavigate: (view: ViewId) => void }) {
  const project = useProject();
  const { summary, filters } = useWorkspace();
  const diagnosis = useProjectQuery('diagnosis', (id, f, signal) => api.agentDiagnosis(id, f, signal), { watchAlerts: true });
  const events = useProjectQuery('events-500', (id, f, signal) => api.listEvents(id, f, { limit: 500 }, signal));
  const alerts = useProjectQuery('open-alerts-5', (id, f, signal) => api.listAlerts(id, f, { resolved: false, limit: 5 }, signal), {
    watchAlerts: true,
  });

  const s = summary.data;

  return (
    <>
      <PageHeader
        title="Operational Overview"
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              {project.name} · <span className="font-mono">{project.project_id}</span> · {TIME_RANGE_LABELS[filters.timeRange]}
              {filters.environment !== 'all' && ` · ${filters.environment}`}
            </span>
            {s?.last_updated && (
              <span className="text-sm" title={fmtDateTime(s.last_updated)}>
                Last activity {fmtRelative(s.last_updated)}
              </span>
            )}
          </span>
        }
      />

      <div className="space-y-6">
        {summary.error && !s ? (
          <Panel>
            <ErrorState message={summary.error} onRetry={summary.reload} />
          </Panel>
        ) : (
          <>
            <StatusPlate summary={s} diagnosis={diagnosis.data} onNavigate={onNavigate} />
            <OverviewInstruments summary={s} loading={!s && summary.loading} />
            {s && <AllReadings summary={s} />}
          </>
        )}

        <div className="grid items-start gap-6 xl:grid-cols-3">
          <Panel
            title="Telemetry & Drift Timeline"
            description="Latest 500 events in the window, oldest to newest. Dashed lines are the policy floors and limit."
            className="xl:col-span-2"
          >
            <ResourceView
              resource={events}
              isEmpty={(data) => data.length === 0}
              empty={
                <EmptyState title="No telemetry yet">
                  Send events with the SDK (<span className="font-mono">capture_metrics</span> +{' '}
                  <span className="font-mono">sync_metrics</span>) or use Test Telemetry in the header.
                </EmptyState>
              }
            >
              {(data) => (
                <TimelineChart
                  points={toPoints(data)}
                  promptTokenLimit={s?.policy.prompt_token_limit}
                  retrievalFloor={s?.policy.retrieval_score_floor}
                  qualityFloor={s?.policy.response_quality_floor}
                />
              )}
            </ResourceView>
          </Panel>

          <Panel title="Drift Risk Breakdown" description="Share of events violating each policy rule.">
            <ResourceView
              resource={summary}
              isEmpty={(data) => data.total_events === 0}
              empty={<EmptyState title="No telemetry in this window">Rates appear once events are scored.</EmptyState>}
            >
              {(data) => <RiskBreakdown rates={data.violation_rates} policy={data.policy} />}
            </ResourceView>
          </Panel>
        </div>

        <div className="grid items-start gap-6 xl:grid-cols-3">
          <Panel title="Top Root Causes" description="Most frequent causes among warning and critical events.">
            <ResourceView
              resource={summary}
              isEmpty={(data) => data.top_root_causes.length === 0}
              empty={<EmptyState title="No drift detected">No warning or critical events in this window.</EmptyState>}
            >
              {(data) => {
                const max = Math.max(...data.top_root_causes.map((c) => c.count));
                return (
                  <ol className="space-y-3">
                    {data.top_root_causes.map((cause) => (
                      <li key={cause.root_cause}>
                        <div className="mb-1 flex items-start justify-between gap-3 text-sm">
                          <span className="text-body">{cause.root_cause}</span>
                          <span className="tabular shrink-0 font-mono text-muted">{fmtInt(cause.count)}</span>
                        </div>
                        <div className="h-1.5 rounded-sm bg-white/[0.05]" aria-hidden>
                          <div className="h-full rounded-sm bg-route/70" style={{ width: `${(cause.count / max) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ol>
                );
              }}
            </ResourceView>
          </Panel>

          <Panel
            title="Open Alerts"
            description="Latest open alerts."
            className="xl:col-span-2"
            bodyClassName=""
            actions={
              <Button size="sm" variant="ghost" onClick={() => onNavigate('alerts')} icon={<ArrowRight aria-hidden className="size-3.5" />}>
                All alerts
              </Button>
            }
          >
            <ResourceView
              resource={alerts}
              isEmpty={(data) => data.length === 0}
              empty={<EmptyState title="No open alerts">Critical drift and blocked agent tasks raise alerts here.</EmptyState>}
            >
              {(data) => (
                <ul>
                  {data.map((alert) => (
                    <AlertRow key={alert.id} alert={alert} />
                  ))}
                </ul>
              )}
            </ResourceView>
          </Panel>
        </div>
      </div>
    </>
  );
}

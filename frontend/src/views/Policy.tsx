import { RotateCcw, Save } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { api, errorMessage } from '../api';
import { Button } from '../components/Button';
import { TextField } from '../components/Field';
import { PageHeader, Panel } from '../components/Panel';
import { ResourceView } from '../components/States';
import { useToast } from '../components/Toasts';
import { fmtInt, TIME_RANGE_LABELS } from '../lib/format';
import { useResource } from '../lib/useResource';
import { parseNumber } from '../lib/validation';
import { useProjectQuery } from '../state/queries';
import { useProject, useWorkspace } from '../state/workspace';
import type { AgentTask, Policy as PolicyType, PolicyField, TelemetryEvent } from '../types';

interface FieldSpec {
  key: PolicyField;
  label: string;
  help: string;
  step: number;
  min?: number;
  max?: number;
  validate: (value: number) => string | null;
}

const FIELDS: { group: string; description: string; fields: FieldSpec[] }[] = [
  {
    group: 'Drift thresholds',
    description: 'Each telemetry event is scored against these rules. Changes apply to new events and to summary violation rates.',
    fields: [
      {
        key: 'prompt_token_limit',
        label: 'Prompt token limit',
        help: 'Events with more prompt tokens than this count as prompt context inflation. A lower limit flags more events. Must be greater than 0.',
        step: 100,
        min: 0,
        validate: (v) => (v > 0 ? null : 'Must be greater than 0.'),
      },
      {
        key: 'context_length_limit',
        label: 'Context length limit',
        help: 'Events whose assembled context is longer than this are flagged. A lower limit flags more events. Must be greater than 0.',
        step: 100,
        min: 0,
        validate: (v) => (v > 0 ? null : 'Must be greater than 0.'),
      },
      {
        key: 'retrieval_score_floor',
        label: 'Retrieval score floor',
        help: 'A retrieval score below this is flagged as retrieval degradation. A lower floor flags fewer events, and 0 never flags. Between 0 and 1.',
        step: 0.05,
        min: 0,
        max: 1,
        validate: (v) => (v >= 0 && v <= 1 ? null : 'Must be between 0 and 1.'),
      },
      {
        key: 'response_quality_floor',
        label: 'Response quality floor',
        help: 'A response quality below this is flagged as quality degradation. A lower floor flags fewer events, and 0 never flags. Between 0 and 1.',
        step: 0.05,
        min: 0,
        max: 1,
        validate: (v) => (v >= 0 && v <= 1 ? null : 'Must be between 0 and 1.'),
      },
    ],
  },
  {
    group: 'Agent diagnosis',
    description: 'How failed tool attempts turn into blocked tasks and agent alerts.',
    fields: [
      {
        key: 'blocked_after_failures',
        label: 'Blocked after failures',
        help: 'Consecutive failures of the same tool before a task is marked blocked and an alert is raised. At 1, every failed call raises an alert. Whole number, 1–100.',
        step: 1,
        min: 1,
        max: 100,
        validate: (v) => (Number.isInteger(v) && v >= 1 && v <= 100 ? null : 'Whole number between 1 and 100.'),
      },
      {
        key: 'retry_window_minutes',
        label: 'Retry window (minutes)',
        help: 'Failures further apart than this start a new run, so a slow retry loop is not counted as one block. 0–10080 (one week); 0 turns the window off.',
        step: 5,
        min: 0,
        max: 10080,
        validate: (v) => (v >= 0 && v <= 10080 ? null : 'Must be between 0 and 10080.'),
      },
    ],
  },
];

const ALL_FIELDS = FIELDS.flatMap((g) => g.fields);
const LABEL = Object.fromEntries(ALL_FIELDS.map((f) => [f.key, f.label])) as Record<PolicyField, string>;

type Draft = Record<PolicyField, string>;

function toDraft(policy: PolicyType): Draft {
  return Object.fromEntries(ALL_FIELDS.map((f) => [f.key, String(policy[f.key])])) as Draft;
}

/** How many of the loaded events or tasks a rule would flag at a given value. */
function flagged(key: PolicyField, value: number, events: TelemetryEvent[], tasks: AgentTask[]): { count: number; of: number; noun: string } | null {
  switch (key) {
    case 'prompt_token_limit':
      return { count: events.filter((e) => e.prompt_tokens !== null && e.prompt_tokens > value).length, of: events.length, noun: 'events' };
    case 'context_length_limit':
      return { count: events.filter((e) => e.context_length !== null && e.context_length > value).length, of: events.length, noun: 'events' };
    case 'retrieval_score_floor':
      return { count: events.filter((e) => e.retrieval_score !== null && e.retrieval_score < value).length, of: events.length, noun: 'events' };
    case 'response_quality_floor':
      return { count: events.filter((e) => e.response_quality !== null && e.response_quality < value).length, of: events.length, noun: 'events' };
    case 'blocked_after_failures':
      return { count: tasks.filter((t) => t.consecutive_failures >= value).length, of: tasks.length, noun: 'tasks' };
    default:
      return null;
  }
}

interface Preview {
  events: TelemetryEvent[] | null;
  tasks: AgentTask[] | null;
}

function PolicyForm({ policy, preview, onSaved }: { policy: PolicyType; preview: Preview; onSaved: (policy: PolicyType) => void }) {
  const project = useProject();
  const { refreshAll, filters } = useWorkspace();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(() => toDraft(policy));
  const [touched, setTouched] = useState<Partial<Record<PolicyField, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  // Reset the form only when the stored values change, so a background refresh keeps edits.
  const policyKey = JSON.stringify(policy);
  useEffect(() => {
    setDraft(toDraft(policy));
    setTouched({});
    setSubmitted(false);
  }, [policyKey]);

  const parsed = useMemo(() => {
    const out = {} as Record<PolicyField, { value: number | null; error: string | null }>;
    for (const field of ALL_FIELDS) {
      const value = parseNumber(draft[field.key]);
      let error: string | null = null;
      if (value === null || Number.isNaN(value)) error = 'Enter a number.';
      else error = field.validate(value);
      out[field.key] = { value: error ? null : value, error };
    }
    return out;
  }, [draft]);

  const shownError = (key: PolicyField) => (touched[key] || submitted ? parsed[key].error : null);
  const changes = ALL_FIELDS.filter((f) => parsed[f.key].value !== null && parsed[f.key].value !== policy[f.key]);
  const dirty = ALL_FIELDS.some((f) => parseNumber(draft[f.key]) !== policy[f.key]);

  // Coverage after the change, from the events and tasks already loaded.
  const coverage = changes
    .map((f) => {
      const before = preview.events && preview.tasks ? flagged(f.key, policy[f.key], preview.events, preview.tasks) : null;
      const after = preview.events && preview.tasks ? flagged(f.key, parsed[f.key].value as number, preview.events, preview.tasks) : null;
      return before && after ? { field: f, before, after } : null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null);
  const lowers = coverage.filter((c) => c.after.count < c.before.count);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setStatus(null);
    setSubmitted(true);
    if (ALL_FIELDS.some((f) => parsed[f.key].error)) {
      setStatus({ tone: 'error', text: 'Fix the highlighted fields.' });
      return;
    }
    const body: Partial<PolicyType> = {};
    for (const field of changes) body[field.key] = parsed[field.key].value as number;
    if (!Object.keys(body).length) {
      setStatus({ tone: 'success', text: 'No changes to save.' });
      return;
    }
    setBusy(true);
    try {
      const saved = await api.updatePolicy(project.project_id, body);
      onSaved(saved);
      refreshAll();
      setStatus({ tone: 'success', text: 'Policy saved.' });
      toast.push({ tone: 'success', title: 'Policy saved', message: 'New events are scored with the updated thresholds.' });
    } catch (error) {
      setStatus({ tone: 'error', text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const previewLine = (key: PolicyField): ReactNode => {
    if (!preview.events || !preview.tasks) return null;
    const value = parsed[key].value;
    const now = flagged(key, policy[key], preview.events, preview.tasks);
    if (!now) return null;
    const next = value !== null ? flagged(key, value, preview.events, preview.tasks) : null;
    const changed = next !== null && value !== policy[key];
    return (
      <span className="mt-1.5 block text-[13px] text-body">
        {changed && next ? (
          <>
            Would flag{' '}
            <span className={`tabular font-mono font-semibold ${next.count < now.count ? 'text-amber' : 'text-ink'}`}>
              {fmtInt(next.count)} of {fmtInt(next.of)}
            </span>{' '}
            loaded {now.noun}, now{' '}
            <span className="tabular font-mono">{fmtInt(now.count)}</span>.
          </>
        ) : (
          <>
            Flags <span className="tabular font-mono font-semibold text-ink">{fmtInt(now.count)} of {fmtInt(now.of)}</span> loaded {now.noun} ({TIME_RANGE_LABELS[filters.timeRange]}).
          </>
        )}
      </span>
    );
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      {FIELDS.map((group) => (
        <Panel key={group.group} title={group.group} description={group.description}>
          <div className="grid gap-6 md:grid-cols-2">
            {group.fields.map((field) => (
              <TextField
                key={field.key}
                label={field.label}
                type="number"
                inputMode="decimal"
                step={field.step}
                min={field.min}
                max={field.max}
                value={draft[field.key]}
                onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                onBlur={() => setTouched((t) => ({ ...t, [field.key]: true }))}
                error={shownError(field.key)}
                help={
                  <>
                    {field.help}
                    {previewLine(field.key)}
                  </>
                }
              />
            ))}
          </div>
        </Panel>
      ))}

      <div className="sticky bottom-0 -mx-4 space-y-2 border-t border-hairline bg-canvas/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-md sm:border">
        {changes.length > 0 && (
          <div aria-live="polite" className="space-y-1 text-sm">
            <p className="text-body">
              <span className="font-semibold text-ink">
                {changes.length} {changes.length === 1 ? 'threshold' : 'thresholds'} changing:
              </span>{' '}
              {changes.map((f, i) => (
                <span key={f.key}>
                  {i > 0 && ', '}
                  {LABEL[f.key]} <span className="tabular font-mono">{policy[f.key]}</span> to{' '}
                  <span className="tabular font-mono text-ink">{parsed[f.key].value}</span>
                </span>
              ))}
              .
            </p>
            {lowers.length > 0 && (
              <p className="font-semibold text-amber">
                Lowers coverage:{' '}
                {lowers.map((c, i) => (
                  <span key={c.field.key}>
                    {i > 0 && ', '}
                    {fmtInt(c.before.count - c.after.count)} fewer {c.after.noun} flagged ({LABEL[c.field.key].toLowerCase()})
                  </span>
                ))}
                .
              </p>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" busy={busy} disabled={!dirty && !busy} icon={<Save aria-hidden className="size-4" />}>
            Save policy
          </Button>
          <Button
            onClick={() => {
              setDraft(toDraft(policy));
              setTouched({});
              setSubmitted(false);
              setStatus(null);
            }}
            disabled={!dirty || busy}
            icon={<RotateCcw aria-hidden className="size-4" />}
          >
            Reset
          </Button>
          <span aria-live="polite" className={`text-sm ${status?.tone === 'error' ? 'text-coral' : 'text-green'}`}>
            {status?.text ?? (dirty ? <span className="text-amber">Unsaved changes</span> : '')}
          </span>
        </div>
      </div>
    </form>
  );
}

export function Policy() {
  const project = useProject();
  const { refreshKey } = useWorkspace();
  const [saved, setSaved] = useState<PolicyType | null>(null);
  const policy = useResource<PolicyType>((signal) => api.getPolicy(project.project_id, signal), `policy|${project.project_id}`, refreshKey);
  const events = useProjectQuery('policy-events-500', (id, f, signal) => api.listEvents(id, f, { limit: 500 }, signal));
  const diagnosis = useProjectQuery('policy-diagnosis', (id, f, signal) => api.agentDiagnosis(id, f, signal));

  useEffect(() => setSaved(null), [project.project_id, policy.data]);

  return (
    <>
      <PageHeader
        title="Policy"
        description="Thresholds that score telemetry and decide when an agent task is blocked. Each field shows what it flags in the data already loaded for the current filters. Reset discards unsaved edits."
      />
      <ResourceView resource={policy} loadingLabel="Loading policy…">
        {(data) => <PolicyForm policy={saved ?? data} preview={{ events: events.data ?? null, tasks: diagnosis.data?.tasks ?? null }} onSaved={setSaved} />}
      </ResourceView>
    </>
  );
}

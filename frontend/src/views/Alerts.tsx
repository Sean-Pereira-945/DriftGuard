import { CheckCircle2, Plus, RotateCcw, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { api, errorMessage } from '../api';
import { AlertRow } from '../components/AlertRow';
import { Button } from '../components/Button';
import { SelectField, TextAreaField } from '../components/Field';
import { PageHeader, Panel } from '../components/Panel';
import { EmptyState, ResourceView } from '../components/States';
import { useToast } from '../components/Toasts';
import { useProjectQuery } from '../state/queries';
import { useProject, useWorkspace } from '../state/workspace';
import type { Alert, Severity } from '../types';

type Tab = 'open' | 'resolved' | 'all';

const TABS: { id: Tab; label: string; title: string }[] = [
  { id: 'open', label: 'Open', title: 'Open alerts' },
  { id: 'resolved', label: 'Resolved', title: 'Resolved alerts' },
  { id: 'all', label: 'All', title: 'All alerts' },
];

const SEVERITY_OPTIONS = [
  { value: 'all', label: 'All severities' },
  { value: 'critical', label: 'Critical' },
  { value: 'warning', label: 'Warning' },
  { value: 'stable', label: 'Stable' },
];

function NewAlertForm({ onDone }: { onDone: () => void }) {
  const project = useProject();
  const { alertsChanged } = useWorkspace();
  const toast = useToast();
  const [severity, setSeverity] = useState<Severity>('warning');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const text = message.trim();
    if (!text) {
      setError('Enter a message.');
      return;
    }
    if (text.length > 2000) {
      setError('Use 2,000 characters or fewer.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api.createAlert(project.project_id, { severity, message: text });
      setMessage('');
      alertsChanged();
      toast.push({ tone: 'success', title: 'Alert created' });
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel title="New alert" description="Record a manual alert for this project.">
      <form onSubmit={onSubmit} noValidate className="grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <SelectField
          label="Severity"
          value={severity}
          onChange={(e) => setSeverity(e.target.value as Severity)}
          options={SEVERITY_OPTIONS.slice(1)}
        />
        <TextAreaField
          label="Message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          error={error}
          maxLength={2000}
          rows={3}
          placeholder="What needs attention?"
          autoFocus
        />
        <div className="flex gap-2 md:col-start-2">
          <Button type="submit" variant="primary" busy={busy} icon={<Plus aria-hidden className="size-4" />}>
            Create alert
          </Button>
          <Button onClick={onDone} disabled={busy}>
            Cancel
          </Button>
        </div>
      </form>
    </Panel>
  );
}

export function Alerts() {
  const project = useProject();
  const { alertsChanged } = useWorkspace();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('open');
  const [severity, setSeverity] = useState<Severity | 'all'>('all');
  const [pending, setPending] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const selectAll = useRef<HTMLInputElement>(null);

  const alerts = useProjectQuery(
    'alerts',
    (id, f, signal) =>
      api.listAlerts(
        id,
        f,
        { resolved: tab === 'all' ? undefined : tab === 'resolved', severity: severity === 'all' ? undefined : severity, limit: 500 },
        signal,
      ),
    { key: `${tab}|${severity}`, watchAlerts: true },
  );

  // A selection belongs to the list it was made in.
  useEffect(() => setSelected(new Set()), [tab, severity, project.project_id]);

  const rows = alerts.data ?? [];
  const chosen = rows.filter((alert) => selected.has(alert.id));
  const toResolve = chosen.filter((alert) => !alert.resolved);
  const toReopen = chosen.filter((alert) => alert.resolved);
  const allSelected = rows.length > 0 && chosen.length === rows.length;

  useEffect(() => {
    if (selectAll.current) selectAll.current.indeterminate = chosen.length > 0 && !allSelected;
  }, [chosen.length, allSelected]);

  const toggle = async (alert: Alert) => {
    setPending(alert.id);
    try {
      await api.setAlertResolved(project.project_id, alert.id, !alert.resolved);
      alertsChanged();
    } catch (error) {
      toast.push({ tone: 'error', title: alert.resolved ? 'Couldn’t reopen alert' : 'Couldn’t resolve alert', message: errorMessage(error) });
    } finally {
      setPending(null);
    }
  };

  const bulk = async (targets: Alert[], resolved: boolean) => {
    setBulkBusy(true);
    const results = await Promise.allSettled(targets.map((alert) => api.setAlertResolved(project.project_id, alert.id, resolved)));
    const failed = results.filter((r) => r.status === 'rejected');
    const done = results.length - failed.length;
    alertsChanged();
    setSelected(new Set());
    setBulkBusy(false);
    const verb = resolved ? 'resolved' : 'reopened';
    if (failed.length === 0) {
      toast.push({ tone: 'success', title: `${done} ${done === 1 ? 'alert' : 'alerts'} ${verb}` });
    } else {
      const first = failed[0] as PromiseRejectedResult;
      toast.push({
        tone: 'error',
        title: `${failed.length} of ${results.length} could not be ${verb}`,
        message: errorMessage(first.reason),
      });
    }
  };

  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = TABS.findIndex((t) => t.id === tab);
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = TABS.length - 1;
    else return;
    event.preventDefault();
    setTab(TABS[next].id);
    document.getElementById(`alert-tab-${TABS[next].id}`)?.focus();
  };

  const current = TABS.find((t) => t.id === tab)!;

  return (
    <>
      <PageHeader
        title="Alerts"
        description="Raised by critical drift, blocked agent tasks, or created manually. Newest first."
        actions={
          !composing && (
            <Button onClick={() => setComposing(true)} icon={<Plus aria-hidden className="size-4" />}>
              New alert
            </Button>
          )
        }
      />
      <div className="space-y-6">
        {composing && <NewAlertForm onDone={() => setComposing(false)} />}
        <Panel
          bodyClassName=""
          title={current.title}
          actions={
            <>
              <div
                role="tablist"
                aria-label="Alert status"
                onKeyDown={onTabKey}
                className="flex rounded-sm border border-hairline-strong bg-input p-0.5"
              >
                {TABS.map((item) => (
                  <button
                    key={item.id}
                    id={`alert-tab-${item.id}`}
                    type="button"
                    role="tab"
                    aria-selected={tab === item.id}
                    aria-controls="alert-tabpanel"
                    tabIndex={tab === item.id ? 0 : -1}
                    onClick={() => setTab(item.id)}
                    className={`min-h-8 rounded-sm px-3 text-sm font-semibold transition-colors duration-150 ${tab === item.id ? 'bg-raised text-ink shadow-[inset_0_-2px_0_#ece4c6]' : 'text-muted hover:text-body'}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <SelectField
                label="Severity"
                hideLabel
                value={severity}
                onChange={(e) => setSeverity(e.target.value as Severity | 'all')}
                options={SEVERITY_OPTIONS}
                className="w-40"
              />
            </>
          }
        >
          {rows.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-hairline bg-input px-4 py-2">
              <label className="flex items-center gap-2 text-sm text-body">
                <input
                  ref={selectAll}
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => setSelected(e.target.checked ? new Set(rows.map((a) => a.id)) : new Set())}
                  className="size-4"
                />
                Select all {rows.length}
              </label>
              <span aria-live="polite" className="text-sm text-muted">
                {chosen.length > 0 ? `${chosen.length} selected` : ''}
              </span>
              {toResolve.length > 0 && (
                <Button size="sm" variant="primary" busy={bulkBusy} onClick={() => void bulk(toResolve, true)} icon={<CheckCircle2 aria-hidden className="size-3.5" />}>
                  Resolve {toResolve.length}
                </Button>
              )}
              {toReopen.length > 0 && (
                <Button size="sm" busy={bulkBusy} onClick={() => void bulk(toReopen, false)} icon={<RotateCcw aria-hidden className="size-3.5" />}>
                  Reopen {toReopen.length}
                </Button>
              )}
              {chosen.length > 0 && (
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())} icon={<X aria-hidden className="size-3.5" />}>
                  Clear
                </Button>
              )}
            </div>
          )}
          <div role="tabpanel" id="alert-tabpanel" aria-labelledby={`alert-tab-${tab}`}>
            <ResourceView
              resource={alerts}
              isEmpty={(data) => data.length === 0}
              empty={
                <EmptyState title={tab === 'open' ? 'No open alerts' : tab === 'resolved' ? 'No resolved alerts' : 'No alerts'}>
                  Alerts in the selected time range and environment appear here.
                </EmptyState>
              }
            >
              {(data) => (
                <>
                  <ul>
                    {data.map((alert) => (
                      <AlertRow
                        key={alert.id}
                        alert={alert}
                        onToggle={toggle}
                        busy={pending === alert.id || bulkBusy}
                        selected={selected.has(alert.id)}
                        onSelect={(a, on) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (on) next.add(a.id);
                            else next.delete(a.id);
                            return next;
                          })
                        }
                      />
                    ))}
                  </ul>
                  {data.length >= 500 && <p className="border-t border-hairline px-4 py-2 text-sm text-muted">Showing the latest 500 alerts.</p>}
                </>
              )}
            </ResourceView>
          </div>
        </Panel>
      </div>
    </>
  );
}

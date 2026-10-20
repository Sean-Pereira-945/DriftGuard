import { CheckCircle2, RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { fmtDateTime, fmtInt, fmtRelative } from '../lib/format';
import type { Alert } from '../types';
import { SeverityBadge, SourceBadge } from './Badges';
import { Button } from './Button';
import { Lamp } from './Lamp';

interface AlertRowProps {
  alert: Alert;
  onToggle?: (alert: Alert) => void;
  busy?: boolean;
  extra?: ReactNode;
  /** When set, the row shows a checkbox for bulk actions. */
  selected?: boolean;
  onSelect?: (alert: Alert, selected: boolean) => void;
}

export function AlertRow({ alert, onToggle, busy = false, extra, selected = false, onSelect }: AlertRowProps) {
  return (
    <li
      className={`flex flex-col gap-3 border-b border-b-hairline px-4 py-3 last:border-b-0 sm:flex-row sm:items-start ${selected ? 'bg-raised' : ''} ${alert.resolved ? 'opacity-75' : ''}`}
    >
      {onSelect && (
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(alert, e.target.checked)}
          aria-label={`Select alert ${alert.id}`}
          className="mt-1 size-4 shrink-0"
        />
      )}
      <Lamp state={alert.resolved ? 'idle' : alert.severity} size="md" className="mt-1" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={alert.severity} />
          <SourceBadge source={alert.source} />
          {alert.resolved && (
            <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-green">
              <CheckCircle2 aria-hidden className="size-3.5" /> Resolved
            </span>
          )}
          <time dateTime={alert.created_at} title={fmtDateTime(alert.created_at)} className="font-mono text-[13px] text-muted">
            {fmtRelative(alert.created_at)}
          </time>
        </div>
        <p className="text-[15px] leading-snug break-words text-body">{alert.message}</p>
        <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
          <div className="flex gap-1.5">
            <dt>Tokens at stake</dt>
            <dd className="tabular font-mono text-body">{fmtInt(alert.saved_tokens)}</dd>
          </div>
          {alert.task_id && (
            <div className="flex gap-1.5">
              <dt>Task</dt>
              <dd className="font-mono text-body">{alert.task_id}</dd>
            </div>
          )}
          {alert.environment && (
            <div className="flex gap-1.5">
              <dt>Env</dt>
              <dd className="font-mono text-body">{alert.environment}</dd>
            </div>
          )}
          {alert.resolved_at && (
            <div className="flex gap-1.5">
              <dt>Resolved</dt>
              <dd className="font-mono text-body">{fmtDateTime(alert.resolved_at)}</dd>
            </div>
          )}
        </dl>
        {extra}
      </div>
      {onToggle && (
        <Button
          size="sm"
          busy={busy}
          onClick={() => onToggle(alert)}
          icon={alert.resolved ? <RotateCcw aria-hidden className="size-3.5" /> : <CheckCircle2 aria-hidden className="size-3.5" />}
          aria-label={`${alert.resolved ? 'Reopen' : 'Resolve'} alert ${alert.id}`}
        >
          {alert.resolved ? 'Reopen' : 'Resolve'}
        </Button>
      )}
    </li>
  );
}

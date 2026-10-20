import { FlaskConical, Menu, Plus, RefreshCw } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { TIME_RANGE_LABELS } from '../lib/format';
import { useWorkspace } from '../state/workspace';
import { ENVIRONMENTS, TIME_RANGES, type Environment, type TimeRange } from '../types';
import { Button, IconButton } from './Button';
import { ConnectionIndicator } from './ConnectionIndicator';
import { inputClass, SelectField } from './Field';

const ENV_OPTIONS = [{ value: 'all', label: 'All' }, ...ENVIRONMENTS.map((env) => ({ value: env, label: env }))];
const RANGE_OPTIONS = TIME_RANGES.map((range) => ({ value: range, label: TIME_RANGE_LABELS[range] }));

/** A filter select with its name written next to it, so nothing depends on option text alone. */
function LabeledSelect({
  label,
  value,
  onChange,
  options,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
  className?: string;
}) {
  const id = useId();
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <label htmlFor={id} className="plate-label shrink-0 text-muted">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputClass} themed-select min-w-0 flex-1`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface HeaderProps {
  onOpenMenu: () => void;
  menuOpen: boolean;
  onNewProject: () => void;
  onTestTelemetry: () => void;
}

export function Header({ onOpenMenu, menuOpen, onNewProject, onTestTelemetry }: HeaderProps) {
  const { projects, project, selectProject, filters, setFilters, refreshAll, summary } = useWorkspace();
  const [refreshRequested, setRefreshRequested] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const wasLoading = useRef(false);

  // Announce when a refresh finishes, based on the shared summary request.
  useEffect(() => {
    if (wasLoading.current && !summary.loading) {
      setUpdatedAt(new Date());
      setRefreshRequested(false);
    }
    wasLoading.current = summary.loading;
  }, [summary.loading]);

  const refreshing = refreshRequested && summary.loading;
  const filtered = filters.environment !== 'all' || filters.timeRange !== '24h';

  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-canvas/80">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-4 py-3 sm:px-6 lg:gap-3 lg:px-8">
        <IconButton
          label="Open navigation"
          onClick={onOpenMenu}
          aria-expanded={menuOpen}
          aria-controls="app-sidebar"
          className="lg:hidden"
        >
          <Menu aria-hidden className="size-4" />
        </IconButton>

        {project && (
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:flex-none">
            <SelectField
              label="Project"
              hideLabel
              value={project.project_id}
              onChange={(e) => selectProject(e.target.value)}
              options={projects.map((p) => ({ value: p.project_id, label: `${p.name} (${p.project_id})` }))}
              className="min-w-0 flex-1 sm:w-56 sm:flex-none"
            />
            <IconButton label="New project" onClick={onNewProject}>
              <Plus aria-hidden className="size-4" />
            </IconButton>
          </div>
        )}

        {project && (
          <div className="order-last flex w-full gap-3 sm:order-none sm:w-auto">
            <LabeledSelect
              label="Env"
              value={filters.environment}
              onChange={(value) => setFilters({ ...filters, environment: value as Environment | 'all' })}
              options={ENV_OPTIONS}
              className="flex-1 sm:w-36 sm:flex-none"
            />
            <LabeledSelect
              label="Range"
              value={filters.timeRange}
              onChange={(value) => setFilters({ ...filters, timeRange: value as TimeRange })}
              options={RANGE_OPTIONS}
              className="flex-1 sm:w-48 sm:flex-none"
            />
            {filtered && (
              <Button size="sm" variant="ghost" className="self-center" onClick={() => setFilters({ environment: 'all', timeRange: '24h' })}>
                Reset filters
              </Button>
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span aria-live="polite" className="hidden text-[13px] text-muted md:inline">
            {refreshing ? 'Refreshing…' : updatedAt ? `Updated ${updatedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
          </span>
          <span className="hidden sm:inline-flex">
            <ConnectionIndicator />
          </span>
          {project && (
            <>
              <IconButton
                label="Refresh data (r)"
                onClick={() => {
                  setRefreshRequested(true);
                  refreshAll();
                }}
                disabled={refreshing}
              >
                <RefreshCw aria-hidden className={`size-4 ${refreshing ? 'animate-spin text-route' : ''}`} />
              </IconButton>
              <Button variant="primary" onClick={onTestTelemetry} icon={<FlaskConical aria-hidden className="size-4" />}>
                <span className="hidden sm:inline">Test Telemetry</span>
                <span className="sm:hidden">Test</span>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

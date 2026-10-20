import type { AgentTask } from '../types';
import { fmtInt } from '../lib/format';
import { TaskStatusBadge } from './Badges';
import { Lamp } from './Lamp';

/**
 * One agent task drawn as a track. Each tool the task used is a block section, in the order
 * it was first used. The blocking tool is the section held at a red signal.
 */
export function TrackDiagram({ task }: { task: AgentTask }) {
  const tools = task.blocking_tool && !task.tools.includes(task.blocking_tool) ? [...task.tools, task.blocking_tool] : task.tools;
  const held = task.status === 'blocked';
  return (
    <figure className="space-y-4">
      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[15px]">
        <span className="font-mono text-ink">{task.task_id}</span>
        <TaskStatusBadge status={task.status} />
        <span className="tabular text-muted">
          {fmtInt(task.attempts)} attempts · {fmtInt(task.wasted_tokens)} wasted tokens · {tools.length} {tools.length === 1 ? 'tool' : 'tools'} used
        </span>
      </figcaption>

      {tools.length === 0 ? (
        <p className="text-sm text-muted">No tool calls recorded for this task yet.</p>
      ) : (
        <div role="region" aria-label={`Tools used by task ${task.task_id}`} tabIndex={0} className="overflow-x-auto pt-14 pb-1">
          <ol className="flex w-full min-w-max items-stretch">
            {tools.map((tool) => {
              const blocking = tool === task.blocking_tool;
              return (
                <li key={tool} className="relative min-w-[220px] max-w-[340px] flex-1 pr-3">
                  {blocking && (
                    <span className="absolute -top-14 left-1 flex flex-col items-center">
                      <Lamp state="critical" size="lg" />
                      <span aria-hidden className="h-5 w-1 bg-body" />
                    </span>
                  )}
                  <div aria-hidden className={`h-2 rounded-sm ${blocking ? 'bg-coral' : 'bg-route'}`} />
                  <div aria-hidden className="sleepers mt-1 h-2" />
                  <p className="mt-2 truncate font-mono text-[15px] text-ink" title={tool}>
                    {tool}
                  </p>
                  {blocking ? (
                    <p className="font-display text-xl leading-tight font-semibold text-coral">
                      {held ? 'Held' : 'Failing'} · {fmtInt(task.consecutive_failures)} failed in a row
                    </p>
                  ) : (
                    <p className="text-sm text-muted">No block reported</p>
                  )}
                </li>
              );
            })}
            <li aria-hidden className="min-w-16 flex-1">
              <div className="h-2 rounded-sm bg-hairline-strong" />
              <div className="sleepers mt-1 h-2 opacity-60" />
            </li>
          </ol>
        </div>
      )}

      {task.last_error && (
        <p className="max-w-[90ch] truncate font-mono text-[13px] text-muted" title={task.last_error}>
          <span className="text-body">{task.last_error_type ?? 'error'}: </span>
          {task.last_error}
        </p>
      )}
    </figure>
  );
}

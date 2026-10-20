import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Code2,
  Keyboard,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from 'lucide-react';
import { SHORTCUT_KEYS } from '../lib/shortcuts';
import { VIEWS, hashFor, type ViewId } from '../lib/route';
import { useSignedIn } from '../state/session';
import { useWorkspace } from '../state/workspace';
import { ConnectionIndicator } from './ConnectionIndicator';
import { Logo } from './Logo';

const ICONS: Record<ViewId, LucideIcon> = {
  overview: LayoutDashboard,
  agents: Bot,
  logs: ScrollText,
  events: Activity,
  alerts: Bell,
  analytics: BarChart3,
  policy: SlidersHorizontal,
  sdk: Code2,
  settings: Settings,
};

/** Watch what is happening, then configure how it is judged. */
const GROUPS: { label: string; ids: ViewId[] }[] = [
  { label: 'Monitor', ids: ['overview', 'agents', 'logs', 'events', 'alerts', 'analytics'] },
  { label: 'Configure', ids: ['policy', 'sdk', 'settings'] },
];

interface SidebarProps {
  view: ViewId;
  onNavigate: (view: ViewId) => void;
  open: boolean;
  onClose: () => void;
  onShowShortcuts: () => void;
}

export function Sidebar({ view, onNavigate, open, onClose, onShowShortcuts }: SidebarProps) {
  const { account, signOut } = useSignedIn();
  const { summary, project } = useWorkspace();
  const openAlerts = summary.data?.open_alerts;
  const critical = (summary.data?.critical_alerts ?? 0) > 0;

  return (
    <>
      {open && <div aria-hidden className="fixed inset-0 z-30 animate-fade bg-black/70 lg:hidden" onClick={onClose} />}
      <aside
        id="app-sidebar"
        aria-label="Primary"
        className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-hairline bg-sidebar transition-transform duration-200 ease-out lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex h-16 items-center justify-between border-b border-hairline px-5">
          <Logo />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="grid size-9 place-items-center rounded-sm text-muted hover:bg-white/5 hover:text-ink lg:hidden"
          >
            <X aria-hidden className="size-4" />
          </button>
        </div>

        <div className="border-b border-hairline px-5 py-3 lg:hidden">
          <ConnectionIndicator />
        </div>

        <nav aria-label="Dashboard sections" className="flex-1 overflow-y-auto px-3 py-4">
          {GROUPS.map((group, index) => (
            <div key={group.label} className={index > 0 ? 'mt-4 border-t border-hairline pt-4' : ''}>
              <h2 className="sr-only">{group.label}</h2>
              <ul className="space-y-1">
                {group.ids.map((id) => {
                  const item = VIEWS.find((v) => v.id === id)!;
                  const Icon = ICONS[id];
                  const active = id === view;
                  const disabled = !project && id !== 'overview';
                  const key = SHORTCUT_KEYS[id];
                  return (
                    <li key={id}>
                      <a
                        href={hashFor(id)}
                        aria-current={active ? 'page' : undefined}
                        aria-disabled={disabled || undefined}
                        tabIndex={disabled ? -1 : undefined}
                        title={disabled ? 'Create a project first' : `${item.label} (press g then ${key})`}
                        onClick={(event) => {
                          event.preventDefault();
                          if (disabled) return;
                          onNavigate(id);
                          onClose();
                        }}
                        className={`relative flex min-h-10 items-center gap-3 rounded-sm px-3 text-[15px] font-medium transition-colors duration-150 ${
                          active
                            ? 'bg-raised text-ink before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-sm before:bg-route'
                            : disabled
                              ? 'cursor-not-allowed text-faint'
                              : 'text-muted hover:bg-white/[0.04] hover:text-body'
                        }`}
                      >
                        <Icon aria-hidden className={`size-4 ${active ? 'text-route' : ''}`} />
                        <span className="flex-1">{item.label}</span>
                        {id === 'alerts' && typeof openAlerts === 'number' && openAlerts > 0 && (
                          <span
                            className={`tabular min-w-6 rounded-sm border px-1.5 text-center font-mono text-xs leading-5 font-semibold ${critical ? 'border-coral/50 bg-coral/10 text-coral' : 'border-amber/50 bg-amber/10 text-amber'}`}
                          >
                            {openAlerts > 99 ? '99+' : openAlerts}
                            <span className="sr-only"> open alerts{critical ? ', at least one critical' : ', none critical'}</span>
                          </span>
                        )}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-hairline p-3">
          <button
            type="button"
            onClick={() => {
              onShowShortcuts();
              onClose();
            }}
            className="flex min-h-10 w-full items-center gap-3 rounded-sm px-3 text-[15px] font-medium text-muted transition-colors hover:bg-white/[0.04] hover:text-ink"
          >
            <Keyboard aria-hidden className="size-4" />
            <span className="flex-1 text-left">Keyboard shortcuts</span>
            <kbd className="rounded-sm border border-hairline-strong px-1.5 font-mono text-xs text-muted">?</kbd>
          </button>
          <div className="mt-1 flex items-center gap-3 rounded-sm px-2 py-2">
            <div
              aria-hidden
              className="grid size-8 shrink-0 place-items-center rounded-sm border border-hairline-strong bg-raised font-display text-base font-bold text-route"
            >
              {account.name.trim().charAt(0).toUpperCase() || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{account.name}</p>
              <p className="truncate text-[13px] text-muted">{account.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-1 flex min-h-10 w-full items-center gap-3 rounded-sm px-3 text-[15px] font-medium text-muted transition-colors hover:bg-white/[0.04] hover:text-ink"
          >
            <LogOut aria-hidden className="size-4" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}

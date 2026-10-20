import { useCallback, useEffect, useState } from 'react';

export const VIEWS = [
  { id: 'overview', label: 'Overview' },
  { id: 'agents', label: 'Agent Diagnosis' },
  { id: 'logs', label: 'Logs' },
  { id: 'events', label: 'Events' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'policy', label: 'Policy' },
  { id: 'sdk', label: 'SDK Integration' },
  { id: 'settings', label: 'Project Settings' },
] as const;

export type ViewId = (typeof VIEWS)[number]['id'];

interface ParsedHash {
  view: ViewId;
  params: URLSearchParams;
}

/** `#/alerts?env=prod&range=7d` → the view and its query. */
export function parseHash(): ParsedHash {
  const raw = window.location.hash.replace(/^#\/?/, '');
  const [path, query = ''] = raw.split('?');
  const view = (VIEWS.find((v) => v.id === path)?.id ?? 'overview') as ViewId;
  return { view, params: new URLSearchParams(query) };
}

/** The hash for a view, keeping the current filters in the query so links can be shared. */
export function hashFor(view: ViewId, params: URLSearchParams = parseHash().params): string {
  const query = params.toString();
  return `#/${view}${query ? `?${query}` : ''}`;
}

/** Update query values in place without adding a history entry. `null` removes a key. */
export function replaceParams(update: Record<string, string | null>): void {
  const { view, params } = parseHash();
  for (const [key, value] of Object.entries(update)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const next = hashFor(view, params);
  if (next !== window.location.hash) window.history.replaceState(null, '', next);
}

/** Hash-based routing (`#/alerts?env=prod`) so reloads and shared links keep the view and filters. */
export function useHashRoute(): [ViewId, (view: ViewId) => void] {
  const [view, setView] = useState<ViewId>(() => parseHash().view);

  useEffect(() => {
    const onChange = () => setView(parseHash().view);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((next: ViewId) => {
    if (parseHash().view !== next) window.location.hash = hashFor(next).slice(1);
    setView(next);
  }, []);

  return [view, navigate];
}

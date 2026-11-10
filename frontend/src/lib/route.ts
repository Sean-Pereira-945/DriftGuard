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

/** The filters every view shares. Anything else in the query belongs to the view it was set on. */
export const GLOBAL_PARAMS = ['env', 'range', 'project'] as const;

/**
 * The hash for a view, keeping the current filters in the query so links can be shared. A link
 * to a different view keeps only the global filters, so a Logs search never ends up in an
 * Alerts link.
 */
export function hashFor(view: ViewId, params: URLSearchParams = parseHash().params): string {
  const kept = new URLSearchParams(params);
  if (view !== parseHash().view) {
    for (const key of [...kept.keys()]) {
      if (!(GLOBAL_PARAMS as readonly string[]).includes(key)) kept.delete(key);
    }
  }
  const query = kept.toString();
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

/**
 * A view's own filter (a tab, a search) in the address, next to the global ones. It is read
 * when the view mounts and whenever the address changes underneath it (back, forward, an
 * edited URL), written on every change (the default is left out), and removed when the view
 * unmounts, so a link opens the same list and the address never carries a stale filter into
 * another view.
 */
export function useViewParam<T extends string>(
  key: string,
  fallback: T,
  accept: (value: string) => value is T,
): [T, (next: T) => void] {
  const read = (): T => {
    const raw = parseHash().params.get(key);
    return raw !== null && accept(raw) ? raw : fallback;
  };
  const [value, setValue] = useState<T>(read);
  useEffect(() => {
    replaceParams({ [key]: value === fallback ? null : value });
  }, [key, value, fallback]);
  useEffect(() => {
    const onChange = () => setValue(read());
    window.addEventListener('hashchange', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
      replaceParams({ [key]: null });
    };
    // `read` closes over key/fallback/accept, which are constants for a given call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return [value, setValue];
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

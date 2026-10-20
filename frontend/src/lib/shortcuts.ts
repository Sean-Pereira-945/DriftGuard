import { useEffect, useRef } from 'react';
import type { ViewId } from './route';

/** The key pressed after `g` to jump to each view. */
export const SHORTCUT_KEYS: Record<ViewId, string> = {
  overview: 'o',
  agents: 'd',
  logs: 'l',
  events: 'e',
  alerts: 'a',
  analytics: 'n',
  policy: 'p',
  sdk: 's',
  settings: 't',
};

export const SHORTCUT_LIST: { keys: string[]; label: string }[] = [
  { keys: ['g', 'o'], label: 'Go to Overview' },
  { keys: ['g', 'd'], label: 'Go to Agent Diagnosis' },
  { keys: ['g', 'l'], label: 'Go to Logs' },
  { keys: ['g', 'e'], label: 'Go to Events' },
  { keys: ['g', 'a'], label: 'Go to Alerts' },
  { keys: ['g', 'n'], label: 'Go to Analytics' },
  { keys: ['g', 'p'], label: 'Go to Policy' },
  { keys: ['g', 's'], label: 'Go to SDK Integration' },
  { keys: ['g', 't'], label: 'Go to Project Settings' },
  { keys: ['/'], label: 'Focus the search box on this page' },
  { keys: ['r'], label: 'Refresh data' },
  { keys: ['?'], label: 'Show this list' },
];

const BY_KEY = Object.fromEntries(Object.entries(SHORTCUT_KEYS).map(([view, key]) => [key, view as ViewId]));

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

interface Handlers {
  enabled: boolean;
  navigate: (view: ViewId) => void;
  refresh: () => void;
  showSheet: () => void;
}

/** Single-key and `g` then key shortcuts. Ignored while typing, with modifiers, or over a dialog. */
export function useShortcuts({ enabled, navigate, refresh, showSheet }: Handlers): void {
  const handlers = useRef({ navigate, refresh, showSheet });
  handlers.current = { navigate, refresh, showSheet };

  useEffect(() => {
    if (!enabled) return;
    let pendingGo = false;
    let timer: number | undefined;
    const clear = () => {
      pendingGo = false;
      window.clearTimeout(timer);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTyping(event.target)) return;
      if (document.querySelector('[role="dialog"]') && event.key !== '?') return;

      if (pendingGo) {
        const view = BY_KEY[event.key.toLowerCase()];
        clear();
        if (view) {
          event.preventDefault();
          handlers.current.navigate(view);
        }
        return;
      }
      if (event.key === 'g') {
        pendingGo = true;
        timer = window.setTimeout(clear, 1200);
      } else if (event.key === '/') {
        const box = document.querySelector<HTMLInputElement>('[data-shortcut-search]');
        if (box) {
          event.preventDefault();
          box.focus();
          box.select();
        }
      } else if (event.key === 'r') {
        handlers.current.refresh();
      } else if (event.key === '?') {
        event.preventDefault();
        handlers.current.showSheet();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      clear();
    };
  }, [enabled]);
}

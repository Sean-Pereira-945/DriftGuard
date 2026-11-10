import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useViewParam } from './route';

type Tab = 'open' | 'resolved' | 'all';
const isTab = (value: string): value is Tab => value === 'open' || value === 'resolved' || value === 'all';

afterEach(() => {
  window.location.hash = '';
});

describe('useViewParam', () => {
  it('starts from the address when the value is valid, else from the fallback', () => {
    window.location.hash = '#/alerts?tab=resolved';
    expect(renderHook(() => useViewParam<Tab>('tab', 'open', isTab)).result.current[0]).toBe('resolved');

    window.location.hash = '#/alerts?tab=bogus';
    expect(renderHook(() => useViewParam<Tab>('tab', 'open', isTab)).result.current[0]).toBe('open');
  });

  it('writes changes to the address and leaves the default out', () => {
    window.location.hash = '#/alerts?env=prod';
    const { result } = renderHook(() => useViewParam<Tab>('tab', 'open', isTab));
    expect(window.location.hash).toBe('#/alerts?env=prod');

    act(() => result.current[1]('all'));
    expect(window.location.hash).toBe('#/alerts?env=prod&tab=all');

    act(() => result.current[1]('open'));
    expect(window.location.hash).toBe('#/alerts?env=prod');
  });

  it('follows the address when it changes underneath the view (back, forward, an edit)', () => {
    window.location.hash = '#/alerts?tab=resolved';
    const { result } = renderHook(() => useViewParam<Tab>('tab', 'open', isTab));
    act(() => {
      window.location.hash = '#/alerts?tab=all';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(result.current[0]).toBe('all');
    act(() => {
      window.location.hash = '#/alerts';
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(result.current[0]).toBe('open');
  });

  it('removes its key when the view unmounts, keeping the global filters', () => {
    window.location.hash = '#/alerts?env=prod&tab=resolved';
    const { unmount } = renderHook(() => useViewParam<Tab>('tab', 'open', isTab));
    unmount();
    expect(window.location.hash).toBe('#/alerts?env=prod');
  });
});

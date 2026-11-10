import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useShortcuts } from './shortcuts';

function press(key: string, init: KeyboardEventInit = {}, target: EventTarget = window) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

function mount(enabled = true) {
  const handlers = { enabled, navigate: vi.fn(), refresh: vi.fn(), showSheet: vi.fn() };
  const hook = renderHook(() => useShortcuts(handlers));
  return { ...handlers, hook };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('useShortcuts', () => {
  it('navigates on g then a view key', () => {
    const { navigate } = mount();
    press('g');
    const event = press('p');
    expect(navigate).toHaveBeenCalledWith('policy');
    expect(event.defaultPrevented).toBe(true);
  });

  it('forgets g after 1.2 seconds', () => {
    const { navigate } = mount();
    press('g');
    act(() => {
      vi.advanceTimersByTime(1300);
    });
    press('a');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('ignores an unknown key after g and clears the pending g', () => {
    const { navigate } = mount();
    press('g');
    press('z');
    press('a');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('refreshes on r and opens the sheet on ?', () => {
    const { refresh, showSheet } = mount();
    press('r');
    press('?');
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(showSheet).toHaveBeenCalledTimes(1);
  });

  it('focuses and selects the search box on /', () => {
    document.body.innerHTML = '<input data-shortcut-search value="abc" />';
    const box = document.querySelector('[data-shortcut-search]') as HTMLInputElement;
    const select = vi.spyOn(box, 'select');
    mount();
    const event = press('/');
    expect(document.activeElement).toBe(box);
    expect(select).toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('stays out of the way while typing', () => {
    document.body.innerHTML = '<textarea></textarea>';
    const area = document.querySelector('textarea') as HTMLTextAreaElement;
    const { refresh, navigate } = mount();
    press('r', {}, area);
    press('g', {}, area);
    press('a', {}, area);
    expect(refresh).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('ignores keys with a modifier held', () => {
    const { refresh } = mount();
    press('r', { ctrlKey: true });
    press('r', { metaKey: true });
    press('r', { altKey: true });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('is silent over a dialog, except for ?', () => {
    document.body.innerHTML = '<div role="dialog"></div>';
    const { refresh, showSheet } = mount();
    press('r');
    press('?');
    expect(refresh).not.toHaveBeenCalled();
    expect(showSheet).toHaveBeenCalledTimes(1);
  });

  it('does nothing when disabled, and unbinds on unmount', () => {
    const disabled = mount(false);
    press('r');
    expect(disabled.refresh).not.toHaveBeenCalled();

    const { refresh, hook } = mount();
    hook.unmount();
    press('r');
    expect(refresh).not.toHaveBeenCalled();
  });
});

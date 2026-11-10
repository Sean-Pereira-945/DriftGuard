import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashFor, parseHash, replaceParams } from './route';

afterEach(() => {
  window.location.hash = '';
  vi.restoreAllMocks();
});

describe('parseHash', () => {
  it('reads the view and its query', () => {
    window.location.hash = '#/alerts?env=prod&range=7d';
    const { view, params } = parseHash();
    expect(view).toBe('alerts');
    expect(params.get('env')).toBe('prod');
    expect(params.get('range')).toBe('7d');
  });

  it('falls back to the overview for an unknown or empty view', () => {
    window.location.hash = '#/nowhere';
    expect(parseHash().view).toBe('overview');
    window.location.hash = '';
    expect(parseHash().view).toBe('overview');
  });

  it('accepts a hash without the leading slash', () => {
    window.location.hash = '#logs?q=tests';
    const { view, params } = parseHash();
    expect(view).toBe('logs');
    expect(params.get('q')).toBe('tests');
  });
});

describe('hashFor', () => {
  it('keeps the current query so links can be shared', () => {
    window.location.hash = '#/overview?env=staging';
    expect(hashFor('policy')).toBe('#/policy?env=staging');
  });

  it('leaves the query off when there is none', () => {
    window.location.hash = '#/overview';
    expect(hashFor('alerts')).toBe('#/alerts');
  });

  it("keeps a view's own filters only for that view", () => {
    window.location.hash = '#/logs?env=prod&q=pytest&outcome=failed';
    expect(hashFor('logs')).toBe('#/logs?env=prod&q=pytest&outcome=failed');
    expect(hashFor('alerts')).toBe('#/alerts?env=prod');
    expect(hashFor('alerts', new URLSearchParams('project=x&tab=resolved'))).toBe('#/alerts?project=x');
  });
});

describe('replaceParams', () => {
  it('sets and removes keys without adding a history entry', () => {
    window.location.hash = '#/alerts?env=prod';
    const replace = vi.spyOn(window.history, 'replaceState');
    replaceParams({ tab: 'resolved', env: null });
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0][2]).toBe('#/alerts?tab=resolved');
  });

  it('does nothing when the address already matches', () => {
    window.location.hash = '#/alerts?tab=open';
    const replace = vi.spyOn(window.history, 'replaceState');
    replaceParams({ tab: 'open' });
    expect(replace).not.toHaveBeenCalled();
  });
});

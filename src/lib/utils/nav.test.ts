import { describe, it, expect } from 'vitest';
import { getChildNavItems, isNavItemActive } from './nav';

describe('getChildNavItems', () => {
  it('returns the base 5 items by default', () => {
    const items = getChildNavItems(7);
    expect(items.map((i) => i.href)).toEqual([
      '/child/7',
      '/child/7/foods',
      '/child/7/log',
      '/child/7/allergens',
      '/child/7/suggestions'
    ]);
    const log = items.find((i) => i.href === '/child/7/log');
    expect(log?.primary).toBe(true);
  });

  it('appends the guide entry when includeGuide is true', () => {
    const items = getChildNavItems(7, { includeGuide: true });
    expect(items[items.length - 1].href).toBe('/child/7/guide');
    expect(items.length).toBe(6);
  });
});

describe('isNavItemActive', () => {
  it('matches the dashboard exactly', () => {
    expect(isNavItemActive('/child/3', '/child/3', 3)).toBe(true);
    expect(isNavItemActive('/child/3', '/child/3/foods', 3)).toBe(false);
  });

  it('matches subpaths for non-dashboard hrefs', () => {
    expect(isNavItemActive('/child/3/log', '/child/3/log', 3)).toBe(true);
    expect(isNavItemActive('/child/3/log', '/child/3/log/42', 3)).toBe(true);
    expect(isNavItemActive('/child/3/log', '/child/3/foods', 3)).toBe(false);
  });
});

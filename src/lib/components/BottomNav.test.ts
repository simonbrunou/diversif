// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import '../../test/app-stubs';
import { setPagePathname } from '../../test/app-stubs';
import '../../test/component';
import BottomNav from './BottomNav.svelte';

describe('BottomNav', () => {
  it('renders 5 nav items (no guide)', () => {
    setPagePathname('/child/1');
    const { container } = render(BottomNav, { props: { childId: 1 } });
    const items = container.querySelectorAll('ul li');
    expect(items.length).toBe(5);
  });

  it('marks the active item with aria-current', () => {
    setPagePathname('/child/1/log');
    const { container } = render(BottomNav, { props: { childId: 1 } });
    const active = container.querySelector('a[aria-current="page"]');
    expect(active?.getAttribute('href')).toBe('/child/1/log');
  });

  it('highlights the primary "Logguer" entry distinctly', () => {
    setPagePathname('/child/1');
    const { container } = render(BottomNav, { props: { childId: 1 } });
    const primary = container.querySelector('a[href="/child/1/log"]');
    expect(primary).not.toBeNull();
    expect(primary?.querySelector('span.bg-primary')).not.toBeNull();
  });
});

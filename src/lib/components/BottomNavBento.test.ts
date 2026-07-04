import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import BottomNavBento from './BottomNavBento.svelte';

afterEach(() => cleanup());

describe('BottomNavBento', () => {
  function makeProps(currentPath: string) {
    return { currentChildId: 'abc', currentPath };
  }

  it('renders all four tab labels', () => {
    render(BottomNavBento, { props: makeProps('/child/abc') });
    expect(screen.getByText('Aujourd’hui')).toBeTruthy();
    expect(screen.getByText('Carnet')).toBeTruthy();
    expect(screen.getByText('Découvrir')).toBeTruthy();
    expect(screen.getByText('Profil')).toBeTruthy();
  });

  it('marks Aujourd’hui active when on /child/[id]', () => {
    render(BottomNavBento, { props: makeProps('/child/abc') });
    const aujourdhui = screen.getByText('Aujourd’hui').closest('a')!;
    expect(aujourdhui.getAttribute('aria-current')).toBe('page');
  });

  it('marks Carnet active when on /child/[id]/foods', () => {
    render(BottomNavBento, { props: makeProps('/child/abc/foods') });
    const carnet = screen.getByText('Carnet').closest('a')!;
    expect(carnet.getAttribute('aria-current')).toBe('page');
  });

  it('marks Découvrir active when on /child/[id]/guide', () => {
    render(BottomNavBento, { props: makeProps('/child/abc/guide') });
    expect(screen.getByText('Découvrir').closest('a')!.getAttribute('aria-current')).toBe('page');
  });

  it('marks Découvrir active when on /child/[id]/menu', () => {
    render(BottomNavBento, { props: makeProps('/child/abc/menu') });
    expect(screen.getByText('Découvrir').closest('a')!.getAttribute('aria-current')).toBe('page');
  });

  it('marks Profil active when on /account', () => {
    render(BottomNavBento, { props: makeProps('/account') });
    expect(screen.getByText('Profil').closest('a')!.getAttribute('aria-current')).toBe('page');
  });
});

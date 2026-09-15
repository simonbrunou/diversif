import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import * as m from '$lib/paraglide/messages';
import AllergensSnapshot from './AllergensSnapshot.svelte';

afterEach(() => cleanup());

describe('AllergensSnapshot', () => {
  const items = [
    { id: 'poisson', label: 'Poisson', state: 'reaction' as const, href: '/child/1/foods/42' },
    { id: 'lait', label: 'Lait', state: 'inconfort' as const, href: '/child/1/foods/43' },
    { id: 'oeuf', label: 'Œuf', state: 'fading' as const },
    { id: 'arachide', label: 'Arachide', state: 'todo' as const }
  ];
  const foodsHref = '/child/1/foods?segment=allergens';

  it('renders one pill per allergen with its real name and state', () => {
    render(AllergensSnapshot, { props: { items, foodsHref } });
    for (const label of ['Poisson', 'Lait', 'Œuf', 'Arachide']) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(screen.getByText(/réaction/)).toBeTruthy();
    expect(screen.getByText(/à reproposer/)).toBeTruthy();
    expect(screen.getByText(/non noté/)).toBeTruthy();
  });

  // The whole tile used to be one anchor, which gave the link an accessible
  // name made of every pill's text concatenated together.
  it('puts the segment link on the heading, not around the whole tile', () => {
    render(AllergensSnapshot, { props: { items, foodsHref } });
    const seeAll = screen.getByRole('link', { name: m.aujourdhuiAllergensSeeAll() });
    expect(seeAll.getAttribute('href')).toBe(foodsHref);
  });

  // The point of the fix: a pill with a real reaction behind it must reach the
  // entry page that carries the reassurance copy. Everything else stays inert.
  it('links reaction and inconfort pills at their entry, and leaves the rest inert', () => {
    render(AllergensSnapshot, { props: { items, foodsHref } });
    const hrefs = screen
      .getAllByRole('link')
      .map((el) => el.getAttribute('href'))
      .filter((href) => href !== foodsHref);
    expect(hrefs.sort()).toEqual(['/child/1/foods/42', '/child/1/foods/43']);
  });

  it('names the allergen in a linked pill so the target is not just "Poisson"', () => {
    render(AllergensSnapshot, { props: { items, foodsHref } });
    expect(
      screen.getByRole('link', {
        name: m.aujourdhuiAllergensEntryAria({ allergen: 'Poisson' })
      })
    ).toBeTruthy();
  });

  // Regression guard for the axe `scrollable-region-focusable` violation: the
  // pills must wrap, never live in a horizontal scroller that Safari and
  // Firefox leave keyboard-unreachable.
  it('wraps the pills instead of putting them in a horizontal scroller', () => {
    const { container } = render(AllergensSnapshot, { props: { items, foodsHref } });
    const list = container.querySelector('ul')!;
    expect(list.className).toContain('flex-wrap');
    expect(container.querySelector('[class*="overflow-x"]')).toBeNull();
    expect(container.querySelector('[class*="snap-"]')).toBeNull();
  });

  it('states already-cleared allergens as a count rather than more pills', () => {
    render(AllergensSnapshot, { props: { items, clearedCount: 4, foodsHref } });
    expect(screen.getByText(m.aujourdhuiAllergensClearedOther({ count: '4' }))).toBeTruthy();
  });

  it('omits the cleared count when there is nothing cleared', () => {
    render(AllergensSnapshot, { props: { items, clearedCount: 0, foodsHref } });
    expect(screen.queryByText(/introduit/)).toBeNull();
  });

  it('renders the empty-state copy and still links through', () => {
    render(AllergensSnapshot, { props: { items: [], foodsHref } });
    expect(screen.getByText(m.aujourdhuiAllergensEmpty())).toBeTruthy();
    expect(
      screen.getByRole('link', { name: m.aujourdhuiAllergensSeeAll() }).getAttribute('href')
    ).toBe(foodsHref);
  });
});

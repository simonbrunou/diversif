import { afterEach, describe, expect, it } from 'bun:test';
// @vitest-environment happy-dom
import { render, screen, cleanup } from '@testing-library/svelte';
import AllergenPassport from './AllergenPassport.svelte';
import type { AllergenItem } from '$lib/server/guidance/allergen-status';

afterEach(() => cleanup());

function build(overrides: Partial<AllergenItem>): AllergenItem {
  return {
    id: 'gluten',
    label: 'Gluten',
    triedCount: 0,
    lastTried: null,
    daysSinceLastTried: null,
    state: 'todo',
    ...overrides
  };
}

const FULL_TWELVE: AllergenItem[] = [
  build({ id: 'gluten', label: 'Gluten', state: 'cleared', triedCount: 3 }),
  build({ id: 'oeuf', label: 'Œuf', state: 'todo' }),
  build({ id: 'lait', label: 'Lait', state: 'cleared', triedCount: 5 }),
  build({
    id: 'arachide',
    label: 'Arachide',
    state: 'fading',
    triedCount: 1,
    daysSinceLastTried: 10
  }),
  build({ id: 'fruits_a_coque', label: 'Fruits à coque', state: 'reaction', triedCount: 1 }),
  build({ id: 'sesame', label: 'Sésame', state: 'todo' }),
  build({ id: 'soja', label: 'Soja', state: 'cleared', triedCount: 2 }),
  build({ id: 'poisson', label: 'Poisson', state: 'cleared', triedCount: 4 }),
  build({ id: 'crustace', label: 'Crustacés', state: 'todo' }),
  build({ id: 'mollusque', label: 'Mollusques', state: 'todo' }),
  build({ id: 'celeri', label: 'Céleri', state: 'todo' }),
  build({ id: 'moutarde', label: 'Moutarde', state: 'todo' })
];

describe('AllergenPassport', () => {
  it('renders the section header and subtitle with introduced count', () => {
    render(AllergenPassport, { props: { allergens: FULL_TWELVE } });
    expect(screen.getByText('Passeport allergènes')).toBeTruthy();
    // gluten + lait + poisson are cleared, arachide is fading → 4/7 introduced
    expect(screen.getByText(/4\/7 allergènes prioritaires introduits/)).toBeTruthy();
  });

  it('renders priority and other section labels', () => {
    render(AllergenPassport, { props: { allergens: FULL_TWELVE } });
    expect(screen.getByText('Prioritaires')).toBeTruthy();
    expect(screen.getByText('Autres allergènes suivis')).toBeTruthy();
  });

  it('groups priority allergens (7) and other allergens (5)', () => {
    const { container } = render(AllergenPassport, { props: { allergens: FULL_TWELVE } });
    // Priority cards are buttons inside the grid (sm:grid-cols-3) - assert 7 grid items
    const grid = container.querySelector('ul.grid-cols-2');
    expect(grid?.querySelectorAll('li').length).toBe(7);
    // The flex-wrap row holds the 5 "other" allergens
    const flex = container.querySelector('ul.flex-wrap');
    expect(flex?.querySelectorAll('li').length).toBe(5);
  });

  it('shows the fading hint with days for fading priority allergens', () => {
    render(AllergenPassport, { props: { allergens: FULL_TWELVE } });
    expect(screen.getByText(/10 j depuis la dernière fois/)).toBeTruthy();
  });

  it('shows tried-count caption for cleared allergens', () => {
    render(AllergenPassport, { props: { allergens: FULL_TWELVE } });
    expect(screen.getByText('3 fois')).toBeTruthy();
  });

  it('shows "Première fois" for never-tried allergens', () => {
    render(AllergenPassport, { props: { allergens: FULL_TWELVE } });
    // multiple todo allergens have count 0
    expect(screen.getAllByText('Première fois').length).toBeGreaterThan(0);
  });
});

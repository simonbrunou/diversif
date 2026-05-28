import { afterEach, describe, expect, it } from 'bun:test';
// @vitest-environment happy-dom
import { render, screen, cleanup } from '@testing-library/svelte';
import SeasonalFoods from './SeasonalFoods.svelte';

afterEach(() => cleanup());

const FRUITS = [
  { id: 1, name: 'Fraise', category: 'fruits', allergenType: null },
  { id: 2, name: 'Cerise', category: 'fruits', allergenType: null },
  { id: 3, name: 'Asperge', category: 'legumes', allergenType: null }
];

describe('SeasonalFoods', () => {
  it('renders the section header and month + subtitle', () => {
    render(SeasonalFoods, {
      props: { foods: FRUITS, month: 5, childId: '5' }
    });
    expect(screen.getByText('De saison ce mois-ci')).toBeTruthy();
    expect(screen.getByText(/mai/)).toBeTruthy();
    expect(screen.getByText(/Variez le panier/)).toBeTruthy();
  });

  it('renders one chip per food, in order, linking to the log page', () => {
    const { container } = render(SeasonalFoods, {
      props: { foods: FRUITS, month: 6, childId: '7' }
    });
    const links = container.querySelectorAll('a');
    expect(links.length).toBe(3);
    expect(links[0].textContent).toContain('Fraise');
    expect(links[0].getAttribute('href')).toBe('/child/7/log?foodId=1');
    expect(links[2].getAttribute('href')).toBe('/child/7/log?foodId=3');
  });

  it('renders the empty-state hint when no foods are seasonal+age-appropriate', () => {
    render(SeasonalFoods, {
      props: { foods: [], month: 1, childId: '5' }
    });
    expect(screen.getByText(/Aucun aliment de saison adapté/)).toBeTruthy();
  });

  it('uses the right month label for January (1) and December (12)', () => {
    const { rerender } = render(SeasonalFoods, {
      props: { foods: FRUITS, month: 1, childId: '5' }
    });
    expect(screen.getByText(/janvier/)).toBeTruthy();
    rerender({ foods: FRUITS, month: 12, childId: '5' });
    expect(screen.getByText(/décembre/)).toBeTruthy();
  });
});

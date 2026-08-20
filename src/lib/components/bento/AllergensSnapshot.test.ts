import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import AllergensSnapshot from './AllergensSnapshot.svelte';

afterEach(() => cleanup());

describe('AllergensSnapshot', () => {
  const items = [
    { id: 'oeuf', label: 'Œuf', state: 'ok' as const },
    { id: 'arachide', label: 'Arachide', state: 'todo' as const },
    { id: 'lait', label: 'Lait', state: 'fading' as const },
    { id: 'poisson', label: 'Poisson', state: 'reaction' as const }
  ];

  it('renders one pill per allergen with its real name', () => {
    render(AllergensSnapshot, { props: { items, foodsHref: '/child/1/foods?segment=allergens' } });
    expect(screen.getByText('Œuf')).toBeTruthy();
    expect(screen.getByText('Arachide')).toBeTruthy();
    expect(screen.getByText('Lait')).toBeTruthy();
    expect(screen.getByText('Poisson')).toBeTruthy();
  });

  it('renders the tile as a link to the allergens segment', () => {
    render(AllergensSnapshot, {
      props: { items, foodsHref: '/child/abc/foods?segment=allergens' }
    });
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/child/abc/foods?segment=allergens');
  });

  it('shows the state suffix for each pill', () => {
    render(AllergensSnapshot, { props: { items, foodsHref: '/child/1/foods?segment=allergens' } });
    expect(screen.getByText(/introduit/)).toBeTruthy();
    expect(screen.getByText(/non noté/)).toBeTruthy();
    expect(screen.getByText(/à reproposer/)).toBeTruthy();
    expect(screen.getByText(/réaction/)).toBeTruthy();
  });

  it('renders the empty state copy when there are no items, still linking through', () => {
    render(AllergensSnapshot, {
      props: { items: [], foodsHref: '/child/1/foods?segment=allergens' }
    });
    expect(
      screen.getByText(
        'Aucun allergène noté pour l’instant. Une fois la diversification commencée, ne retardez pas les allergènes courants comme l’œuf bien cuit et l’arachide.'
      )
    ).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe('/child/1/foods?segment=allergens');
  });
});

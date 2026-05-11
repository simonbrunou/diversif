// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import AllergensSnapshot from './AllergensSnapshot.svelte';

afterEach(() => cleanup());

describe('AllergensSnapshot', () => {
  const items = [
    { id: 'oeuf', label: 'Œuf', state: 'ok' as const },
    { id: 'arachide', label: 'Arachide', state: 'todo' as const },
    { id: 'lait', label: 'Lait', state: 'ok' as const }
  ];

  it('renders one pill per allergen', () => {
    render(AllergensSnapshot, { props: { items, foodsHref: '/child/1/foods?segment=allergens' } });
    expect(screen.getByText('Œuf')).toBeTruthy();
    expect(screen.getByText('Arachide')).toBeTruthy();
    expect(screen.getByText('Lait')).toBeTruthy();
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
    const pills = screen.getAllByText(/à essayer/);
    expect(pills.length).toBeGreaterThan(0);
  });
});

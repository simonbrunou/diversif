// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import CarnetAllergens from './CarnetAllergens.svelte';

afterEach(() => cleanup());

describe('CarnetAllergens', () => {
  const items = [
    { id: 'oeuf', label: 'Œuf', triedCount: 2, lastTried: '2026-04-01', state: 'cleared' as const },
    { id: 'arachide', label: 'Arachide', triedCount: 0, lastTried: null, state: 'todo' as const },
    {
      id: 'lait',
      label: 'Lait',
      triedCount: 1,
      lastTried: '2026-04-15',
      state: 'reaction' as const
    }
  ];

  it('renders one card per allergen', () => {
    render(CarnetAllergens, { props: { items } });
    expect(screen.getByText('Œuf')).toBeTruthy();
    expect(screen.getByText('Arachide')).toBeTruthy();
    expect(screen.getByText('Lait')).toBeTruthy();
  });

  it('renders empty placeholder when items is empty', () => {
    render(CarnetAllergens, { props: { items: [] } });
    expect(screen.getByText(/Aucun allergène/)).toBeTruthy();
  });

  it('renders the state per card', () => {
    render(CarnetAllergens, { props: { items } });
    expect(screen.getAllByText(/à découvrir/).length).toBeGreaterThan(0);
  });
});

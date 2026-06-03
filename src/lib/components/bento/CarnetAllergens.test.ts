import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import CarnetAllergens from './CarnetAllergens.svelte';

afterEach(() => cleanup());

describe('CarnetAllergens', () => {
  const items = [
    {
      id: 'oeuf',
      label: 'Œuf',
      triedCount: 2,
      lastTried: '2026-04-01',
      daysSinceLastTried: null,
      state: 'cleared' as const
    },
    {
      id: 'arachide',
      label: 'Arachide',
      triedCount: 0,
      lastTried: null,
      daysSinceLastTried: null,
      state: 'todo' as const
    },
    {
      id: 'lait',
      label: 'Lait',
      triedCount: 1,
      lastTried: '2026-04-15',
      daysSinceLastTried: null,
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

  it("renders the 'fading' state with à reproposer pill and days caption", () => {
    const fading = [
      {
        id: 'oeuf',
        label: 'Œuf',
        triedCount: 1,
        lastTried: '2026-04-30',
        daysSinceLastTried: 5,
        state: 'fading' as const
      }
    ];
    render(CarnetAllergens, { props: { items: fading } });
    expect(screen.getByText('Œuf')).toBeTruthy();
    expect(screen.getByText(/à reproposer/i)).toBeTruthy();
    // Caption substitutes the date with the days-since suffix.
    expect(screen.getByText(/5 j/)).toBeTruthy();
  });
});

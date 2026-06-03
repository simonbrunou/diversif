import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import CarnetBento from './CarnetBento.svelte';

afterEach(() => cleanup());

describe('CarnetBento', () => {
  const baseProps = {
    childId: 'abc',
    foods: [{ id: 1, name: 'Poire', category: 'fruits', tried: 2, status: 'ras' as const }],
    foodCount: 1,
    categoryCount: 1,
    allergens: [
      { id: 'oeuf', label: 'Œuf', triedCount: 0, lastTried: null, state: 'todo' as const }
    ],
    stats: {
      diversityScore: 1,
      distinctFoods: 1,
      weeklyEntries: { counts: [1, 0, 0, 0, 0, 0, 0], anchorUtc: Date.UTC(2026, 4, 14) }
    },
    currentSegment: 'all' as const
  };

  it('renders the header', () => {
    render(CarnetBento, { props: baseProps });
    expect(screen.getByText('Carnet')).toBeTruthy();
  });

  it('renders the Tous segment by default', () => {
    render(CarnetBento, { props: baseProps });
    expect(screen.getByText('Poire')).toBeTruthy();
  });

  it('renders the Allergens segment when currentSegment is allergens', () => {
    render(CarnetBento, { props: { ...baseProps, currentSegment: 'allergens' } });
    expect(screen.getByText('Œuf')).toBeTruthy();
  });

  it('renders the Stats segment when currentSegment is stats', () => {
    render(CarnetBento, { props: { ...baseProps, currentSegment: 'stats' } });
    expect(screen.getByText('Diversité')).toBeTruthy();
  });
});

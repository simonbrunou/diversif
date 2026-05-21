// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import DiscoverBento from './DiscoverBento.svelte';
import type { SuggestFood, RankedSuggestion } from '$lib/utils/suggest';

afterEach(() => cleanup());

describe('DiscoverBento', () => {
  const stages = [
    {
      id: '4-6m',
      title: '4 à 6 mois',
      oneLiner: 'Démarrer en douceur',
      principles: [],
      focus: [],
      textures: '',
      milkTarget: '',
      redFlags: [],
      sources: []
    },
    {
      id: '6-9m',
      title: '6 à 9 mois',
      oneLiner: 'Diversifier',
      principles: [],
      focus: [],
      textures: '',
      milkTarget: '',
      redFlags: [],
      sources: []
    },
    {
      id: '9-12m',
      title: '9 à 12 mois',
      oneLiner: 'Cuillère',
      principles: [],
      focus: [],
      textures: '',
      milkTarget: '',
      redFlags: [],
      sources: []
    },
    {
      id: '12m+',
      title: '12 mois et plus',
      oneLiner: 'Famille',
      principles: [],
      focus: [],
      textures: '',
      milkTarget: '',
      redFlags: [],
      sources: []
    }
  ];

  const suggestions: RankedSuggestion[] = [
    {
      food: { id: 1, name: 'Poire', category: 'fruits', allergenType: null } as SuggestFood,
      reason: 'diversify'
    }
  ];

  const baseProps = {
    stages,
    activeStageId: '6-9m',
    suggestions,
    todayTip: { id: 'tip-1', title: 'Astuce', body: 'Quelque chose' },
    tipDismissed: false,
    onPickSuggestion: vi.fn(),
    onDismissTip: vi.fn(),
    allergens: [],
    ageMonths: 7,
    textureProgress: { tried: [], mostRecent: null },
    seasonalFoods: [],
    currentMonth: 5,
    childId: '5',
    recipes: []
  };

  it('renders the stages, suggestions, tips, and sources section headings', () => {
    render(DiscoverBento, { props: baseProps });
    expect(screen.getByText('Les étapes')).toBeTruthy();
    expect(screen.getByText('Suggestions du jour')).toBeTruthy();
    expect(screen.getByText('Astuce du jour')).toBeTruthy();
    expect(screen.getByText('Sources scientifiques')).toBeTruthy();
  });

  it('renders no Sheet content while no stage is selected', () => {
    render(DiscoverBento, { props: baseProps });
    // The Sheet primitive renders into a Portal only when open; initial state has none open
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens the StageDetailSheet when a stage tile is tapped', async () => {
    render(DiscoverBento, { props: baseProps });
    await fireEvent.click(screen.getByText('9 à 12 mois'));
    // After tap, the Sheet is open : "Cuillère" appears in both the grid tile oneLiner and the
    // Sheet oneLiner, so use getAllByText and assert at least two occurrences (grid + sheet).
    expect(screen.getAllByText('Cuillère').length).toBeGreaterThanOrEqual(2);
  });
});

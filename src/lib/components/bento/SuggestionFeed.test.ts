// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/svelte';
import SuggestionFeed from './SuggestionFeed.svelte';
import type { SuggestFood, RankedSuggestion } from '$lib/utils/suggest';

afterEach(() => cleanup());

describe('SuggestionFeed', () => {
  const suggestions: RankedSuggestion[] = [
    {
      food: { id: 1, name: 'Poire', category: 'fruits', allergenType: null } as SuggestFood,
      reason: 'diversify'
    },
    {
      food: { id: 2, name: 'Œuf', category: 'oeufs', allergenType: 'oeuf' } as SuggestFood,
      reason: 'allergen'
    },
    {
      food: { id: 3, name: 'Carotte', category: 'legumes', allergenType: null } as SuggestFood,
      reason: 'recent'
    }
  ];

  it('renders one card per suggestion', () => {
    render(SuggestionFeed, { props: { suggestions, onPick: () => {} } });
    expect(screen.getByText('Poire')).toBeTruthy();
    expect(screen.getByText('Œuf')).toBeTruthy();
    expect(screen.getByText('Carotte')).toBeTruthy();
  });

  it('renders the reason chip for each suggestion', () => {
    render(SuggestionFeed, { props: { suggestions, onPick: () => {} } });
    expect(screen.getByText('Priorité allergène')).toBeTruthy();
    expect(screen.getByText('Pour diversifier la journée')).toBeTruthy();
    expect(screen.getByText('Pas essayé depuis 2 semaines')).toBeTruthy();
  });

  it('calls onPick with the food when a card is tapped', async () => {
    const onPick = vi.fn();
    render(SuggestionFeed, { props: { suggestions, onPick } });
    await fireEvent.click(screen.getByText('Poire'));
    expect(onPick).toHaveBeenCalledWith(suggestions[0].food);
  });

  it('renders nothing when suggestions is empty', () => {
    const { container } = render(SuggestionFeed, { props: { suggestions: [], onPick: () => {} } });
    expect(container.querySelector('section')).toBeNull();
  });

  it('renders a "view all" link when viewAllHref is provided', () => {
    render(SuggestionFeed, {
      props: { suggestions, onPick: () => {}, viewAllHref: '/child/42/suggestions' }
    });
    const link = screen.getByText(/Voir toutes les suggestions/).closest('a');
    expect(link?.getAttribute('href')).toBe('/child/42/suggestions');
  });

  it('omits the "view all" link when viewAllHref is not provided', () => {
    render(SuggestionFeed, { props: { suggestions, onPick: () => {} } });
    expect(screen.queryByText(/Voir toutes les suggestions/)).toBeNull();
  });
});

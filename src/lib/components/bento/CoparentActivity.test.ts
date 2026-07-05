import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import CoparentActivity from './CoparentActivity.svelte';
import * as m from '$lib/paraglide/messages';
import type { CoparentEntry } from '$lib/server/guidance/queries/timeline';

afterEach(() => cleanup());

describe('CoparentActivity', () => {
  it('groups a co-parent 3-ingredient meal into ONE "N ingrédients" line, singleton unchanged', () => {
    // Three ingredients sharing a mealId (contiguous, per the loader's
    // givenAt-desc/id-asc ordering) must fold into ONE line showing a count —
    // never one near-identical "a enregistré {food}" line per ingredient.
    const activity: CoparentEntry[] = [
      {
        id: 1,
        foodName: 'Carotte',
        category: 'legumes',
        reaction: 'ras',
        givenAt: Date.now(),
        loggedByName: 'Alice',
        mealId: 'meal-1'
      },
      {
        id: 2,
        foodName: 'Poire',
        category: 'fruits',
        reaction: 'ras',
        givenAt: Date.now(),
        loggedByName: 'Alice',
        mealId: 'meal-1'
      },
      {
        id: 3,
        foodName: 'Poulet',
        category: 'proteines',
        reaction: 'ras',
        givenAt: Date.now(),
        loggedByName: 'Alice',
        mealId: 'meal-1'
      },
      {
        id: 4,
        foodName: 'Pomme',
        category: 'fruits',
        reaction: 'ras',
        givenAt: Date.now() - 5000,
        loggedByName: 'Bob',
        mealId: null
      }
    ];
    render(CoparentActivity, { props: { activity } });

    // ONE grouped line for the whole meal, not 3 separate ingredient lines.
    expect(
      screen.getByText(m.profilCoparentsActivityMeal({ name: 'Alice', count: 3 }))
    ).toBeTruthy();
    expect(screen.queryByText('Carotte')).toBeNull();
    expect(screen.queryByText('Poire')).toBeNull();
    expect(screen.queryByText('Poulet')).toBeNull();

    // The singleton renders its own unchanged, un-grouped line.
    expect(
      screen.getByText(m.profilCoparentsActivityEntry({ name: 'Bob', food: 'Pomme' }))
    ).toBeTruthy();
  });

  it('renders nothing when activity is empty', () => {
    const { container } = render(CoparentActivity, { props: { activity: [] } });
    expect(container.textContent?.trim() ?? '').toBe('');
  });
});

// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { chooseSuggestedFood, type SuggestFood } from './suggest';

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

describe('chooseSuggestedFood', () => {
  const now = new Date('2026-05-11T12:00:00Z').getTime();

  it('returns null when no foods are available', () => {
    expect(
      chooseSuggestedFood({ starterFoods: [], recent: [], priorityAllergensTodo: [], now })
    ).toBeNull();
  });

  it('prefers a priority allergen marked à essayer over a starter food', () => {
    const oeuf: SuggestFood = { id: 1, name: 'Œuf', category: 'oeufs', allergenType: 'oeuf' };
    const carotte: SuggestFood = {
      id: 2,
      name: 'Carotte',
      category: 'legumes',
      allergenType: null
    };
    const out = chooseSuggestedFood({
      starterFoods: [carotte],
      recent: [],
      priorityAllergensTodo: [oeuf],
      now
    });
    expect(out?.id).toBe(1);
  });

  it('falls back to a starter food not in recent', () => {
    const carotte: SuggestFood = {
      id: 2,
      name: 'Carotte',
      category: 'legumes',
      allergenType: null
    };
    const out = chooseSuggestedFood({
      starterFoods: [carotte],
      recent: [{ foodId: 99, givenAt: now }],
      priorityAllergensTodo: [],
      now
    });
    expect(out?.id).toBe(2);
  });

  it('re-exposes a recent food whose last log is older than 14 days', () => {
    const out = chooseSuggestedFood({
      starterFoods: [],
      recent: [
        {
          foodId: 3,
          foodName: 'Poire',
          category: 'fruits',
          allergenType: null,
          givenAt: now - FOURTEEN_DAYS_MS - 1
        }
      ],
      priorityAllergensTodo: [],
      now
    });
    expect(out?.id).toBe(3);
  });

  it('skips a starter food already in recent and falls back to null', () => {
    const carotte: SuggestFood = {
      id: 2,
      name: 'Carotte',
      category: 'legumes',
      allergenType: null
    };
    expect(
      chooseSuggestedFood({
        starterFoods: [carotte],
        recent: [{ foodId: 2, givenAt: now }],
        priorityAllergensTodo: [],
        now
      })
    ).toBeNull();
  });
});

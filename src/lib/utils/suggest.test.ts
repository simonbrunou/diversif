import { describe, expect, it } from 'bun:test';
import { chooseSuggestedFoods, type SuggestFood } from './suggest';

describe('chooseSuggestedFoods', () => {
  const starter: SuggestFood[] = [
    { id: 1, name: 'Poire', category: 'fruits', allergenType: null },
    { id: 2, name: 'Carotte', category: 'legumes', allergenType: null },
    { id: 3, name: 'Œuf', category: 'oeufs', allergenType: 'oeuf' },
    { id: 4, name: 'Pomme', category: 'fruits', allergenType: null },
    { id: 5, name: 'Bœuf', category: 'proteines', allergenType: null },
    { id: 6, name: 'Riz', category: 'feculents', allergenType: null }
  ];

  it('returns up to N suggestions', () => {
    const out = chooseSuggestedFoods({
      starterFoods: starter,
      recent: [],
      priorityAllergensTodo: [],
      now: Date.parse('2026-05-01T12:00:00Z'),
      count: 5
    });
    expect(out.length).toBeLessThanOrEqual(5);
    expect(out.length).toBeGreaterThan(0);
  });

  it('annotates each suggestion with a reason key', () => {
    const out = chooseSuggestedFoods({
      starterFoods: starter,
      recent: [],
      priorityAllergensTodo: [{ id: 3, name: 'Œuf', category: 'oeufs', allergenType: 'oeuf' }],
      now: Date.parse('2026-05-01T12:00:00Z'),
      count: 3
    });
    for (const s of out) {
      expect(['allergen', 'diversify', 'recent']).toContain(s.reason);
    }
    expect(out.some((s) => s.reason === 'allergen' && s.food.id === 3)).toBe(true);
  });

  it('does not repeat foods', () => {
    const out = chooseSuggestedFoods({
      starterFoods: starter,
      recent: [],
      priorityAllergensTodo: [],
      now: Date.parse('2026-05-01T12:00:00Z'),
      count: 5
    });
    const ids = out.map((s) => s.food.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('suggests a recently-eaten food as "recent" when all categories are covered and food is stale', () => {
    const now = Date.parse('2026-05-01T12:00:00Z');
    const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
    // All unique categories are in recent (so diversify loop skips all foods)
    // but the food's last givenAt is > 2 weeks ago
    const foods: SuggestFood[] = [{ id: 1, name: 'Poire', category: 'fruits', allergenType: null }];
    const recent: import('./suggest').SuggestRecent[] = [
      { foodId: 1, foodName: 'Poire', category: 'fruits', givenAt: now - TWO_WEEKS_MS - 1 }
    ];
    const out = chooseSuggestedFoods({
      starterFoods: foods,
      recent,
      priorityAllergensTodo: [],
      now,
      count: 3
    });
    expect(out.some((s) => s.reason === 'recent' && s.food.id === 1)).toBe(true);
  });

  it('fills remaining slots from fallback diversify when count not met after diversify+recent passes', () => {
    const now = Date.parse('2026-05-01T12:00:00Z');
    // Two foods in same category as recent : diversify loop skips them, recent loop skips them (not stale)
    // fallback loop should pick them up
    const foods: SuggestFood[] = [
      { id: 1, name: 'Poire', category: 'fruits', allergenType: null },
      { id: 2, name: 'Pomme', category: 'fruits', allergenType: null }
    ];
    const recent: import('./suggest').SuggestRecent[] = [
      { foodId: 99, foodName: 'Banane', category: 'fruits', givenAt: now - 1000 }
    ];
    const out = chooseSuggestedFoods({
      starterFoods: foods,
      recent,
      priorityAllergensTodo: [],
      now,
      count: 2
    });
    expect(out.length).toBe(2);
    expect(out.every((s) => s.reason === 'diversify')).toBe(true);
  });

  it('stops adding allergens once count is reached', () => {
    const allergens: SuggestFood[] = [
      { id: 10, name: 'Arachide', category: 'allergenes', allergenType: 'arachide' },
      { id: 11, name: 'Lait', category: 'allergenes', allergenType: 'lait' },
      { id: 12, name: 'Soja', category: 'allergenes', allergenType: 'soja' }
    ];
    const out = chooseSuggestedFoods({
      starterFoods: [],
      recent: [],
      priorityAllergensTodo: allergens,
      now: Date.parse('2026-05-01T12:00:00Z'),
      count: 2
    });
    expect(out.length).toBe(2);
    expect(out.every((s) => s.reason === 'allergen')).toBe(true);
  });

  it('skips duplicate allergen ids in priorityAllergensTodo', () => {
    const oeuf: SuggestFood = { id: 3, name: 'Oeuf', category: 'oeufs', allergenType: 'oeuf' };
    const out = chooseSuggestedFoods({
      starterFoods: [],
      recent: [],
      priorityAllergensTodo: [oeuf, oeuf],
      now: Date.parse('2026-05-01T12:00:00Z'),
      count: 5
    });
    expect(out.filter((s) => s.food.id === 3).length).toBe(1);
  });

  it('skips starterFoods already added via allergens in subsequent passes', () => {
    const now = Date.parse('2026-05-01T12:00:00Z');
    const oeuf: SuggestFood = { id: 3, name: 'Oeuf', category: 'oeufs', allergenType: 'oeuf' };
    const out = chooseSuggestedFoods({
      starterFoods: [oeuf, { id: 1, name: 'Poire', category: 'fruits', allergenType: null }],
      recent: [],
      priorityAllergensTodo: [oeuf],
      now,
      count: 5
    });
    expect(out.filter((s) => s.food.id === 3).length).toBe(1);
    expect(out.find((s) => s.food.id === 3)?.reason).toBe('allergen');
  });
});

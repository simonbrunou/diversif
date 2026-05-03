import { describe, it, expect } from 'vitest';
import { ALLERGENS, getAllergenLabel } from './allergens';

describe('ALLERGENS', () => {
  it('exposes a non-empty list with unique ids', () => {
    expect(ALLERGENS.length).toBeGreaterThan(0);
    const ids = ALLERGENS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('getAllergenLabel', () => {
  it('returns the label for a known id', () => {
    expect(getAllergenLabel('gluten')).toBe('Gluten');
    expect(getAllergenLabel('oeuf')).toBe('Œuf');
  });

  it('returns null for unknown id', () => {
    expect(getAllergenLabel('not-a-real-allergen')).toBeNull();
  });

  it('returns null for null / undefined / empty input', () => {
    expect(getAllergenLabel(null)).toBeNull();
    expect(getAllergenLabel(undefined)).toBeNull();
    expect(getAllergenLabel('')).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import {
  CATEGORIES,
  CATEGORY_IDS,
  getCategoryLabel,
  getCategoryColor,
  getCategoryIcon,
  getCategoryClasses
} from './categories';

const ALLOWED_COLORS = ['mint', 'peach', 'butter', 'sky', 'lilac', 'primary'] as const;

describe('CATEGORIES', () => {
  it('exposes ids matching CATEGORY_IDS', () => {
    expect(CATEGORY_IDS).toEqual(CATEGORIES.map((c) => c.id));
  });

  it('contains the expected base groups', () => {
    const ids = CATEGORIES.map((c) => c.id);
    for (const expected of ['legumes', 'fruits', 'feculents', 'autre']) {
      expect(ids).toContain(expected);
    }
  });

  it('every category has a color from the allowed palette and an icon component', () => {
    for (const cat of CATEGORIES) {
      expect(ALLOWED_COLORS).toContain(cat.color);
      expect(typeof cat.icon).toBe('function');
    }
  });
});

describe('getCategoryLabel', () => {
  it('returns the label for a known id', () => {
    expect(getCategoryLabel('fruits')).toBe('Fruits');
  });

  it('returns the cleaned-up Allergènes label without the parenthetical', () => {
    expect(getCategoryLabel('allergenes')).toBe('Allergènes');
  });

  it('falls back to the id when unknown', () => {
    expect(getCategoryLabel('not-a-category')).toBe('not-a-category');
  });
});

describe('getCategoryColor / getCategoryIcon / getCategoryClasses', () => {
  it('returns the assigned color for a known id', () => {
    expect(getCategoryColor('legumes')).toBe('mint');
    expect(getCategoryColor('fruits')).toBe('peach');
    expect(getCategoryColor('allergenes')).toBe('primary');
  });

  it('falls back to primary for an unknown id', () => {
    expect(getCategoryColor('nope')).toBe('primary');
  });

  it('returns an icon component for any input', () => {
    expect(typeof getCategoryIcon('fruits')).toBe('function');
    expect(typeof getCategoryIcon('nope')).toBe('function');
  });

  it('returns class fragments containing the corresponding accent token', () => {
    const fruits = getCategoryClasses('fruits');
    expect(fruits.tint).toContain('accent-peach');
    expect(fruits.dot).toContain('accent-peach');

    const allergenes = getCategoryClasses('allergenes');
    expect(allergenes.tint).toContain('primary');
  });
});

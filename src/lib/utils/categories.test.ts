import { describe, it, expect } from 'vitest';
import { CATEGORIES, CATEGORY_IDS, getCategoryLabel } from './categories';

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
});

describe('getCategoryLabel', () => {
  it('returns the label for a known id', () => {
    expect(getCategoryLabel('fruits')).toBe('Fruits');
  });

  it('falls back to the id when unknown', () => {
    expect(getCategoryLabel('not-a-category')).toBe('not-a-category');
  });
});

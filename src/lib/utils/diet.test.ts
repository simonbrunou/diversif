import { describe, expect, it } from 'bun:test';
import { DIET_EXCLUSIONS, parseDietExclusions } from './diet';

describe('diet', () => {
  it('DIET_EXCLUSIONS is the 3 known exclusion ids', () => {
    expect(DIET_EXCLUSIONS).toEqual(['porc', 'vegetarien', 'sans_poisson']);
  });

  describe('parseDietExclusions', () => {
    it('returns [] for a non-array input', () => {
      expect(parseDietExclusions(null)).toEqual([]);
      expect(parseDietExclusions(undefined)).toEqual([]);
      expect(parseDietExclusions('porc')).toEqual([]);
      expect(parseDietExclusions(42)).toEqual([]);
      expect(parseDietExclusions({ porc: true })).toEqual([]);
    });

    it('returns [] for an empty array', () => {
      expect(parseDietExclusions([])).toEqual([]);
    });

    it('filters out invalid entries from a mixed array', () => {
      expect(parseDietExclusions(['porc', 'bogus', 'vegetarien'])).toEqual(['porc', 'vegetarien']);
    });

    it('round-trips an all-valid array unchanged', () => {
      expect(parseDietExclusions(['porc', 'vegetarien', 'sans_poisson'])).toEqual([
        'porc',
        'vegetarien',
        'sans_poisson'
      ]);
    });
  });
});

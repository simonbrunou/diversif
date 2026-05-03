import { describe, it, expect } from 'vitest';
import { fuzzyMatch, normalize } from './search';

describe('normalize', () => {
  it('lowercases and strips diacritics', () => {
    expect(normalize('Pêche')).toBe('peche');
    expect(normalize('Œuf')).toMatch(/(œ|oe)uf/);
    expect(normalize("Beurre d'olive")).toBe('beurre d olive');
  });
});

describe('fuzzyMatch', () => {
  it('matches a substring case-insensitively', () => {
    expect(fuzzyMatch('caro', 'Carotte')).toBe(true);
    expect(fuzzyMatch('CARO', 'Carotte')).toBe(true);
  });
  it('matches across diacritics', () => {
    expect(fuzzyMatch('peche', 'Pêche')).toBe(true);
  });
  it('returns false when characters are out of order', () => {
    expect(fuzzyMatch('xyz', 'Carotte')).toBe(false);
  });
  it('matches subsequence', () => {
    expect(fuzzyMatch('crt', 'Carotte')).toBe(true);
  });
  it('returns true for empty query', () => {
    expect(fuzzyMatch('', 'Anything')).toBe(true);
  });
});

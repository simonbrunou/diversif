import { describe, expect, it } from 'bun:test';
import { ALL_SOURCE_IDS, SOURCES, getSource } from './sources';

describe('SOURCES catalog', () => {
  it('every entry has the required fields', () => {
    for (const id of ALL_SOURCE_IDS) {
      const s = SOURCES[id];
      expect(typeof s.label).toBe('string');
      expect(s.label.length).toBeGreaterThan(0);
      expect(typeof s.org).toBe('string');
      expect(s.org.length).toBeGreaterThan(0);
      expect(typeof s.year).toBe('number');
      expect(s.year).toBeGreaterThan(1900);
      expect(s.url.startsWith('http')).toBe(true);
    }
  });

  it('exposes ids matching SOURCES keys', () => {
    expect(ALL_SOURCE_IDS.sort()).toEqual(
      (Object.keys(SOURCES) as (keyof typeof SOURCES)[]).sort()
    );
  });
});

describe('getSource', () => {
  it('returns the same object as direct lookup', () => {
    for (const id of ALL_SOURCE_IDS) {
      expect(getSource(id)).toBe(SOURCES[id]);
    }
  });
});

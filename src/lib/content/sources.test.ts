import { describe, expect, it } from 'bun:test';
import { ALL_SOURCE_IDS, SOURCES } from './sources';

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

  // Titles and org names mix French and English, and the renderers tag each
  // with the language declared here (#665).
  it('every entry declares the language of its title and of its org name', () => {
    const undeclared = ALL_SOURCE_IDS.filter(
      (id) =>
        !['fr', 'en'].includes(SOURCES[id].labelLang) || !['fr', 'en'].includes(SOURCES[id].orgLang)
    );
    expect(undeclared).toEqual([]);
  });

  it.each([
    // An English title from an org with a French name.
    ['who-cf', 'en', 'fr'],
    ['espghan-2017', 'en', 'en'],
    ['hcsp-2020', 'fr', 'fr']
  ] as const)('%s declares a title in %s and an org name in %s', (id, labelLang, orgLang) => {
    expect({ labelLang: SOURCES[id].labelLang, orgLang: SOURCES[id].orgLang }).toEqual({
      labelLang,
      orgLang
    });
  });

  it('exposes ids matching SOURCES keys', () => {
    expect(ALL_SOURCE_IDS.sort()).toEqual(
      (Object.keys(SOURCES) as (keyof typeof SOURCES)[]).sort()
    );
  });
});

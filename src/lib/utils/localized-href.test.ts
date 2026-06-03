import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';

mock.module('$lib/i18n', () => ({
  i18n: {
    resolveRoute: (path: string, locale: string) => (locale === 'fr' ? path : `/${locale}${path}`)
  }
}));

import { localizedHref } from './localized-href';
import { setLanguageTag, sourceLanguageTag } from '$lib/paraglide/runtime';

// Don't mock.module('$lib/paraglide/runtime') — bun:test's mock.module is
// process-global, so the replacement would leak into every subsequent test
// file (e.g. dates.test.ts) that relies on languageTag() returning 'fr'.
// Instead, drive the real runtime via setLanguageTag and reset after each.

describe('localizedHref', () => {
  beforeEach(() => {
    setLanguageTag('fr');
  });

  afterEach(() => {
    setLanguageTag(sourceLanguageTag);
  });

  it('returns the path unchanged for the FR base locale', () => {
    expect(localizedHref('/login')).toBe('/login');
  });

  it('prefixes /en for the EN locale', () => {
    setLanguageTag('en');
    expect(localizedHref('/login')).toBe('/en/login');
  });
});

import { beforeEach, describe, expect, it, mock } from 'bun:test';
mock.module('$lib/i18n', () => ({
  i18n: {
    resolveRoute: (path: string, locale: string) => (locale === 'fr' ? path : `/${locale}${path}`)
  }
}));

mock.module('$lib/paraglide/runtime', () => ({
  languageTag: mock(() => 'fr')
}));

import { localizedHref } from './localized-href';
import { languageTag } from '$lib/paraglide/runtime';

describe('localizedHref', () => {
  beforeEach(() => {
    languageTag.mockReturnValue('fr');
  });

  it('returns the path unchanged for the FR base locale', () => {
    expect(localizedHref('/login')).toBe('/login');
  });

  it('prefixes /en for the EN locale', () => {
    languageTag.mockReturnValue('en');
    expect(localizedHref('/login')).toBe('/en/login');
  });
});

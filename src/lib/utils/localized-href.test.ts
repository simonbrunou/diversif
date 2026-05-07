import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/i18n', () => ({
  i18n: {
    resolveRoute: (path: string, locale: string) => (locale === 'fr' ? path : `/${locale}${path}`)
  }
}));

vi.mock('$lib/paraglide/runtime', () => ({
  languageTag: vi.fn(() => 'fr')
}));

import { localizedHref } from './localized-href';
import { languageTag } from '$lib/paraglide/runtime';

describe('localizedHref', () => {
  beforeEach(() => {
    vi.mocked(languageTag).mockReturnValue('fr');
  });

  it('returns the path unchanged for the FR base locale', () => {
    expect(localizedHref('/login')).toBe('/login');
  });

  it('prefixes /en for the EN locale', () => {
    vi.mocked(languageTag).mockReturnValue('en');
    expect(localizedHref('/login')).toBe('/en/login');
  });
});

import { afterEach, describe, expect, it } from 'bun:test';

import { localizedHref } from './localized-href';
import { baseLocale, overwriteGetLocale } from '$lib/paraglide/runtime';

// Don't mock.module('$lib/paraglide/runtime') — bun:test's mock.module is
// process-global, so the replacement would leak into every subsequent test
// file that relies on getLocale() returning 'fr'. Instead, swap the locale
// resolver via overwriteGetLocale and reset to the base locale after each.

describe('localizedHref', () => {
  afterEach(() => {
    overwriteGetLocale(() => baseLocale);
  });

  it('returns the path unchanged for the FR base locale', () => {
    overwriteGetLocale(() => 'fr');
    expect(localizedHref('/login')).toBe('/login');
  });

  it('prefixes /en for the EN locale', () => {
    overwriteGetLocale(() => 'en');
    expect(localizedHref('/login')).toBe('/en/login');
  });

  it('maps the root path to /en without a trailing slash (deliberate improvement over 1.x, which emitted /en/)', () => {
    overwriteGetLocale(() => 'en');
    expect(localizedHref('/')).toBe('/en');
  });

  it('resolves an explicit locale argument over the active locale', () => {
    overwriteGetLocale(() => 'fr');
    expect(localizedHref('/login', 'en')).toBe('/en/login');
    overwriteGetLocale(() => 'en');
    expect(localizedHref('/login', 'fr')).toBe('/login');
    expect(localizedHref('/', 'fr')).toBe('/');
  });
});

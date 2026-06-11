import { getLocale, localizeHref, type Locale } from '$lib/paraglide/runtime';

/**
 * Resolve an unprefixed app path to a locale's URL (the active locale by
 * default). Use this in place of bare `href="/..."` so that an EN visitor
 * clicking a link stays on `/en/...` and doesn't silently flip the chrome
 * back to FR.
 *
 * paraglide 2.x's localizeHref maps the root path to `/en/` (trailing
 * slash); the 1.x adapter produced `/en` and the app's links are
 * trailing-slash-free (SvelteKit trailingSlash 'never'), so normalize it
 * away to keep emitted hrefs byte-identical.
 */
export function localizedHref(path: string, locale: Locale = getLocale()): string {
  const href = localizeHref(path, { locale });
  return href.length > 1 && href.endsWith('/') ? href.slice(0, -1) : href;
}

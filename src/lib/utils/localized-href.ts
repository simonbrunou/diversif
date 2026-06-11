import { getLocale, localizeHref, type Locale } from '$lib/paraglide/runtime';

/**
 * Resolve an unprefixed app path to a locale's URL (the active locale by
 * default). Use this in place of bare `href="/..."` so that an EN visitor
 * clicking a link stays on `/en/...` and doesn't silently flip the chrome
 * back to FR.
 *
 * localizeHref maps the root path to `/en/` (trailing slash); the app's
 * links are trailing-slash-free (SvelteKit trailingSlash 'never'), so
 * normalize that one case. (The 1.x adapter emitted `/en/` here too — this
 * is a deliberate improvement, not parity.)
 */
export function localizedHref(path: string, locale: Locale = getLocale()): string {
  const href = localizeHref(path, { locale });
  // Only the EN root needs the normalization — a blanket "strip trailing
  // slash" would corrupt hrefs whose query/hash legitimately ends in '/'
  // (e.g. ?redirect=/).
  return href === '/en/' ? '/en' : href;
}

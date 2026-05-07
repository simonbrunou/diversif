import { i18n } from '$lib/i18n';
import { languageTag } from '$lib/paraglide/runtime';

/**
 * Resolve an unprefixed app path to the active locale's URL. Use this in
 * place of bare `href="/..."` so that an EN visitor clicking a link stays
 * on `/en/...` and doesn't silently flip the chrome back to FR.
 */
export function localizedHref(path: string): string {
  return i18n.resolveRoute(path, languageTag());
}

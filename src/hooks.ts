import type { Reroute } from '@sveltejs/kit';
import { deLocalizeUrl } from '$lib/paraglide/runtime';

/**
 * Map the visible (possibly /en-prefixed) URL onto the unprefixed SvelteKit
 * route, so /en/child/[id] renders the same route as /child/[id]. The
 * paraglide 2.x default URL pattern keeps the base locale (fr) unprefixed
 * and prefixes every other locale, matching the 1.x adapter's behavior.
 */
export const reroute: Reroute = (request) => deLocalizeUrl(request.url).pathname;

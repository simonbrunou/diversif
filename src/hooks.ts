import type { Reroute } from '@sveltejs/kit/hooks';
import { deLocalizeUrl } from '#lib/paraglide/runtime.js';

/**
 * Map the visible (possibly /en-prefixed) URL onto the unprefixed SvelteKit
 * route, so /en/child/[id] renders the same route as /child/[id]. The URL
 * patterns in paraglide.config.ts keep the base locale (fr) unprefixed and
 * prefix en, matching the 1.x adapter's behavior.
 */
export const reroute: Reroute = (request) => deLocalizeUrl(request.url).pathname;

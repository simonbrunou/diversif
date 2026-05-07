import { createI18n } from '@inlang/paraglide-sveltekit';
import * as runtime from '$lib/paraglide/runtime';

/**
 * Single source of truth for paraglide-sveltekit's runtime helpers.
 * Used by `src/hooks.ts` (reroute), `src/hooks.server.ts` (handle),
 * and components needing to build alternate-locale URLs.
 */
export const i18n = createI18n(runtime);

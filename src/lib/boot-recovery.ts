/**
 * Recovery for an app that failed to start. When a root chunk fails to load,
 * SvelteKit 3 rejects kit.start() with nothing to catch it (see verdict in
 * #lib/sentry-policy.ts, DIVERSIF-D): the parent is left on
 * the server-rendered page, where only plain links and forms still work, and
 * nothing tells them why. hooks.client.ts passes every unhandled rejection
 * here.
 *
 * A dropped request or a chunk a redeploy removed is usually gone on the next
 * load, so the page reloads once. Until the app boots again, any further
 * failure shows a banner asking the parent to check their connection and
 * retry, so an outage that lasts cannot loop. Offline, the banner shows
 * straight away: a reload would only swap the page for the browser's own
 * error page. Recovery ends once the app hydrates: #lib/hydration.ts owns
 * that marker, and tells this module when the root layout sets it.
 *
 * Out of reach: a failed entry/start or entry/app chunk stops before
 * hooks.client.ts runs. A root chunk that loads but throws is a bug Sentry
 * reports, not a network failure. A page chunk failing during hydration goes
 * through handleError: SvelteKit's error page, or a full reload when its
 * data refetch fails too.
 */

import { mount } from 'svelte';
import BootFailureBanner from '#lib/components/BootFailureBanner.svelte';
import { isNetworkFailure } from '#lib/network-failure.js';
import { isHydrated, onHydrated } from '#lib/hydration.js';

/** sessionStorage key, set while this tab's recovery reload has not led to a boot. */
const RELOAD_PENDING_KEY = 'diversif:boot-reload-pending';

// The app started, so a later failed boot in this tab may reload again.
onHydrated(() => {
  try {
    sessionStorage.removeItem(RELOAD_PENDING_KEY);
  } catch {
    // No sessionStorage: claimReload never set the key.
  }
});

/** Claims the tab's one recovery reload. Without sessionStorage there is no loop guard, so no reload. */
function claimReload(): boolean {
  try {
    if (sessionStorage.getItem(RELOAD_PENDING_KEY)) return false;
    sessionStorage.setItem(RELOAD_PENDING_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

/** Handles one unhandled rejection; only a network failure before hydration means the app could not start. */
export function recoverFromFailedBoot(reason: unknown): void {
  if (isHydrated() || !isNetworkFailure(reason)) return;
  // Claimed even offline, so « Réessayer » failing later shows the banner again.
  if (claimReload() && navigator.onLine) {
    location.reload();
    return;
  }
  if (document.querySelector('[data-boot-failure]')) return;
  // First in the body, so « Réessayer » is the first thing a keyboard reaches.
  mount(BootFailureBanner, {
    target: document.body,
    anchor: document.body.firstChild ?? undefined,
    props: { onretry: () => location.reload() }
  });
}

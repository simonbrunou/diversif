/**
 * Recovery for an app that failed to start. When a root chunk fails to load,
 * SvelteKit 3 rejects kit.start() with nothing to catch it (see verdict in
 * #lib/sentry-policy.ts, DIVERSIF-D): the parent is left on
 * the server-rendered page, where only plain links and forms still work, and
 * nothing tells them why. hooks.client.ts passes every unhandled rejection
 * here.
 *
 * A dropped request or a chunk a redeploy removed is usually gone on the next
 * load, so the page reloads once. Until the app boots again (markHydrated),
 * any further failure shows a banner asking the parent to check their
 * connection and retry, so an outage that lasts cannot loop. Offline, the
 * banner shows straight away: a reload would only swap the page for the
 * browser's own error page.
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

/** sessionStorage key, set while this tab's recovery reload has not led to a boot. */
const RELOAD_PENDING_KEY = 'diversif:boot-reload-pending';

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

/**
 * Marks the app as started: the root layout calls this once mounted. Ends a
 * pending recovery, so a later failed boot in this tab may reload again; e2e
 * tests also wait on the attribute before their first interaction.
 */
export function markHydrated(): void {
  document.documentElement.dataset.hydrated = 'true';
  try {
    sessionStorage.removeItem(RELOAD_PENDING_KEY);
  } catch {
    // No sessionStorage: claimReload never set the key.
  }
}

/**
 * Whether the root layout has mounted. False on the server and while the
 * client hydrates the server-rendered page, so markup rendered while it is
 * false came from the server (FormError reads it per alert).
 */
export function isHydrated(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset.hydrated === 'true';
}

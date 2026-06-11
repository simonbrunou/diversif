import { clear } from './queue';

/**
 * Purge client-side storage that may hold the previous user's data after the
 * session ends (explicit logout, « Se déconnecter partout », or expiry).
 *
 * - The PWA service worker's 'pages' runtime cache (vite.config.ts workbox
 *   NetworkFirst, 7-day expiry) holds authenticated HTML — without this, the
 *   next person on a shared device could read the child's data straight out
 *   of CacheStorage. The 'assets' cache is deliberately left alone: it only
 *   holds fingerprinted static files with no personal data, and dropping it
 *   would force a full re-download for nothing.
 * - The offline IndexedDB queue can hold unsent food-log submissions.
 *
 * Strictly best-effort: every failure is swallowed so a flaky CacheStorage or
 * IndexedDB implementation can never break the logout navigation itself —
 * worst case we leave behind what was already there before this existed.
 */
export async function purgeClientState(): Promise<void> {
  try {
    if (typeof caches !== 'undefined') {
      await caches.delete('pages');
    }
  } catch {
    // Best-effort: CacheStorage can be unavailable (private mode, http) or
    // throw on quota/teardown races. Never block the logout navigation.
  }
  try {
    if (typeof indexedDB !== 'undefined') {
      await clear();
    }
  } catch {
    // Same reasoning as above for IndexedDB.
  }
}

/**
 * `onsubmit` handler for the logout forms: purge client state FIRST, then
 * let the native full-document POST proceed via `form.submit()` (which
 * skips this handler, so no recursion).
 *
 * Why not `use:enhance`? The « Se déconnecter » form posts to the
 * `/logout` +server.ts endpoint, which doesn't speak the form-action JSON
 * protocol enhance expects; and the full-document navigation is exactly
 * what we want — the server's `Clear-Site-Data` rides on the 303 and the
 * root layout remounts logged-out. This client-side purge exists because
 * Safari/iOS PWA doesn't honour Clear-Site-Data reliably; on Chromium and
 * Firefox the header would suffice.
 *
 * Without JavaScript the handler never runs and the form submits natively —
 * the server header still covers Chromium/Firefox.
 */
export function purgeBeforeSubmit(event: SubmitEvent): void {
  const form = event.currentTarget as HTMLFormElement;
  event.preventDefault();
  // purgeClientState() never rejects (it swallows its own failures), but
  // `.finally` keeps the submit unconditional even if that invariant breaks.
  void purgeClientState().finally(() => form.submit());
}

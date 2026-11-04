/**
 * The hydration marker, `<html data-hydrated="true">`: the root layout sets it
 * once mounted, and it stays set across client-side navigations (the root
 * layout never unmounts). Only this module reads or writes the attribute.
 * Boot recovery reads it to tell a failed start from a later failure, and
 * FormError to tell a server-rendered alert from one inserted after
 * hydration. The e2e helper awaitHydration waits on the attribute itself.
 *
 * This module imports nothing from the app, so a UI primitive can read the
 * marker without loading boot recovery.
 */

const callbacks: Array<() => void> = [];

/** Marks the app as started: the root layout calls this once, in onMount. */
export function markHydrated(): void {
  document.documentElement.dataset.hydrated = 'true';
  for (const callback of callbacks) callback();
}

/**
 * Runs `callback` when markHydrated runs. A callback registered after that
 * never runs: boot recovery registers at import, which hooks.client.ts does
 * before the root layout mounts.
 */
export function onHydrated(callback: () => void): void {
  callbacks.push(callback);
}

/**
 * Tells whether the root layout has mounted. It returns false on the server
 * and while the client hydrates the server-rendered page, so markup that
 * renders while it returns false came from the server.
 */
export function isHydrated(): boolean {
  return typeof document !== 'undefined' && document.documentElement.dataset.hydrated === 'true';
}

/**
 * Tests only: removes the marker, as a new page load would. It keeps the
 * onHydrated callbacks, because modules register them once, at import.
 */
export function resetHydration(): void {
  delete document.documentElement.dataset.hydrated;
}

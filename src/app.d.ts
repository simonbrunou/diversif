import type { AvailableLanguageTag } from '$lib/paraglide/runtime';
import type { Membership, SafeUser } from '$lib/types';

declare global {
  /**
   * Sentry release SHA inlined at build time by Vite's `define` (see
   * vite.config.ts). Read directly in sentry-init.server.ts and
   * hooks.client.ts instead of the old `process.env.SENTRY_RELEASE` /
   * `$env/dynamic/public PUBLIC_SENTRY_RELEASE` round-trip — that pair
   * required docker-entrypoint.sh to resolve and mirror the SHA at
   * container start, which Railpack-style builders don't run.
   *
   * Empty string when no SHA could be resolved at build time (the
   * resolver in vite.config.ts coalesces `undefined` to `''` so the
   * constant is always JSON-safe). Both call sites coerce `''` to
   * `undefined` before handing it to Sentry.
   */
  const __SENTRY_RELEASE__: string;

  namespace App {
    interface Locals {
      user: SafeUser | null;
      memberships: Membership[];
      sessionId: string | null;
      locale: AvailableLanguageTag;
    }
    // interface PageData {}
    interface Error {
      message: string;
      errorId?: string;
    }
    // interface Platform {}
  }
}

export {};

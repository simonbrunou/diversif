/// <reference types="bun" />
import type { Locale } from '#lib/paraglide/runtime.js';
import type { Membership, SafeUser } from '#lib/types.js';

declare global {
  /**
   * Sentry release SHA inlined at build time by Vite's `define` (see
   * vite.config.ts). Read directly in sentry-init.server.ts and
   * hooks.client.ts instead of the old `process.env.SENTRY_RELEASE` /
   * `$env/dynamic/public PUBLIC_SENTRY_RELEASE` round-trip — that pair
   * required docker-entrypoint.sh to resolve and mirror the SHA at
   * container start, which Railpack-style builders don't run.
   *
   * `undefined` when no SHA could be resolved at build time. vite.config.ts
   * emits either a string literal or the bare `undefined` token so both
   * call sites can pass the constant straight to Sentry without a
   * `|| undefined` fallback (which would be an uncoverable branch).
   */
  const __SENTRY_RELEASE__: string | undefined;

  /**
   * The origin the build was pinned to (ORIGIN at build time, see
   * vite.config.ts), or '' when the server derives it per request from the
   * proxy headers. Only src/lib/server/e2e.ts reads it.
   */
  const __BUILD_ORIGIN__: string;

  namespace App {
    interface Locals {
      user: SafeUser | null;
      memberships: Membership[];
      /**
       * The session's stored id — sha256 of the cookie token, NOT the raw
       * bearer token. Safe to log/compare against DB rows; useless to an
       * attacker. The raw token only ever lives in the cookie.
       */
      sessionId: string | null;
      locale: Locale;
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

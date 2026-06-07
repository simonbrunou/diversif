/// <reference types="bun" />
/// <reference types="vite-plugin-pwa/client" />
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
   * `undefined` when no SHA could be resolved at build time. vite.config.ts
   * emits either a string literal or the bare `undefined` token so both
   * call sites can pass the constant straight to Sentry without a
   * `|| undefined` fallback (which would be an uncoverable branch).
   */
  const __SENTRY_RELEASE__: string | undefined;

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

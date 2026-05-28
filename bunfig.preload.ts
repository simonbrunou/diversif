// Test-process preload: registers a happy-dom global, wires
// @testing-library/jest-dom matchers into bun:test's expect, mocks
// SvelteKit's virtual $app/* modules so server/client code that imports
// from them resolves at test time (the SvelteKit Vite plugin generates
// these at build time; bun test runs outside that build pipeline), and
// installs build-time `define` constants that vite would otherwise inline.

import { GlobalRegistrator } from '@happy-dom/global-registrator';
GlobalRegistrator.register();

// Vite's `define` in vite.config.ts inlines __SENTRY_RELEASE__ as a literal
// at build time. bun test bypasses Vite, so we have to define the global
// ourselves or every server module that reads it ReferenceErrors at import.
(globalThis as { __SENTRY_RELEASE__?: string | undefined }).__SENTRY_RELEASE__ = undefined;

import { expect, mock } from 'bun:test';
import * as matchers from '@testing-library/jest-dom/matchers';
// Cast: jest-dom's matchers are typed for jest/vitest; bun:test's expect is
// jest-API-compatible at runtime, so the extension works at runtime even
// though the type signatures don't match exactly.
expect.extend(matchers as never);

// $app/environment — building/dev/browser flags. In tests we're never in a
// build context and we treat `dev` as true (matches what the dev server
// sets, since tests share most of the dev-mode code paths).
mock.module('$app/environment', () => ({
  browser: false,
  building: false,
  dev: true,
  version: 'test'
}));

// $app/state — Svelte 5 readables of page/navigating/updated. Stub minimal
// shapes; tests that need different values can override with their own
// mock.module() at the top of the file.
mock.module('$app/state', () => ({
  page: {
    url: new URL('http://localhost/'),
    params: {},
    route: { id: null },
    data: {},
    form: null,
    status: 200,
    error: null
  },
  navigating: null,
  updated: { current: false }
}));

mock.module('$app/navigation', () => ({
  goto: async () => {},
  invalidate: async () => {},
  invalidateAll: async () => {},
  preloadData: async () => {},
  preloadCode: async () => {},
  afterNavigate: () => {},
  beforeNavigate: () => {},
  onNavigate: () => {},
  pushState: () => {},
  replaceState: () => {}
}));

mock.module('$app/stores', () => {
  const readable = <T>(v: T) => ({
    subscribe: (fn: (v: T) => void) => {
      fn(v);
      return () => {};
    }
  });
  return {
    page: readable({
      url: new URL('http://localhost/'),
      params: {},
      route: { id: null },
      data: {},
      form: null,
      status: 200,
      error: null
    }),
    navigating: readable(null),
    updated: readable(false),
    getStores: () => ({
      page: readable({}),
      navigating: readable(null),
      updated: readable(false)
    })
  };
});

mock.module('$app/forms', () => ({
  enhance: () => ({ destroy: () => {} }),
  applyAction: async () => {},
  deserialize: <T>(s: string) => JSON.parse(s) as T
}));

mock.module('$app/paths', () => ({
  base: '',
  assets: '',
  resolveRoute: (id: string, params?: Record<string, string>) => {
    if (!params) return id;
    return Object.entries(params).reduce((acc, [k, v]) => acc.replace(`[${k}]`, v), id);
  }
}));

// Redirect prod DB to the PGlite test instance for every test in the suite.
// Without this, transitive imports of any module that pulls in
// $lib/server/db (auth, gdpr, passkeys, idempotency, the route action
// handlers …) trigger the top-level await migrate() against a real Postgres
// at DATABASE_URL — which doesn't exist in test runs. Individual test files
// can override this with their own mock.module call; the LAST registration
// for a given path wins.
import { testDb, schema } from './src/test/db';
mock.module('$lib/server/db', () => ({
  db: testDb,
  schema,
  // pool is exported for the shutdown handler; tests don't need it but
  // shipping a structural stub keeps imports that destructure it from
  // ReferenceError-ing.
  pool: {
    end: async () => {}
  }
}));

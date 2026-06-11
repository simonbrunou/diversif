// Test-process preload: registers a happy-dom global, wires
// @testing-library/jest-dom matchers into bun:test's expect, mocks
// SvelteKit's virtual $app/* modules so server/client code that imports
// from them resolves at test time (the SvelteKit Vite plugin generates
// these at build time; bun test runs outside that build pipeline), and
// installs build-time `define` constants that vite would otherwise inline.

import { GlobalRegistrator } from '@happy-dom/global-registrator';
// A real base URL matters since paraglide 2.x: localizeHref() resolves
// against window.location.href, and `new URL(path, 'about:blank')` throws.
GlobalRegistrator.register({ url: 'http://localhost/' });

// Svelte compilation loader lives in svelte-loader.preload.ts (listed first
// in bunfig.toml) so it's active before this file's imports run.

// Vite's `define` in vite.config.ts inlines __SENTRY_RELEASE__ as a literal
// at build time. bun test bypasses Vite, so we have to define the global
// ourselves or every server module that reads it ReferenceErrors at import.
(globalThis as { __SENTRY_RELEASE__?: string | undefined }).__SENTRY_RELEASE__ = undefined;

import { afterAll, afterEach, expect, mock, setSystemTime } from 'bun:test';
import * as matchers from '@testing-library/jest-dom/matchers';
import { unstubAllGlobals } from './src/test/bun-test-utils';
// Cast: jest-dom's matchers are typed for jest/vitest; bun:test's expect is
// jest-API-compatible at runtime, so the extension works at runtime even
// though the type signatures don't match exactly.
expect.extend(matchers as never);

// Belt-and-braces reset between tests so cross-file state doesn't leak.
// setSystemTime(null) returns the clock to real time (vitest had this
// behaviour implicit via the per-test fake-timer context; bun:test does
// not). unstubAllGlobals() restores any window/document/etc. that a test
// replaced via the stubGlobal helper. We also clear the document body —
// @testing-library/svelte's cleanup() is the obvious choice but importing
// it from this preload tears down happy-dom (its module init touches a
// global that GlobalRegistrator is mid-setting-up), so we use a manual
// equivalent: empty body innerHTML between tests.
afterEach(() => {
  if (typeof document !== 'undefined') {
    document.body.innerHTML = '';
  }
  setSystemTime(null);
  unstubAllGlobals();
  // mock.restore() restores all spyOn-created mocks to their originals. Tests
  // that spy on shared singletons (testDb.delete, the cleanup setInterval,
  // etc.) need this to avoid the spy leaking into the next file's test.
  mock.restore();
});

// Default mocks for SvelteKit virtual modules. Kept in a helper so we can
// re-apply between test FILES (afterAll) — bun:test's mock.module is
// process-global, so a file that overrides one of these leaks the override
// into every subsequent file. afterAll restores defaults at file boundary.
function applyDefaultAppMocks(): void {
  // $app/environment — building/dev/browser flags. In tests we're never in
  // a build context and we treat `dev` as true.
  mock.module('$app/environment', () => ({
    browser: false,
    building: false,
    dev: true,
    version: 'test'
  }));

  // $app/state — Svelte 5 readables of page/navigating/updated. Stub
  // minimal shapes; tests that need different values can override with
  // their own mock.module() at the top of the file (and afterAll restores
  // these defaults so the next file isn't polluted).
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
}

applyDefaultAppMocks();

// Restore defaults at file boundary (after the last test in each file).
// afterAll registered in the preload runs after every test file completes.
afterAll(() => {
  applyDefaultAppMocks();
});

// Redirect prod DB to the in-memory bun:sqlite test instance for every test in
// the suite. Without this, transitive imports of any module that pulls in
// $lib/server/db (auth, gdpr, passkeys, idempotency, the route action
// handlers …) would run the module's migrate()/seed against a DATABASE_PATH
// file that test runs don't provide. Individual test files can override this
// with their own mock.module call; the LAST registration for a given path wins.
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

// Capture the REAL paraglide runtime exports BEFORE any test file's
// mock.module replaces them. Test files that mock '$lib/paraglide/runtime'
// (LocaleSwitcher.test.ts, hooks.server.test.ts) would otherwise leak
// their mocked runtime across the suite — bun:test's mock.module is
// process-global and there's no per-file isolation. After each file we
// restore the real exports so a clean default is in place for the next
// file (and any overwriteGetLocale-based test works against the real runtime).
import * as actualParaglide from '$lib/paraglide/runtime';

// Default test locale. Without this, every message call resolves the locale
// through the runtime's strategy chain — and because happy-dom registers a
// global `window`, the URL strategy fires against the fake test location and
// throws ("No locale found" / localizeUrl on about:blank). The override
// keeps the default's AsyncLocalStorage-first chain (paraglideMiddleware
// tests depend on per-request isolation) and only replaces the strategy
// fallback with 'fr'. Tests needing another ambient locale call
// overwriteGetLocale themselves; per-file processes reset to this default.
actualParaglide.overwriteGetLocale(
  () => actualParaglide.serverAsyncLocalStorage?.getStore()?.locale ?? 'fr'
);
actualParaglide.overwriteSetLocale(() => {});

function restoreParaglide(): void {
  mock.module('$lib/paraglide/runtime', () => actualParaglide);
}

afterAll(() => {
  restoreParaglide();
});

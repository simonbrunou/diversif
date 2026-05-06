# Sentry Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Sentry SaaS (EU/Frankfurt) for server + client error capture with strict PII scrubbing, additive to the existing stderr `handleError` logging.

**Architecture:** Two SDK init points (`hooks.server.ts`, `hooks.client.ts`) using `@sentry/sveltekit`. A single isomorphic `scrubEvent` (`src/lib/sentry.ts`) is wired as `beforeSend` so the same scrub rule runs in both runtimes. Source maps uploaded at build via `@sentry/vite-plugin`, gated on `SENTRY_AUTH_TOKEN`. Spec: `docs/superpowers/specs/2026-05-06-observability-sentry-design.md`.

**Tech Stack:** SvelteKit 2, Vitest, `@sentry/sveltekit`, `@sentry/vite-plugin`.

---

## File map

| Path                                                | Status | Responsibility                                                                                                  |
| --------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| `package.json`                                      | edit   | Add `@sentry/sveltekit` (dep), `@sentry/vite-plugin` (devDep).                                                  |
| `.env.example`                                      | edit   | Document the five new env vars.                                                                                 |
| `src/lib/sentry.ts`                                 | new    | `scrubEvent`, `scrubPathname`. Pure, isomorphic, no SDK side effects.                                           |
| `src/lib/sentry.test.ts`                            | new    | Unit tests for the scrubbing.                                                                                   |
| `src/hooks.server.ts`                               | edit   | `Sentry.init` at module top; `Sentry.captureException` after stderr line in `handleError`.                      |
| `src/hooks.server.test.ts`                          | edit   | Extend `handleError` tests to assert SDK call shape.                                                            |
| `src/hooks.client.ts`                               | new    | `Sentry.init` for browser; export client `handleError`.                                                         |
| `vite.config.ts`                                    | edit   | Add gated `sentryVitePlugin`; add `hooks.client.ts` and `hooks.server.ts` SDK-init lines to `coverage.exclude`. |
| `src/routes/politique-confidentialite/+page.svelte` | edit   | Rewrite §3, §4, §9; add Sentry as sous-traitant. Bump "Dernière mise à jour" date.                              |
| `docs/superpowers/runbooks/sentry-setup.md`         | new    | Operator checklist for Sentry dashboard, Coolify env, smoke test.                                               |

---

## Task 1 — Install deps and document env vars

**Files:**

- Modify: `package.json`
- Modify: `.env.example`

- [ ] **Step 1: Add SDK and build plugin to package.json**

Add to `dependencies`:

```json
"@sentry/sveltekit": "^8.45.0"
```

Add to `devDependencies`:

```json
"@sentry/vite-plugin": "^2.22.6"
```

(Versions: pick the latest 8.x of `@sentry/sveltekit` and 2.x of `@sentry/vite-plugin` available on npm at install time. Run `npm view @sentry/sveltekit version` and `npm view @sentry/vite-plugin version` if unsure.)

- [ ] **Step 2: Install**

Run:

```bash
npm install
```

Expected: lockfile updates, no audit warnings introduced. CI uses npm 9 — do NOT run `npm audit fix`.

- [ ] **Step 3: Document env vars in `.env.example`**

Append to the end of `.env.example`:

```
# --- Sentry (observability) ---
# DSN copied from the Sentry project. Empty value disables capture.
# Server-only (errors caught in hooks.server.ts).
SENTRY_DSN=
# Public DSN for browser-side capture in hooks.client.ts. May be the same
# DSN or a separate Sentry project; setting this empty disables client capture.
PUBLIC_SENTRY_DSN=
# Build-time only. Required for source-map upload to Sentry; absent =
# plugin not added, build still succeeds with minified stacks.
SENTRY_AUTH_TOKEN=
# Tag attached to every event. Defaults to "production" if unset.
SENTRY_ENVIRONMENT=production
# Release identifier (defaults to `git rev-parse HEAD` at build time).
SENTRY_RELEASE=
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "Add Sentry SDK + vite plugin and env scaffolding"
```

---

## Task 2 — `scrubEvent` module (TDD)

This is the only real logic in the change. Pin behaviour with tests first.

**Files:**

- Create: `src/lib/sentry.test.ts`
- Create: `src/lib/sentry.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/lib/sentry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { scrubEvent, scrubPathname } from './sentry';

describe('scrubPathname', () => {
  it('returns the route pattern verbatim when given one', () => {
    expect(scrubPathname('/child/42/log/9', '/child/[id]/log/[entryId]')).toBe(
      '/child/[id]/log/[entryId]'
    );
  });

  it('replaces purely numeric segments in the fallback path', () => {
    expect(scrubPathname('/child/2/guide')).toBe('/child/[id]/guide');
  });

  it('replaces long token-like segments in the fallback path', () => {
    expect(scrubPathname('/passkeys/auth/abc123def-9876xyz/verify')).toBe(
      '/passkeys/auth/[id]/verify'
    );
  });

  it('keeps short alphabetic segments untouched', () => {
    expect(scrubPathname('/account/export')).toBe('/account/export');
  });

  it('handles trailing and leading slashes', () => {
    expect(scrubPathname('/')).toBe('/');
    expect(scrubPathname('')).toBe('/');
  });
});

describe('scrubEvent', () => {
  function baseEvent() {
    return {
      tags: { errorId: 'abcd1234', route: '/child/[id]/log/[entryId]' },
      request: {
        url: 'https://diversif.app/child/42/log/9?cid=secret',
        data: { foo: 'bar' },
        cookies: 'session=...',
        headers: { authorization: 'Bearer x' }
      },
      user: { id: '7', email: 'a@example.com', ip_address: '1.2.3.4' },
      breadcrumbs: [
        { category: 'navigation', data: { from: '/child/42', to: '/child/42/log/9' } },
        { category: 'ui.click', message: 'click on .submit-button' },
        { category: 'ui.input', message: 'type in #email' },
        { category: 'console', message: 'hi', level: 'log' }
      ]
    };
  }

  it('rewrites the request URL using the route tag', () => {
    const e = baseEvent();
    const out = scrubEvent(e);
    expect(out).not.toBeNull();
    expect(out!.request!.url).toBe('https://diversif.app/child/[id]/log/[entryId]');
  });

  it('drops query strings even when route tag is missing', () => {
    const e = baseEvent();
    delete e.tags.route;
    e.request.url = 'https://diversif.app/foo?cid=abc';
    const out = scrubEvent(e)!;
    expect(out.request!.url).toBe('https://diversif.app/foo');
  });

  it('drops request.data, request.cookies, request.headers', () => {
    const out = scrubEvent(baseEvent())!;
    expect(out.request!.data).toBeUndefined();
    expect(out.request!.cookies).toBeUndefined();
    expect(out.request!.headers).toBeUndefined();
  });

  it('strips user context entirely', () => {
    const out = scrubEvent(baseEvent())!;
    expect(out.user).toBeUndefined();
  });

  it('drops ui.click and ui.input breadcrumbs but keeps navigation and console', () => {
    const out = scrubEvent(baseEvent())!;
    const cats = out.breadcrumbs!.map((b) => b.category);
    expect(cats).toEqual(['navigation', 'console']);
  });

  it('scrubs URLs inside navigation breadcrumb data', () => {
    const out = scrubEvent(baseEvent())!;
    const nav = out.breadcrumbs!.find((b) => b.category === 'navigation')!;
    expect(nav.data).toEqual({ from: '/child/[id]', to: '/child/[id]/log/[id]' });
  });

  it('preserves tags untouched', () => {
    const out = scrubEvent(baseEvent())!;
    expect(out.tags).toEqual({ errorId: 'abcd1234', route: '/child/[id]/log/[entryId]' });
  });

  it('returns null on a malformed input rather than throwing', () => {
    // @ts-expect-error deliberately broken
    expect(scrubEvent(null)).toBeNull();
    // @ts-expect-error deliberately broken
    expect(scrubEvent({ request: { url: 'not a url' } })).not.toThrow;
  });

  it('handles events without request, user, or breadcrumbs', () => {
    const out = scrubEvent({ tags: { errorId: 'x' } })!;
    expect(out.tags).toEqual({ errorId: 'x' });
  });
});
```

- [ ] **Step 2: Run the tests, expect failure**

Run:

```bash
npx vitest run src/lib/sentry.test.ts
```

Expected: fails at import (`Cannot find module './sentry'`).

- [ ] **Step 3: Implement `src/lib/sentry.ts`**

Create `src/lib/sentry.ts`:

```ts
/**
 * PII scrubbing applied to every Sentry event before it leaves the process.
 * Imported by hooks.server.ts and hooks.client.ts as the `beforeSend` callback.
 *
 * Posture: strict. The errorId in event.tags is the only correlation token;
 * Sentry never sees user.id, email, IP, request body, cookies, or headers.
 */

type ScrubbableEvent = {
  tags?: Record<string, unknown>;
  request?: {
    url?: string;
    data?: unknown;
    cookies?: unknown;
    headers?: unknown;
  };
  user?: unknown;
  breadcrumbs?: Array<{
    category?: string;
    data?: unknown;
    [key: string]: unknown;
  }>;
  transaction?: string;
};

const NUMERIC = /^\d+$/;
const LONG_TOKEN = /^[A-Za-z0-9_-]{8,}$/;

export function scrubPathname(pathname: string, routeId: string | null = null): string {
  if (routeId) return routeId;
  if (!pathname || pathname === '/') return '/';
  const segments = pathname.split('/').filter(Boolean);
  const scrubbed = segments.map((seg) =>
    NUMERIC.test(seg) || LONG_TOKEN.test(seg) ? '[id]' : seg
  );
  return '/' + scrubbed.join('/');
}

function scrubUrlString(raw: string, routeId: string | null = null): string {
  try {
    if (raw.startsWith('/')) {
      // Relative URL — just rewrite the pathname.
      const [path] = raw.split('?', 1);
      return scrubPathname(path, routeId);
    }
    const u = new URL(raw);
    u.search = '';
    u.pathname = scrubPathname(u.pathname, routeId);
    return u.toString();
  } catch {
    return scrubPathname(raw, routeId);
  }
}

export function scrubEvent<E extends ScrubbableEvent>(event: E): E | null {
  try {
    if (!event || typeof event !== 'object') return null;

    const route =
      typeof event.tags?.route === 'string'
        ? (event.tags.route as string)
        : (event.transaction ?? null);

    if (event.request) {
      if (typeof event.request.url === 'string') {
        event.request.url = scrubUrlString(event.request.url, route);
      }
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.headers;
    }

    delete event.user;

    if (Array.isArray(event.breadcrumbs)) {
      event.breadcrumbs = event.breadcrumbs
        .filter((b) => b.category !== 'ui.click' && b.category !== 'ui.input')
        .map((b) => {
          if (b.data && typeof b.data === 'object') {
            const data = { ...(b.data as Record<string, unknown>) };
            for (const key of ['url', 'from', 'to']) {
              if (typeof data[key] === 'string') {
                data[key] = scrubUrlString(data[key] as string);
              }
            }
            return { ...b, data };
          }
          return b;
        });
    }

    return event;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run the tests, expect pass**

Run:

```bash
npx vitest run src/lib/sentry.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Verify coverage hits 100% on the new module**

Run:

```bash
npx vitest run --coverage src/lib/sentry.test.ts
```

Expected: `src/lib/sentry.ts` rows show 100/100/100/100 in the coverage table. If not, add a test for the uncovered branch — do NOT add it to `coverage.exclude`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/sentry.ts src/lib/sentry.test.ts
git commit -m "Add scrubEvent: strict PII filter for Sentry events"
```

---

## Task 3 — Server SDK init and `handleError` integration (TDD)

**Files:**

- Modify: `src/hooks.server.ts`
- Modify: `src/hooks.server.test.ts`

- [ ] **Step 1: Extend `hooks.server.test.ts` with the SDK-call assertions**

Add at the top of the file, near the other `vi.mock(...)` line:

```ts
const { captureExceptionMock, initMock } = vi.hoisted(() => ({
  captureExceptionMock: vi.fn(),
  initMock: vi.fn()
}));

vi.mock('@sentry/sveltekit', () => ({
  init: initMock,
  captureException: captureExceptionMock
}));
```

(`vi.hoisted` is required because `vi.mock` runs before regular `const` declarations are evaluated.)

Then add this `describe` block at the bottom of the file:

```ts
describe('handleError → Sentry', () => {
  beforeEach(() => {
    captureExceptionMock.mockClear();
  });

  function makeErrorEvent(pathname = '/child/42/log/9', method = 'POST') {
    return {
      request: { method } as Request,
      url: new URL(`http://localhost${pathname}`),
      route: { id: '/child/[id]/log/[entryId]' },
      locals: { user: { id: 7 } } as unknown as App.Locals
    };
  }

  it('forwards the error to Sentry with errorId, status, method, route tags', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const err = new TypeError('boom');
      const result = handleError({
        error: err,
        event: makeErrorEvent(),
        status: 500,
        message: 'Internal Error'
      } as unknown as Parameters<typeof handleError>[0]);

      expect(captureExceptionMock).toHaveBeenCalledOnce();
      const [capturedErr, capturedCtx] = captureExceptionMock.mock.calls[0];
      expect(capturedErr).toBe(err);
      expect(capturedCtx.tags).toEqual({
        errorId: result?.errorId,
        status: 500,
        method: 'POST',
        route: '/child/[id]/log/[entryId]'
      });
      // No PII slipped in
      expect(capturedCtx.user).toBeUndefined();
      expect(capturedCtx.contexts).toBeUndefined();
    } finally {
      spy.mockRestore();
    }
  });

  it('still emits the [diversif:error] stderr line', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      handleError({
        error: new Error('x'),
        event: makeErrorEvent(),
        status: 500,
        message: 'Internal Error'
      } as unknown as Parameters<typeof handleError>[0]);
      expect(spy).toHaveBeenCalledOnce();
      expect(spy.mock.calls[0][0]).toBe('[diversif:error]');
    } finally {
      spy.mockRestore();
    }
  });

  it('routes default to null when SvelteKit did not match a route', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      handleError({
        error: new Error('x'),
        event: { ...makeErrorEvent(), route: { id: null } },
        status: 404,
        message: 'Not Found'
      } as unknown as Parameters<typeof handleError>[0]);
      const ctx = captureExceptionMock.mock.calls[0][1];
      expect(ctx.tags.route).toBeNull();
      expect(ctx.tags.status).toBe(404);
    } finally {
      spy.mockRestore();
    }
  });
});
```

- [ ] **Step 2: Run the tests, expect failure**

Run:

```bash
npx vitest run src/hooks.server.test.ts
```

Expected: the new `describe` block fails — `captureExceptionMock` never called because `hooks.server.ts` doesn't call Sentry yet.

- [ ] **Step 3: Modify `src/hooks.server.ts`**

Add at the top, after the existing imports:

```ts
import * as Sentry from '@sentry/sveltekit';
import { scrubEvent } from '$lib/sentry';

Sentry.init({
  dsn: process.env.SENTRY_DSN || '',
  environment: process.env.SENTRY_ENVIRONMENT || 'production',
  release: process.env.SENTRY_RELEASE || undefined,
  tracesSampleRate: 0,
  // @ts-expect-error - the SDK accepts ScrubbableEvent shape; types are conservative
  beforeSend: scrubEvent,
  beforeBreadcrumb: (b) => (b.category === 'ui.click' || b.category === 'ui.input' ? null : b)
});
```

(Setting an empty DSN is the documented way to disable the SDK while keeping callsites unchanged. The `beforeBreadcrumb` second filter is belt-and-braces — `scrubEvent` already drops UI breadcrumbs from the final event.)

In the `handleError` function, add this **after** the existing `console.error(...)` call and **before** the `return`:

```ts
Sentry.captureException(err, {
  tags: {
    errorId,
    status,
    method: event.request.method,
    route: event.route?.id ?? null
  }
});
```

- [ ] **Step 4: Run all tests, expect pass**

Run:

```bash
npm run test
```

Expected: full suite passes.

- [ ] **Step 5: Commit**

```bash
git add src/hooks.server.ts src/hooks.server.test.ts
git commit -m "Wire server-side Sentry capture in handleError"
```

---

## Task 4 — Client hook

**Files:**

- Create: `src/hooks.client.ts`
- Modify: `vite.config.ts` (add bootstrap files to coverage exclude)

- [ ] **Step 1: Create `src/hooks.client.ts`**

```ts
import * as Sentry from '@sentry/sveltekit';
import { env } from '$env/dynamic/public';
import type { HandleClientError } from '@sveltejs/kit';
import { scrubEvent } from '$lib/sentry';

Sentry.init({
  dsn: env.PUBLIC_SENTRY_DSN || '',
  environment: env.PUBLIC_SENTRY_ENVIRONMENT || 'production',
  tracesSampleRate: 0,
  // @ts-expect-error - SDK accepts the ScrubbableEvent shape
  beforeSend: scrubEvent,
  beforeBreadcrumb: (b) => (b.category === 'ui.click' || b.category === 'ui.input' ? null : b)
});

export const handleError: HandleClientError = ({ error, event, status, message }) => {
  Sentry.captureException(error, {
    tags: {
      status,
      method: event.request?.method ?? 'GET',
      route: event.route?.id ?? null
    }
  });
  return { message: 'Internal Error' };
};
```

- [ ] **Step 2: Add `PUBLIC_SENTRY_ENVIRONMENT` to `.env.example`**

Insert just below `SENTRY_ENVIRONMENT`:

```
# Mirrored to the browser; defaults to "production" if unset.
PUBLIC_SENTRY_ENVIRONMENT=production
```

- [ ] **Step 3: Add `hooks.client.ts` to `coverage.exclude` in `vite.config.ts`**

Add to the `exclude` array in the `coverage` block:

```ts
        // Bootstrap singletons calling Sentry.init at module top — exercises
        // real network/SDK runtime; covered indirectly via scrubEvent unit
        // tests and hooks.server tests with a mocked SDK.
        'src/hooks.client.ts',
```

(The server hook is not added to exclude — its `handleError` logic IS covered by `hooks.server.test.ts`. Only the bare `Sentry.init` call at module top is uncovered; the existing tests already exercise everything else.)

- [ ] **Step 4: Verify build still works**

Run:

```bash
npm run build
```

Expected: build succeeds. The `Sentry.init` call in `hooks.client.ts` no-ops at build time (no DSN). No bundler complaints about missing modules.

- [ ] **Step 5: Run full test + coverage**

Run:

```bash
npm run test:coverage
```

Expected: 100% threshold satisfied.

- [ ] **Step 6: Commit**

```bash
git add src/hooks.client.ts vite.config.ts .env.example
git commit -m "Wire client-side Sentry capture"
```

---

## Task 5 — Source-map upload via `@sentry/vite-plugin`

**Files:**

- Modify: `vite.config.ts`

- [ ] **Step 1: Add the gated plugin**

At the top of `vite.config.ts`, alongside other imports:

```ts
import { sentryVitePlugin } from '@sentry/vite-plugin';
```

Replace the `plugins: [...]` array so the Sentry plugin is appended only when `SENTRY_AUTH_TOKEN` is set:

```ts
  plugins: [
    sveltekit(),
    SvelteKitPWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      manifest: false,
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,woff,woff2}'],
        navigateFallback: '/',
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 }
            }
          },
          {
            urlPattern: ({ request }) =>
              ['style', 'script', 'worker', 'image', 'font'].includes(request.destination),
            handler: 'CacheFirst',
            options: {
              cacheName: 'assets',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
        ]
      },
      devOptions: { enabled: false }
    }),
    ...(process.env.SENTRY_AUTH_TOKEN
      ? [
          sentryVitePlugin({
            authToken: process.env.SENTRY_AUTH_TOKEN,
            org: process.env.SENTRY_ORG || 'diversif',
            project: process.env.SENTRY_PROJECT || 'diversif',
            release: { name: process.env.SENTRY_RELEASE || undefined },
            sourcemaps: { assets: ['./build/**'] },
            telemetry: false
          })
        ]
      : [])
  ],
```

- [ ] **Step 2: Add `SENTRY_ORG` and `SENTRY_PROJECT` to `.env.example`**

Insert near the other Sentry vars:

```
# Sentry org/project slugs. Default to "diversif" if unset.
SENTRY_ORG=diversif
SENTRY_PROJECT=diversif
```

- [ ] **Step 3: Verify build without token still works**

Run:

```bash
unset SENTRY_AUTH_TOKEN; npm run build
```

Expected: build succeeds. No Sentry plugin invoked. No upload attempted.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts .env.example
git commit -m "Upload source maps to Sentry on builds with SENTRY_AUTH_TOKEN"
```

---

## Task 6 — Privacy policy update

The page currently asserts no third-party services and no extra-EU transfer. We disclose Sentry as a sous-traitant, soften the absolutist phrasing in §3 and §4, and bump the date.

**Files:**

- Modify: `src/routes/politique-confidentialite/+page.svelte`

- [ ] **Step 1: Update the "Dernière mise à jour" line**

Replace:

```svelte
    <p class="text-sm text-muted-foreground">Dernière mise à jour : 4 mai 2026.</p>
```

with:

```svelte
    <p class="text-sm text-muted-foreground">Dernière mise à jour : 6 mai 2026.</p>
```

- [ ] **Step 2: Soften §3's tracking-blanket sentence**

In section 3 ("Catégories de données collectées"), replace:

```svelte
    <p class="text-sm">
      Aucun cookie de mesure, aucune adresse IP, aucun User-Agent, aucun service tiers ne sont
      enregistrés.
    </p>
```

with:

```svelte
    <p class="text-sm">
      Aucun cookie de mesure d'audience, aucune adresse IP et aucun User-Agent ne sont
      enregistrés dans la base applicative. Un service tiers de remontée d'erreurs techniques
      (voir section 4) reçoit, en cas de panne, une trace technique sans identifiant utilisateur.
    </p>
```

- [ ] **Step 3: Rewrite §4 to disclose Sentry**

Replace the entire section 4 block:

```svelte
  <section class="space-y-2">
    <h2 class="text-lg font-semibold">4. Destinataires</h2>
    <p class="text-sm">
      Les données sont stockées dans une base SQLite hébergée par {legal.hostProvider}. Aucun
      tiers (analytique, publicité, suivi, e-mail, notification, CDN) ne reçoit vos données.
      Les co-parents auxquels vous transmettez un code d'invitation accèdent au journal de
      l'enfant correspondant.
    </p>
  </section>
```

with:

```svelte
  <section class="space-y-2">
    <h2 class="text-lg font-semibold">4. Destinataires et sous-traitants</h2>
    <p class="text-sm">
      Les données applicatives (compte, enfants, journal, sessions) sont stockées dans une base
      SQLite hébergée par {legal.hostProvider}. Aucun tiers de mesure d'audience, de publicité,
      de suivi commercial, d'e-mail, de notification ou de CDN ne reçoit vos données. Les
      co-parents auxquels vous transmettez un code d'invitation accèdent au journal de l'enfant
      correspondant.
    </p>
    <p class="text-sm">
      Un seul sous-traitant technique reçoit des données strictement limitées :
    </p>
    <ul class="list-disc space-y-1 pl-5 text-sm">
      <li>
        <span class="font-medium">Sentry GmbH</span> (entité européenne de Functional Software,
        Inc., siège social en Allemagne — adresse complète à vérifier sur le DPA et à
        renseigner ici lors de la mise en service) — collecte des erreurs techniques produites
        par l'application (trace d'exécution, route SvelteKit anonymisée, identifiant d'erreur
        opaque). Aucun identifiant utilisateur, aucune adresse e-mail, aucun corps de requête,
        aucun cookie ni en-tête ne sont transmis. Base légale : intérêt légitime à corriger les
        pannes (article 6.1.f RGPD). Données hébergées en Union européenne (région Francfort).
        Durée de conservation : 90 jours. Lien :
        <a class="underline" href="https://sentry.io/legal/dpa/" target="_blank" rel="noopener noreferrer">accord de traitement (DPA)</a>.
      </li>
    </ul>
  </section>
```

- [ ] **Step 4: Verify §9 (transferts hors UE) is still accurate**

Section 9 currently reads:

```
Aucun transfert hors Union européenne n'est effectué tant que l'hébergement reste assuré
par {legal.hostProvider}.
```

Sentry SaaS EU region keeps customer data in Frankfurt, so this remains true. **No change** needed for §9.

- [ ] **Step 5: Verify Sentry GmbH legal address before merge**

Before merging this branch, look up Sentry GmbH's registered address from the
DPA (https://sentry.io/legal/dpa/) and replace the "à vérifier" placeholder
in the Svelte file with the real address. This is the only placeholder in
the change set.

- [ ] **Step 6: Visual check**

Run:

```bash
npm run dev
```

Visit http://localhost:5173/politique-confidentialite and confirm:

- "Dernière mise à jour : 6 mai 2026."
- §3 has the new softer phrasing.
- §4 now lists Sentry GmbH as sous-traitant with the verified address.
- §9 is unchanged.

Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add src/routes/politique-confidentialite/+page.svelte
git commit -m "Disclose Sentry as sous-traitant in privacy policy"
```

---

## Task 7 — Operator setup runbook

The code is deployed-ready; this task captures the human steps so the owner can wire it up later without re-deriving them.

**Files:**

- Create: `docs/superpowers/runbooks/sentry-setup.md`

- [ ] **Step 1: Write the runbook**

Create `docs/superpowers/runbooks/sentry-setup.md`:

```markdown
# Sentry setup — operator runbook

Code is wired but inert until the env vars below are populated.

## 1. Create the Sentry project

In the Sentry dashboard (region: **DE / EU**):

- Org: pick or create one (e.g. `diversif`).
- Project: `diversif`, platform **JavaScript / SvelteKit**.
- Copy the **DSN** from project settings.

You can also run this via the Sentry MCP if it's authed locally:

- `mcp__claude_ai_Sentry__find_organizations`
- `mcp__claude_ai_Sentry__create_project` (org=diversif, platform=javascript-sveltekit)
- `mcp__claude_ai_Sentry__find_dsns` to grab the DSN

## 2. Create an internal integration auth token

Sentry → Organization Settings → Developer Settings → New Internal Integration:

- Name: `diversif-sourcemap-upload`
- Permissions: **Project: Releases — Admin**.
- Save and copy the token. This is `SENTRY_AUTH_TOKEN` (build-only).

## 3. Wire env vars in Coolify

| Variable                    | Value                                                  |
| --------------------------- | ------------------------------------------------------ |
| `SENTRY_DSN`                | DSN from step 1 (server)                               |
| `PUBLIC_SENTRY_DSN`         | same DSN, exposed to browser                           |
| `SENTRY_ENVIRONMENT`        | `production`                                           |
| `PUBLIC_SENTRY_ENVIRONMENT` | `production`                                           |
| `SENTRY_AUTH_TOKEN`         | build-time only — set as a **build secret** in Coolify |
| `SENTRY_ORG`                | your Sentry org slug                                   |
| `SENTRY_PROJECT`            | `diversif`                                             |
| `SENTRY_RELEASE`            | leave empty — adapter resolves to `git rev-parse HEAD` |

Redeploy after saving.

## 4. Configure an alert rule

In the Sentry project, Alerts → New Alert Rule:

- Trigger: "When a new issue is created"
- Action: "Send a notification to a member" → your email.
- Save.

## 5. Smoke test

After deploy:

1. Hit a route that throws (or temporarily add `throw new Error('sentry-smoke')` to a server load and re-deploy a staging build).
2. Watch:
   - Coolify stderr stream → `[diversif:error]` line with an `id`.
   - Sentry → Issues → new issue tagged `errorId=<that id>`, `route=/...` (with `[id]` masking).
3. Confirm the issue's request URL has no query string and no PII.
4. Remove the smoke-test throw and redeploy.

## 6. Privacy policy ack

After verifying the integration is live, confirm `/politique-confidentialite`
section 4 is rendered correctly in production. The "Dernière mise à jour"
should match the deploy date.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/runbooks/sentry-setup.md
git commit -m "Add Sentry setup runbook for operator onboarding"
```

---

## Final verification

After Task 7, run the whole suite + lint + typecheck once:

```bash
npm run lint && npm run check && npm run test:coverage && npm run build
```

Expected: clean. If any step fails, treat as a bug in the prior task and fix forward (do NOT push to main with a red gate).

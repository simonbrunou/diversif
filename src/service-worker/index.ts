import { version } from '$app/env';
import { assets, immutable, prerendered } from '$app/manifest';
import { self } from '$app/service-worker';
import { ExpirationPlugin } from 'workbox-expiration';
import {
  PrecacheFallbackPlugin,
  cleanupOutdatedCaches,
  precacheAndRoute
} from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, NetworkOnly } from 'workbox-strategies';

// Registered by src/lib/components/ReloadPrompt.svelte (production only), which
// also owns the update prompt: a new worker waits until the parent accepts the
// « Nouvelle version disponible » toast, which posts SKIP_WAITING.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') void self.skipWaiting();
});

// Code, styles, fonts and images. The web manifest, robots.txt and
// sitemap.xml stay network-only, like every other request not routed below.
const PRECACHED_FILE = /\.(?:js|css|ico|png|svg|webp|woff2?)$/;
// The prerendered /offline fallback page (FR and EN) and its __data.json,
// without the prerendered robots.txt and sitemap.xml.
const PRERENDERED_PAGE = /(?:^|\/)(?:[^./]+|__data\.json)$/;

precacheAndRoute([
  // Content-hashed by Vite: the URL changes whenever the file does.
  ...immutable
    .filter(({ path }) => PRECACHED_FILE.test(path))
    .map(({ path }) => ({ url: `/${path}`, revision: null })),
  // Not hashed: the build version invalidates them on every deploy.
  ...assets
    .filter(({ path }) => PRECACHED_FILE.test(path))
    .map(({ path }) => ({ url: `/${path}`, revision: version })),
  ...prerendered
    .filter(({ path }) => PRERENDERED_PAGE.test(path))
    .map(({ path }) => ({ url: `/${path}`, revision: version }))
]);
cleanupOutdatedCaches();

// Routes gated by requireUser()/requireChildContext() (see
// src/lib/server/guards.ts) — their rendered HTML embeds session-specific
// data (child health records under /child, account settings under /account,
// invite/child names under /join) and must never be written to CacheStorage,
// or a later visitor on a shared/offline device could read a previous user's
// data straight out of the cache with no session check. Covers both the bare
// path and its /en/ localized counterpart (see paraglide.config.ts
// urlPatterns).
const SESSION_GATED_PATH = /^\/(en\/)?(child|account|join)(\/|$)/;

// The /offline page is served per-route by PrecacheFallbackPlugin (a
// handlerDidError hook), which only kicks in once the matched strategy itself
// has failed (network down + nothing cached). A global NavigationRoute
// fallback would answer every navigation, online or offline, and break this
// SSR app's normal routing — see e2e/offline.spec.ts.
const offlineFallback = new PrecacheFallbackPlugin({ fallbackURL: '/offline' });

// /child, /account, /join render session-specific HTML: never cached (see
// SESSION_GATED_PATH), but still offered the offline fallback.
registerRoute(
  ({ request, url }) => request.mode === 'navigate' && SESSION_GATED_PATH.test(url.pathname),
  new NetworkOnly({ plugins: [offlineFallback] })
);

// Everything else navigable (landing, guide, login, etc.) — no per-user
// secrets, safe to keep available offline.
registerRoute(
  ({ request }) => request.mode === 'navigate',
  new NetworkFirst({
    cacheName: 'pages',
    networkTimeoutSeconds: 3,
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 }),
      offlineFallback,
      // Authoritative session gate: hooks.server.ts stamps
      // `Cache-Control: no-store` on EVERY authenticated response (driven by
      // locals.user, not a route list), so refuse to write any such response
      // to CacheStorage. This catches routes the SESSION_GATED_PATH deny-list
      // above can't — notably `/` and `/en`, which render the multi-child
      // picker (names/ages/roles) for signed-in users — and any future
      // authenticated route, with no regex to maintain. Workbox's
      // NetworkFirst calls cache.put() manually and otherwise ignores
      // Cache-Control.
      {
        cacheWillUpdate: async ({ response }) =>
          response.headers.get('cache-control')?.includes('no-store') ? null : response
      }
    ]
  })
);

// The prerendered /offline page imports /_app/env.js, the runtime public env
// values (SSR pages inline them instead). It must not fall into the
// cache-first 'assets' route below: it isn't content-hashed, so a changed
// value would never reach clients. Network-first keeps it fresh, and a copy
// warmed at install lets the fallback page hydrate once the network is gone.
const ENV_MODULE = '/_app/env.js';
const ENV_CACHE = 'app-env';
registerRoute(
  ({ url }) => url.pathname === ENV_MODULE,
  new NetworkFirst({ cacheName: ENV_CACHE, networkTimeoutSeconds: 3 })
);
self.addEventListener('install', (event) => {
  // Best effort: a failed warm-up must not fail the install.
  event.waitUntil(
    caches
      .open(ENV_CACHE)
      .then((cache) => cache.add(ENV_MODULE))
      .catch(() => {})
  );
});

registerRoute(
  ({ request }) => ['style', 'script', 'worker', 'image', 'font'].includes(request.destination),
  new CacheFirst({
    cacheName: 'assets',
    plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 })]
  })
);

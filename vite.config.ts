import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
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
  build: {
    // 'hidden' emits .map files (so @sentry/vite-plugin can find and upload
    // them when SENTRY_AUTH_TOKEN is set) but does NOT add sourceMappingURL
    // comments to the output bundles. End users don't see the references
    // in production code; only Sentry has the maps for stack symbolication.
    sourcemap: 'hidden'
  },
  resolve: {
    // For component tests we want the browser/client export of Svelte. The
    // sveltekit plugin sets server conditions for SSR builds; here we only
    // need to ensure tests resolve the browser entry when happy-dom is in
    // play. Test-time only — production builds set their own conditions.
    conditions: process.env.VITEST ? ['browser'] : undefined
  },
  test: {
    include: ['src/**/*.{test,spec}.{js,ts}'],
    environment: 'node',
    server: {
      deps: {
        // Inline svelte component packages so test-time module resolution
        // sees the same browser entry as the page tests.
        inline: ['svelte', '@testing-library/svelte']
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'src/lib/**/*.ts',
        'src/hooks.server.ts',
        'src/hooks.client.ts',
        'src/routes/**/+page.server.ts',
        'src/routes/**/+layout.server.ts',
        'src/routes/**/+server.ts'
      ],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.d.ts',
        'src/test/**',
        // Pure type aliases — no runtime statements to cover.
        'src/lib/types.ts',
        // Bootstrap singleton — exercises real filesystem & better-sqlite3 binding;
        // covered indirectly via the in-memory test harness that mirrors it.
        'src/lib/server/db/index.ts',
        // Schema declarations: the runtime arrow functions here are drizzle's
        // foreign-key resolvers, evaluated lazily by the ORM. The declarations
        // themselves are exercised in schema.test.ts and indirectly by every
        // DB-backed test via INSERT/SELECT.
        'src/lib/server/db/schema.ts',
        // Bootstrap singleton calling Sentry.init at module top — exercises
        // real network/SDK runtime; the `handleError` body itself is a thin
        // pass-through to Sentry.captureException with no logic worth covering
        // (the strict-PII contract lives in scrubEvent, which is tested in
        // src/lib/sentry.test.ts at 100%).
        'src/hooks.client.ts'
      ],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100
      }
    }
  }
});

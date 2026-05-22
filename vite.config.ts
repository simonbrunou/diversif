import { execFileSync } from 'node:child_process';
import { paraglide } from '@inlang/paraglide-sveltekit/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig } from 'vitest/config';

/**
 * Resolve the Sentry release name from the most reliable source available
 * at build time. Mirrors the runtime fallback in sentry-init.server.ts so
 * both surfaces tag events with the same SHA.
 *
 * Order:
 *  1. SENTRY_RELEASE — explicit override
 *  2. SOURCE_COMMIT — set by Coolify in its build container automatically
 *  3. GITHUB_SHA — GitHub Actions
 *  4. GIT_COMMIT_SHA — generic CI shape (Drone, Buildkite, etc.)
 *  5. `git rev-parse HEAD` — local builds with .git/ in the working tree
 *  6. undefined — sentryVitePlugin emits "No release name provided" and
 *     uploads sourcemaps unassociated; build still succeeds
 *
 * Uses execFileSync (vs execSync) so the command + args bypass the shell
 * entirely — no token splitting, no metacharacter expansion. The inputs
 * are hard-coded, but execFile is the strictly safer pattern.
 */
function resolveSentryRelease(): string | undefined {
  if (process.env.SENTRY_RELEASE) return process.env.SENTRY_RELEASE;
  if (process.env.SOURCE_COMMIT) return process.env.SOURCE_COMMIT;
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  if (process.env.GIT_COMMIT_SHA) return process.env.GIT_COMMIT_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .toString()
      .trim();
  } catch {
    return undefined;
  }
}

export default defineConfig({
  plugins: [
    sveltekit(),
    paraglide({
      project: './project.inlang',
      outdir: './src/lib/paraglide'
    }),
    SvelteKitPWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      manifest: false,
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['client/**/*.{js,css,ico,png,svg,webp,woff,woff2}'],
        navigateFallback: '/offline',
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
            org: process.env.SENTRY_ORG || 'simonbrunou',
            project: process.env.SENTRY_PROJECT || 'diversif',
            release: { name: resolveSentryRelease() },
            sourcemaps: {
              assets: ['./build/**'],
              // Delete .map files after upload so the deployed build
              // (which adapter-node copies into the runtime image) doesn't
              // ship reachable .map files. Sentry retains them for stack
              // symbolication.
              filesToDeleteAfterUpload: ['./build/**/*.map']
            },
            telemetry: false
          })
        ]
      : [])
  ],
  build: {
    // Emit hidden source maps ONLY when SENTRY_AUTH_TOKEN is set, so we
    // produce them precisely when the Sentry plugin will upload + delete
    // them. Without the token (local builds, CI without Sentry creds), no
    // .map files are written — nothing for an attacker to fetch.
    //
    // 'hidden' (vs 'true') omits the //# sourceMappingURL= comment, but
    // the .map files would still be reachable by URL-guessing without the
    // post-upload delete (configured below in the plugin block).
    sourcemap: process.env.SENTRY_AUTH_TOKEN ? 'hidden' : false
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
        // Bootstrap singleton — opens a real Postgres pool and runs migrations
        // at module init; covered indirectly via the pg-mem test harness that
        // mirrors it.
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
        'src/hooks.client.ts',
        // Paraglide-generated runtime + messages — regenerated on every
        // build by @inlang/paraglide-sveltekit/vite. No point measuring.
        'src/lib/paraglide/**',
        // Universal hook (one-line re-export of paraglide's reroute helper).
        'src/hooks.ts',
        // Paraglide adapter bootstrap — exercises real runtime; covered indirectly via the e2e smoke in Task 7.
        'src/lib/i18n.ts',
        // Bottom-sheet drag-to-dismiss gesture state machine. Driven by real
        // pointer events; the dismiss / snap-back / scroll-handoff / cancel
        // branches are exercised by Playwright's `bento-discover.spec.ts`
        // (real touch + scrollHeight + cancellable events). happy-dom can stub
        // setPointerCapture but can't fire native scroll or system gesture
        // cancellation, so unit-side coverage of every branch is low-value
        // testing — Modal.test.ts asserts the wiring (which handlers attach
        // where, what the threshold/velocity gates look like), and e2e
        // validates the actual gesture behavior.
        'src/lib/components/ui/use-bottom-sheet-drag.svelte.ts'
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

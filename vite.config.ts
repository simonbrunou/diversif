import { execFileSync } from 'node:child_process';
import tailwindcss from '@tailwindcss/vite';
import { paraglide } from '@inlang/paraglide-sveltekit/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig } from 'vite';

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

// Resolved once at module load so the same SHA flows into both Vite's
// build-time `define` (inlining the constant in server + client bundles)
// and the Sentry plugin's release name (so uploaded sourcemaps match the
// release tag attached to runtime errors).
const SENTRY_RELEASE_RESOLVED = resolveSentryRelease();

export default defineConfig({
  define: {
    // Inlined at build time into every bundle. Replaces the runtime
    // env-var read + docker-entrypoint.sh fallback chain — see
    // src/lib/sentry-init.server.ts and src/hooks.client.ts.
    //
    // When no SHA could be resolved, emit the literal token `undefined`
    // (not `""`) so the call sites can read the constant directly
    // without a `|| undefined` fallback. That fallback would re-introduce
    // a runtime branch which vitest's 100% threshold can't cover from
    // either a release-tagged or release-less test environment.
    __SENTRY_RELEASE__: SENTRY_RELEASE_RESOLVED
      ? JSON.stringify(SENTRY_RELEASE_RESOLVED)
      : 'undefined'
  },
  plugins: [
    tailwindcss(),
    sveltekit(),
    paraglide({
      project: './project.inlang',
      outdir: './src/lib/paraglide'
    }),
    SvelteKitPWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      manifest: false,
      injectRegister: null,
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
            release: { name: SENTRY_RELEASE_RESOLVED },
            sourcemaps: {
              // .map files land in .svelte-kit/output/ during vite build.
              // adapter-node copies that tree to ./build/ in a later phase,
              // but the Sentry plugin runs in vite's closeBundle hook BEFORE
              // that copy — so ./build/ is still empty at upload time and
              // the plugin warns "Didn't find any matching sources".
              assets: ['./.svelte-kit/output/**'],
              // Delete .map files after upload so the deployed build
              // (which adapter-node copies into the runtime image) doesn't
              // ship reachable .map files. Sentry retains them for stack
              // symbolication.
              filesToDeleteAfterUpload: ['./.svelte-kit/output/**/*.map']
            },
            telemetry: false
          })
        ]
      : [])
  ],
  esbuild: {
    // esbuild >= 0.27.7 regressed: it tries to *lower* array destructuring
    // even for targets that support it natively (Vite's default `modules`
    // target), then errors "Transforming destructuring ... is not supported
    // yet" on paraglide-generated `const [x] = fns` code. Explicitly marking
    // destructuring as supported skips the broken lowering path.
    // Upstream: evanw/esbuild#4436, vitejs/vite#22225.
    supported: { destructuring: true }
  },
  build: {
    // Emit hidden source maps ONLY when SENTRY_AUTH_TOKEN is set, so we
    // produce them precisely when the Sentry plugin will upload + delete
    // them. Without the token (local builds, CI without Sentry creds), no
    // .map files are written — nothing for an attacker to fetch.
    //
    // 'hidden' (vs 'true') omits the //# sourceMappingURL= comment, but
    // the .map files would still be reachable by URL-guessing without the
    // post-upload delete (configured below in the plugin block).
    sourcemap: process.env.SENTRY_AUTH_TOKEN ? 'hidden' : false,
    rollupOptions: {
      // `bun` and `bun:*` (bun:sql, bun:test, etc.) are runtime built-ins
      // resolved by the Bun runtime, not by node_modules. Rollup can't find
      // them, so without this they fail bundle resolution. The adapter-node
      // output runs under Bun (`bun ./build/index.js`), so leaving these
      // external is correct.
      external: ['bun', /^bun:/]
    }
  },
  ssr: {
    // Same reasoning as build.rollupOptions.external — Vite's SSR build also
    // needs to know these are Bun-runtime externals, not bundleable modules.
    external: ['bun']
  },
  resolve: {
    // For component tests we want the browser/client export of Svelte under
    // happy-dom. bun test sets BUN_TEST=1; under that env we resolve the
    // browser entry. Build-time conditions are set by sveltekit() itself.
    conditions: process.env.BUN_TEST ? ['browser'] : undefined
  }
});

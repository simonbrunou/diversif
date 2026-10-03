import { execFileSync } from 'node:child_process';
import tailwindcss from '@tailwindcss/vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { paraglideCompilerOptions } from './paraglide.config.ts';
import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { sentrySvelteKit } from '@sentry/sveltekit';
import { createSentryBuildPluginManager } from '@sentry/bundler-plugins/core';
import { defineConfig, type Plugin } from 'vite';

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
 *  6. undefined — the Sentry plugin emits "No release name provided" and
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

// adapter-node 6 dropped its runtime ORIGIN variable. Without paths.origin it
// derives the origin per request from the Host header, or PROTOCOL_HEADER /
// HOST_HEADER behind the production proxy (Dockerfile), and assumes https
// when no protocol header arrives. So production leaves ORIGIN unset at build
// time, and plain-http runs with no proxy in front (the e2e server,
// docker-compose on localhost) pin it, or every form POST fails SvelteKit's
// CSRF origin check.
const BUILD_ORIGIN = process.env.ORIGIN || undefined;

const SENTRY_BUILD_OPTIONS = {
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG || 'simonbrunou',
  project: process.env.SENTRY_PROJECT || 'diversif',
  telemetry: false,
  release: {
    name: SENTRY_RELEASE_RESOLVED,
    // One deploy marker per production build, so "resolved in next
    // release" and the release health timeline line up with deploys.
    deploy: { env: process.env.SENTRY_ENVIRONMENT || 'production' },
    // Suspect commits need the GitHub integration in the Sentry org; opt
    // in with SENTRY_REPOSITORY=<owner>/<repo> once it is connected (a
    // missing integration would otherwise fail the build).
    ...(process.env.SENTRY_REPOSITORY && SENTRY_RELEASE_RESOLVED
      ? {
          setCommits: {
            repo: process.env.SENTRY_REPOSITORY,
            commit: SENTRY_RELEASE_RESOLVED,
            ignoreMissing: true
          }
        }
      : {})
  },
  sourcemaps: {
    // build.sourcemap is set explicitly below: remove every map after
    // upload so the runtime image never serves them.
    filesToDeleteAfterUpload: ['./build/**/*.map', './.svelte-kit/output/**/*.map']
  }
};

/**
 * Creates the Sentry release, uploads the source maps of the final
 * adapter-node output (./build) and deletes every .map file, once SvelteKit
 * has run the adapter.
 *
 * @sentry/sveltekit 10 does this from the SSR build's closeBundle hook, which
 * never fires under SvelteKit 3: environments now build inside Vite's
 * buildApp, and the adapter runs in SvelteKit's own `post` buildApp hook. Left
 * alone, no release or deploy marker is created and the hidden source maps
 * stay in ./build/client, where adapter-node serves them publicly. Remove
 * this plugin once @sentry/sveltekit uploads after SvelteKit 3's adapter, or
 * releases get two deploy markers per build.
 */
function sentryUploadAfterAdapter(): Plugin {
  return {
    name: 'diversif:sentry-upload-after-adapter',
    apply: 'build',
    // enforce + order 'post' put this handler after SvelteKit's adapter one.
    enforce: 'post',
    buildApp: {
      order: 'post',
      async handler() {
        if (!process.env.SENTRY_AUTH_TOKEN) return;
        const sentry = createSentryBuildPluginManager(SENTRY_BUILD_OPTIONS, {
          buildTool: 'vite',
          loggerPrefix: '[sentry-upload-after-adapter]'
        });
        try {
          await sentry.createRelease();
          await sentry.uploadSourcemaps(['./build/**/*.js']);
        } finally {
          // Even when the upload fails: maps must never reach the image.
          await sentry.deleteArtifacts();
        }
      }
    }
  };
}

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
      : 'undefined',
    // The origin this build serves, or '' when it derives it per request.
    // src/lib/server/e2e.ts keys the e2e relaxations on it: a loopback build
    // can't accept a real cross-host form POST, so they stay inert anywhere
    // that serves real traffic.
    __BUILD_ORIGIN__: JSON.stringify(BUILD_ORIGIN ?? '')
  },
  plugins: [
    tailwindcss(),
    // Must precede sveltekit(): it wraps universal `load` functions for
    // browser tracing, resolves the SDK's SvelteKit-version-specific browser
    // tracing module, and — when SENTRY_AUTH_TOKEN is set — stamps a debug ID
    // into every chunk, which sentryUploadAfterAdapter() below matches the
    // uploaded maps with. Server `load` functions are traced by SvelteKit
    // itself (`tracing` in the sveltekit() options below), so the plugin
    // leaves them alone.
    sentrySvelteKit({
      autoUploadSourceMaps: Boolean(process.env.SENTRY_AUTH_TOKEN),
      ...SENTRY_BUILD_OPTIONS
    }),
    sveltekit({
      preprocess: vitePreprocess(),
      // adapter-node default output is ./build; keep it explicit so the
      // Docker entrypoint's `bun ./build/index.js` path is unambiguous.
      adapter: adapter({ out: 'build' }),
      // See BUILD_ORIGIN above.
      //
      // relative: false makes asset URLs root-relative (`/_app/...`). The
      // service worker answers a failed navigation to any path (/child/2,
      // /en/account) with the prerendered /offline page; with Kit's default
      // `./_app/...` URLs that page would request /child/_app/..., miss the
      // precache and render unstyled and inert.
      paths: { origin: BUILD_ORIGIN, relative: false },
      // The same SHA Sentry tags releases with (falls back to Kit's build
      // timestamp when none resolves). It revisions the service worker's
      // unhashed precache entries, so a rebuild of the same commit doesn't
      // make every client re-download them.
      version: { name: SENTRY_RELEASE_RESOLVED },
      // src/instrumentation.server.ts initialises Sentry before any other
      // server module loads (SvelteKit picks the file up automatically), and
      // SvelteKit's own OpenTelemetry spans (handle, load, form actions) feed
      // Sentry's performance traces. adapter-node emits the instrumentation
      // file and imports it first from build/index.js.
      tracing: { server: true },
      // src/service-worker/ is registered by ReloadPrompt.svelte instead, so
      // it stays off in dev and a new version waits for the parent's go-ahead
      // (the « Nouvelle version disponible » toast) before taking over.
      serviceWorker: { register: false },
      // SvelteKit injects small inline bootstrap <script> tags for hydration.
      // Hash mode emits a `<meta http-equiv="content-security-policy">` that
      // whitelists the exact hash of each inline script it produced. We rely
      // on that meta tag for `script-src` and `style-src` (the inline-prone
      // directives) and put the other directives — including frame-ancestors
      // via X-Frame-Options — on the response in `hooks.server.ts`.
      csp: {
        mode: 'hash',
        directives: {
          'default-src': ['self'],
          // SvelteKit's hash mode only hashes scripts that SvelteKit itself
          // emits during render (hydration boot, route data). Static <script>
          // blocks in src/app.html are NOT scanned, so they need explicit
          // hashes here or they get silently blocked. The hash below covers
          // the anti-FOIT theme-init script in src/app.html — if you edit
          // that script, recompute with:
          //   python3 -c "import re,hashlib,base64; \
          //     b=re.search(r'<script>(.*?)<\/script>',open('src/app.html').read(),re.DOTALL).group(1); \
          //     print(base64.b64encode(hashlib.sha256(b.encode()).digest()).decode())"
          'script-src': ['self', 'sha256-GqV1bi71LSFwJEB0v4isQY6KFrlnWV2dqeHM79pt0cE='],
          'style-src': ['self', 'unsafe-inline'],
          'img-src': ['self', 'data:'],
          'font-src': ['self', 'data:'],
          'connect-src': [
            // Browser Sentry envelopes go through the same-origin tunnel
            // (src/routes/monitoring/+server.ts), so no Sentry ingest origin
            // is allow-listed: the browser never talks to a third party.
            'self'
          ],
          'manifest-src': ['self'],
          // blob: is for Sentry Session Replay's compression worker, which
          // the SDK spins up from an inline Blob URL. Creating one already
          // requires script execution, which script-src keeps hash-locked.
          'worker-src': ['self', 'blob:'],
          'base-uri': ['self'],
          'form-action': ['self'],
          'object-src': ['none']
        }
      }
    }),
    // Options shared with scripts/compile-paraglide.ts — see
    // paraglide.config.ts for the strategy/urlPatterns rationale.
    paraglideVitePlugin({ ...paraglideCompilerOptions }),
    sentryUploadAfterAdapter()
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
    // post-upload delete (sentryUploadAfterAdapter above).
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

import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    // adapter-node default output is ./build; keep it explicit so the
    // Docker entrypoint's `bun ./build/index.js` path is unambiguous.
    adapter: adapter({ out: 'build' }),
    // src/instrumentation.server.ts initialises Sentry before any other server
    // module loads, and SvelteKit's own OpenTelemetry spans (handle, load,
    // form actions) feed Sentry's performance traces. adapter-node emits the
    // instrumentation file and imports it first from build/index.js.
    experimental: {
      instrumentation: { server: true },
      tracing: { server: true }
    },
    alias: {
      $components: 'src/lib/components',
      '$components/*': 'src/lib/components/*'
    },
    // SvelteKit injects small inline bootstrap <script> tags for hydration. Hash
    // mode emits a `<meta http-equiv="content-security-policy">` that whitelists
    // the exact hash of each inline script it produced. We rely on that meta tag
    // for `script-src` and `style-src` (the inline-prone directives) and put the
    // other directives — including frame-ancestors via X-Frame-Options — on the
    // response in `hooks.server.ts`.
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
        //     b=re.search(r'<script>(.*?)</script>',open('src/app.html').read(),re.DOTALL).group(1); \
        //     print(base64.b64encode(hashlib.sha256(b.encode()).digest()).decode())"
        'script-src': ['self', 'sha256-GqV1bi71LSFwJEB0v4isQY6KFrlnWV2dqeHM79pt0cE='],
        'style-src': ['self', 'unsafe-inline'],
        'img-src': ['self', 'data:'],
        'font-src': ['self', 'data:'],
        'connect-src': [
          // Browser Sentry envelopes go through the same-origin tunnel
          // (src/routes/monitoring/+server.ts), so no Sentry ingest origin is
          // allow-listed: the browser never talks to a third party.
          'self'
        ],
        'manifest-src': ['self'],
        // blob: is for Sentry Session Replay's compression worker, which the
        // SDK spins up from an inline Blob URL. Creating one already requires
        // script execution, which script-src keeps hash-locked.
        'worker-src': ['self', 'blob:'],
        'base-uri': ['self'],
        'form-action': ['self'],
        'object-src': ['none']
      }
    }
  }
};

export default config;

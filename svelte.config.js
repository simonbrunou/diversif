import adapter from 'svelte-adapter-bun';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ out: 'build' }),
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
          'self',
          // Sentry SaaS EU region ingest endpoints — needed for browser-side
          // captureException to reach Sentry. Cleared via wildcards because the
          // exact org-id-based subdomain (e.g o123456.ingest.de.sentry.io) is
          // determined by the runtime DSN. If we ever switch to a same-origin
          // Sentry tunnel, these can be removed.
          'https://*.ingest.de.sentry.io',
          'https://*.ingest.sentry.io'
        ],
        'manifest-src': ['self'],
        'worker-src': ['self'],
        'base-uri': ['self'],
        'form-action': ['self'],
        'object-src': ['none']
      }
    }
  }
};

export default config;

import adapter from '@sveltejs/adapter-node';
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
        'script-src': ['self'],
        'style-src': ['self', 'unsafe-inline'],
        'img-src': ['self', 'data:'],
        'font-src': ['self', 'data:'],
        'connect-src': ['self'],
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

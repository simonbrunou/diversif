// Bun test loader: registers Svelte compilation BEFORE any other preload
// imports run. ESM imports are hoisted within a single module, so calling
// `Bun.plugin()` in the same file as an `import { cleanup } from
// '@testing-library/svelte'` is too late — props.svelte.js loads during
// the import phase, before the plugin registers. Splitting the loader
// into its own preload (listed first in bunfig.toml) guarantees the
// plugin is active when subsequent preloads (and tests) start importing.

import { readFileSync } from 'node:fs';
import { compile, compileModule } from 'svelte/compiler';

const tsTranspiler = new Bun.Transpiler({ loader: 'ts' });

Bun.plugin({
  name: 'svelte-test-loader',
  setup(build) {
    // .svelte components: full compile with injected CSS (no virtual CSS
    // modules — we don't render styles in tests).
    build.onLoad({ filter: /\.svelte$/ }, ({ path }) => {
      const source = readFileSync(path, 'utf8');
      const result = compile(source, {
        filename: path,
        css: 'injected',
        dev: true,
        generate: 'client'
      });
      return { loader: 'js', contents: result.js.code };
    });

    // .svelte.js / .svelte.ts: rune-bearing modules. Must go through
    // compileModule, otherwise $state/$derived/$effect throw
    // "rune_outside_svelte" at first call. compileModule is JS-only;
    // strip TypeScript syntax for .svelte.ts first.
    build.onLoad({ filter: /\.svelte\.[jt]s$/ }, ({ path }) => {
      let source = readFileSync(path, 'utf8');
      if (path.endsWith('.ts')) {
        source = tsTranspiler.transformSync(source);
      }
      const result = compileModule(source, {
        filename: path,
        dev: true,
        generate: 'client'
      });
      return { loader: 'js', contents: result.js.code };
    });
  }
});

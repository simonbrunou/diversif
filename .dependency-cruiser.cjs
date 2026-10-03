// dependency-cruiser config — audit item C1.
//
// One load-bearing rule: server-only code (the Drizzle client, bun:sqlite, and
// everything under #lib/server) must never be reachable from a module that ends
// up in the client bundle. SvelteKit only keeps server code out of the browser
// for files it recognises as server-only (*.server.ts, +server.ts, hooks.server
// .ts) and `server` directories; a stray `import '#lib/server/db/index.js'`
// from a +page.svelte, a universal +page.ts, or a #lib client helper would
// silently pull the database driver — and its secrets surface — into the
// browser bundle. This rule makes that a build failure.
//
// Invoke as `dependency-cruise` / `dependency-cruiser`, NEVER bare `depcruise`
// via bunx/npx: that name resolves a dependency-confusion placeholder package.
// Here it runs the pinned local binary, so the name is unambiguous.

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-server-in-client',
      comment:
        'A client-reachable module imported server-only code. Move the logic behind a ' +
        '+page.server.ts / +server.ts boundary, or load it via a server load function.',
      severity: 'error',
      from: {
        // Everything EXCEPT genuine server-only modules. SvelteKit guarantees
        // these never reach the browser, so they may import the DB freely:
        pathNot: [
          '^src/lib/server/', // the server lib itself
          '\\.server\\.(ts|js)$', // *.server.ts, +page.server.ts, +layout.server.ts, hooks.server.ts
          '(^|/)\\+server\\.(ts|js)$', // +server.ts API routes (note: NOT ".server.ts")
          '\\.(test|spec)\\.(ts|js)$', // test files are never bundled for the client
          '-test-fixtures\\.(ts|js)$', // helpers shared by those test files
          '^src/test/' // shared test harness
        ]
      },
      to: {
        path: [
          '^src/lib/server', // $lib/server (resolved) and src/lib/server/*
          '/drizzle-orm/', // the Drizzle query builder / client
          '^bun:sqlite$' // the raw SQLite driver
        ],
        // Allow `import type { User } from '#lib/server/db/schema.js'` etc.: TS
        // erases type-only imports at compile time, so they never reach the
        // client bundle. Only a RUNTIME import of server code is the leak we
        // forbid (tsPreCompilationDeps stays on so the type graph is still
        // resolved — we just don't flag the erased edges).
        dependencyTypesNot: ['type-only']
      }
    }
  ],
  options: {
    // #lib is declared in package.json `imports` (subpath imports), and
    // `#lib/x.js` specifiers resolve to the src/lib/x.ts sources, so the
    // `to.path` patterns above see real paths. tsconfig.json extends SvelteKit's
    // generated $app/tsconfig: run `svelte-kit sync` first in CI.
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    doNotFollow: { path: 'node_modules' },
    enhancedResolveOptions: {
      // Match how Vite/SvelteKit pick conditional exports so $app/$env and
      // package `exports` maps resolve the same way the bundler would.
      conditionNames: ['import', 'require', 'node', 'svelte', 'browser', 'default'],
      mainFields: ['svelte', 'browser', 'module', 'main']
    }
  }
};

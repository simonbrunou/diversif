// Single source of truth for the paraglide compiler options, consumed by
// BOTH compile paths: the vite plugin (dev/build) and
// scripts/compile-paraglide.ts (check/lint/test, which run outside vite).
// The two MUST compile identical runtimes — strategy and urlPatterns are
// baked into the generated runtime.js, so drift here would mean tests
// exercising different routing than production. Since paraglide 3 the two
// runtimes differ in one line: runtime.js exports `isDevelopment`, true
// from compile() and false from a production vite build. Nothing in this
// runtime or the app reads it.

import type { CompilerOptions } from '@inlang/paraglide-js';

export const paraglideCompilerOptions: CompilerOptions = {
  project: './project.inlang',
  outdir: './src/lib/paraglide',
  // Physical message files, one module per message. Paraglide 3's vite
  // plugin defaults to "virtual-modules", where messages.js re-exports
  // `virtual:paraglide/...` ids that only vite resolves: `bun build`
  // (build:scripts) then fails to bundle scripts/export-user.ts, whose
  // schema import pulls in the messages. compile() defaults to
  // "message-modules", so naming it here also keeps both paths on one layout.
  // That includes `vite dev`, where paraglide 2 used "locale-modules", so the
  // dev server now loads one module per message instead of one per locale.
  outputStructure: 'message-modules',
  // url-only resolution preserves the 1.x behavior exactly: the locale is a
  // pure function of the pathname (FR at /, EN under /en), no cookie or
  // Accept-Language negotiation, hence the server middleware never issues
  // locale redirects.
  strategy: ['url', 'baseLocale'],
  // Explicit patterns instead of paraglide's defaults: the defaults
  // de-localize ANY known-locale prefix case-insensitively, so /fr/login
  // and /EN/foo (404s on 1.x) would suddenly render real pages — a
  // duplicate URL space, and the layout's locale derivation would flip
  // <html lang> to "en" on /fr/* pages after hydration. With these
  // patterns, only the exact lowercase /en prefix localizes (URLPattern
  // matching is case-sensitive); everything else is the FR catch-all,
  // which leaves /fr/* and /EN/* untouched → 404, byte-identical to 1.x.
  // EN is listed first so /en/* matches before the catch-all.
  urlPatterns: [
    {
      pattern: '/:path(.*)?',
      localized: [
        ['en', '/en/:path(.*)?'],
        ['fr', '/:path(.*)?']
      ]
    }
  ]
};

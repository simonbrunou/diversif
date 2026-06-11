// Single source of truth for the paraglide compiler options, consumed by
// BOTH compile paths: the vite plugin (dev/build) and
// scripts/compile-paraglide.ts (check/lint/test, which run outside vite).
// The two MUST compile identical runtimes — strategy and urlPatterns are
// baked into the generated runtime.js, so drift here would mean tests
// exercising different routing than production.

import type { CompilerOptions } from '@inlang/paraglide-js';

export const paraglideCompilerOptions: CompilerOptions = {
  project: './project.inlang',
  outdir: './src/lib/paraglide',
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

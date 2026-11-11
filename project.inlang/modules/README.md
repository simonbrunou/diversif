# Vendored inlang modules

These files are the published ESM bundles used by `project.inlang/settings.json`.
They are committed so `bun run paraglide`, `bun run check`, `bun run lint`, and
CI test runs do not fetch `@latest` modules from jsDelivr at runtime.

Versions:

- `plugin-message-format.js`: `@inlang/plugin-message-format@4.4.0`

To refresh it, download the exact npm package version above and copy the
package's `dist/index.js` into this directory.

The v1 message-lint-rule modules (`empty-pattern`, `missing-translation`)
were removed with the paraglide-js 2.x migration: the inlang SDK v2 no longer
loads message lint rules. Nothing replaces them; #723 tracks the missing-key
half. The paraglide compiler (2.x and 3.x) compiles a key missing from one
locale without a warning: a key missing from `en.json` shows the French text,
and one missing from `fr.json` shows the key name. `scripts/lint-i18n.ts` and
`scripts/check-i18n-unused.ts` check other things: straight apostrophes in
`fr.json`, and `fr.json` keys that nothing in `src/` references.

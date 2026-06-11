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
loads message lint rules. Equivalent guarantees live in `scripts/lint-i18n.ts`
/ `scripts/check-i18n-unused.ts` (key hygiene) and in the paraglide compiler
itself, which warns on missing translations at compile time.

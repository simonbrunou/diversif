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
loads message lint rules. The paraglide compiler (2.x and 3.x) compiles a key
missing from one locale without a warning: a key missing from `en.json` shows
the French text, and one missing from `fr.json` shows the key name.
`scripts/check-i18n-parity.ts`, which `bun run lint:i18n` runs, replaces both
rules (#723): it fails on a key one locale lacks, a `{placeholder}` one
locale's value lacks, an empty or whitespace-only value, a value that is not a
string, and a `{` or `}` outside a `{letters}` placeholder.

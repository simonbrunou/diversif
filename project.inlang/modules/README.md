# Vendored inlang modules

These files are the published ESM bundles used by `project.inlang/settings.json`.
They are committed so `npm run paraglide`, `npm run check`, `npm run lint`, and
CI test runs do not fetch `@latest` modules from jsDelivr at runtime.

Versions:

- `message-lint-rule-empty-pattern.js`: `@inlang/message-lint-rule-empty-pattern@1.4.8`
- `message-lint-rule-missing-translation.js`: `@inlang/message-lint-rule-missing-translation@1.4.8`
- `plugin-message-format.js`: `@inlang/plugin-message-format@4.4.0`

To refresh them, download the exact npm package versions above and copy each
package's `dist/index.js` into this directory.

---
name: block-generated-paraglide
enabled: true
event: file
action: block
conditions:
  - field: file_path
    operator: regex_match
    pattern: src/lib/paraglide/
---

🚫 **`src/lib/paraglide/` is generated — don't edit it**

This directory is compiled from `messages/en.json` + `messages/fr.json` by
paraglide-js (`bun run paraglide`, and the `paraglideVitePlugin` during dev/build).
It's gitignored. Any edit here is overwritten on the next compile and never ships.

**To change a translation**, edit `messages/en.json` / `messages/fr.json`, then
`bun run paraglide` (or just run `bun run check` / `bun dev`, which recompile it).
Keep the `--strategy` flags in `scripts/compile-paraglide.ts` in sync with
`paraglideVitePlugin` in `vite.config.ts` (see the `_paraglide_note` in package.json).

---
name: i18n-add-key
description: >-
  Add a new UI message key to BOTH messages/en.json and messages/fr.json (with a correct,
  anglicism-free French translation), then verify parity. Use whenever introducing a user-facing
  string in this bilingual (FR-first) app instead of hardcoding text.
---

# i18n-add-key

This app is bilingual (paraglide-js, FR + EN) and **French-first with a no-anglicism rule**
(`warn-anglicism-fr-messages` + `scripts/lint-i18n.mjs` enforce it). Every UI string is a message
key — never hardcode text in a component.

## Steps
1. Pick a key name (existing convention: look at neighbouring keys in `messages/en.json`).
2. Add it to **both** `messages/en.json` and `messages/fr.json` in the same edit. Keep any
   `{placeholder}` identical across locales.
3. French must be idiomatic and **anglicism-free**. Common mappings (from CLAUDE.md):
   `logger → Enregistrer`, `Streak → Régularité`, `Email → Adresse e-mail`, `Stats → Bilan`,
   `Settings → Paramètres`, `Save → Enregistrer`, `Delete → Supprimer`.
4. Recompile + verify parity:
   ```bash
   bun run paraglide && bun lint:i18n
   ```
   `lint:i18n` fails on missing/extra keys or placeholder mismatches between locales.
5. Use the generated message function in the component (import from `$lib/paraglide/messages`),
   never the raw string. Don't edit `src/lib/paraglide/` — it's generated.

## Pitfalls
- Adding to only one locale → `lint:i18n` (and the commit hook) fail.
- Pluralization / interpolation must match the paraglide message syntax used by sibling keys.

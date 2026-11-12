---
name: i18n-add-key
description: >-
  Add a new UI message key to BOTH messages/en.json and messages/fr.json (with a correct,
  anglicism-free French translation), then verify parity. Use whenever introducing a user-facing
  string in this bilingual (FR-first) app instead of hardcoding text.
---

# i18n-add-key

This app is bilingual (paraglide-js, FR + EN) and **French-first with a no-anglicism rule**. No
lint checks anglicisms: the `warn-anglicism-fr-messages` rule-hook warns on some, and PR review
catches the rest. Every UI string is a message key — never hardcode text in a component.

## Steps
1. Pick a key name (existing convention: look at neighbouring keys in `messages/en.json`).
2. Add it to **both** `messages/en.json` and `messages/fr.json` in the same edit. Keep any
   `{placeholder}` identical across locales.
3. French must be idiomatic and **anglicism-free**. Common mappings (from AGENTS.md):
   `logger → Enregistrer`, `Streak → Régularité`, `Email → Adresse e-mail`, `Stats → Bilan`,
   `Settings → Paramètres`, `Save → Enregistrer`, `Delete → Supprimer`.
4. Recompile + verify parity:
   ```bash
   bun run paraglide && bun lint:i18n
   ```
   `lint:i18n` fails on a straight apostrophe inside a French word, a key that nothing in `src/`
   uses, and, through `scripts/check-i18n-parity.ts`, on a key one locale lacks, a `{placeholder}`
   one locale's value lacks, an empty or whitespace-only value, a value that is not a string, and a
   `{` or `}` outside a `{letters}` placeholder.
5. Use the generated message function in the component (import from `#lib/paraglide/messages.js`),
   never the raw string. Don't edit `src/lib/paraglide/` — it's generated.

## Pitfalls
- Adding to only one locale fails `lint:i18n`, which `bun run lint` runs in the pre-push hook and
  in CI. The pre-commit hook does not run it.
- Pluralization / interpolation must match the paraglide message syntax used by sibling keys.
- A colon after a label goes in a message, never in markup: fr puts a space before it, en does
  not (`i18n/no-literal-colon-separator`, #624). Put the whole phrase in one message
  (`chromeChildPageTitle`, fr `{page} : {name}`). When the label is bold markup, start the text
  message after it with the colon (fr `" : …"`, en `": …"`), as `logFormReactionHelpRasText`
  and `dialogsWelcomeStep1Bullet1After` do, and keep that leading punctuation when you edit the
  text.
- An older bundle shows `errorsGenericFallback` for a key added after its build. With
  JavaScript, a tab still running that bundle turns a key that an action or a load returns into
  text with its own compiled messages (`resolveMessageKey` in `src/lib/forms/message-key.ts`).
  Without JavaScript, and for a key the server resolves itself, the current text shows. When only such a tab can trigger the key, as with #446's
  `errorsLogPageOutdated` (#517), reuse a key the older bundles ship if one fits. Otherwise
  record the fallback in the PR and in a follow-up issue.

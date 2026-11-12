---
name: verify-i18n-on-message-edit
enabled: true
event: file
action: warn
tool_matcher: Edit|Write|MultiEdit
conditions:
  - field: file_path
    operator: regex_match
    pattern: messages/(en|fr)\.json$
---

🌍 **Message file changed — keep FR/EN in parity**

This rule is about *key structure* (a complement to `warn-anglicism-fr-messages`,
which is about *content*). A bilingual launch breaks when a key exists in one
locale but not the other, or when a `{placeholder}` differs between `en` and `fr`.

**Before you commit, run:** `bun run lint:i18n`. Its third check,
`scripts/check-i18n-parity.ts`, fails on a key that one of `fr.json` and
`en.json` lacks, a `{placeholder}` that one locale's value lacks, an empty or
whitespace-only value, a value that is not a string, and a `{` or `}` outside a
`{letters}` placeholder.

If you added a key to one locale, add it to the other in the same edit. The
pre-commit hook does not run this check: `bun run lint` runs it in the pre-push
hook and in CI's `Lint + typecheck` job. This warning just catches it earlier.

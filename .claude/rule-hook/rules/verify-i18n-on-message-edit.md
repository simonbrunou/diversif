---
name: verify-i18n-on-message-edit
enabled: true
event: file
action: warn
conditions:
  - field: file_path
    operator: regex_match
    pattern: messages/(en|fr)\.json$
---

🌍 **Message file changed — keep FR/EN in parity**

This rule is about *key structure* (a complement to `warn-anglicism-fr-messages`,
which is about *content*). A bilingual launch breaks when a key exists in one
locale but not the other, or when a `{placeholder}` differs between `en` and `fr`.

**Before you commit, run:** `bun lint:i18n`
(catches missing/extra keys and placeholder mismatches across `en.json`/`fr.json`).

If you added a key to one locale, add it to the other in the same edit. The
authoritative gate is `scripts/lint-i18n.mjs` at commit time — this warning just
catches it earlier.

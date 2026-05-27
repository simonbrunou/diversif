---
name: block-no-verify
enabled: true
event: bash
pattern: --no-verify
action: block
---

🚫 **`--no-verify` is forbidden in this repo**

CLAUDE.md hard rule: husky + lint-staged (prettier + eslint) gate every
commit. Bypassing them with `--no-verify` is how anglicism leaks, unformatted
code, and unused i18n keys land on `main`.

**If lint-staged is failing:**
- Run `npm run lint` to see all errors (prettier, eslint, anglicism check, i18n unused keys).
- Run `npm run format` to auto-fix prettier issues.
- Run `npx eslint . --fix` to auto-fix safe eslint issues.
- Fix the underlying issue — don't bypass the gate.

**If the pre-push hook is the problem (e.g. coverage gate during WIP):**
- The pre-push hook has conditional gates (see commit `e7a7462`).
  Check `.husky/pre-push` for the env vars that disable specific checks
  during legitimate WIP scenarios.

PR reviewers reject commits that bypassed local hooks.

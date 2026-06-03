---
name: block-npm-audit-fix
enabled: true
event: bash
pattern: npm\s+audit\s+fix
action: block
---

🚫 **`npm audit fix` is forbidden in this repo**

CLAUDE.md hard rule: `npm audit fix` rewrites the lockfile in a way CI's older
npm rejects, breaking the `npm ci` step in `.github/workflows/ci.yml`.

**If you need to address a vulnerability:**
- Bump the specific package via `npm install <pkg>@<version>` (no `--package-lock-only`).
- For dependency overrides, edit the `overrides` block in `package.json`,
  delete `node_modules/`, and reinstall — `--package-lock-only` silently
  no-ops overrides.
- Use `npm audit` (without `fix`) to inspect, then act surgically.

This rule exists because PR reviewers have rejected lockfile regressions before.

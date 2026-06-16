---
name: pre-launch-check
description: >-
  Run diversif's full release-readiness gate (the same checks CI enforces) and report a go/no-go
  summary. Use before a release/deploy, before opening a PR off a hardening branch, or when asked
  "is this ready to ship?".
disable-model-invocation: true
---

# pre-launch-check

Runs the project's complete quality gate and summarizes pass/fail. This mirrors CI so failures are
caught locally first. **Stop at the first hard failure**, report it, and don't continue blindly.

## Gate (run in this order)
```bash
bun run check          # paraglide compile + svelte-check (types)
bun lint               # eslint + prettier + anglicism + i18n-unused
bun lint:i18n          # FR/EN key + placeholder parity
bun lint:contrast      # accessibility contrast check
bun test               # unit/integration (100% coverage gate)
bun depcruise          # architecture / dependency boundaries
bun knip               # dead code / unused deps & exports
bun db:verify-backup   # backup/restore path still works
bun test:e2e           # Playwright + axe-core (needs `bun test:e2e:install` once)
```

## Report
Produce a checklist with ✅/❌ per step and the failing output for any ❌. Then a one-line verdict:
**GO** (all green) or **NO-GO** (list the blockers). Also surface anything from `PARKING_LOT.md` /
`DEPLOY.md` that's still open infra (e.g. Litestream backups, GlitchTip) — those are ops, not code,
but they belong in a launch decision.

## Notes
- `test:e2e` launches browsers and is the slow step — if you only need a fast pre-PR check, the user
  may ask to skip it; say so explicitly in the report rather than silently omitting it.
- This is a read/run-checks skill; it does not fix anything. If a step fails, fix it (or dispatch the
  relevant reviewer, e.g. `tenant-isolation-auditor` / `webauthn-auth-reviewer`) and re-run.

# Diversif — Claude context

## Orientation

- **Stack & commands**: see `README.md` (SvelteKit + Postgres via `pg` + Drizzle + WebAuthn passkeys).
- **Product, tone, users**: see `PRODUCT.md`.
- **Tests**: `npm test` runs vitest against `pg-mem` — no live Postgres needed. E2E: `npm run test:e2e` (Playwright; the script resets the DB first).

## Conventions Claude must respect

- **French UI, no anglicisms.** Use "Enregistrer" not "logger", "Régularité" not "Streak", "Adresse e-mail" not "Email", "Bilan" not "Stats". PR reviewers reject regressions.
- **Don't run `npm audit fix`.** It rewrites the lockfile in a way CI's older npm rejects. For new dependency overrides, also delete `node_modules` and reinstall — `--package-lock-only` silently no-ops them.
- **Pre-commit**: husky runs `lint-staged` (prettier + eslint). Don't bypass with `--no-verify`.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:

- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

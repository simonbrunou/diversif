# Diversif — Claude context

## Orientation

- **Stack & commands**: see `README.md` (Bun-native: SvelteKit on `@sveltejs/adapter-node` run under Bun + SQLite via `bun:sqlite` + Drizzle + WebAuthn passkeys + `Bun.password` Argon2id).
- **Product, tone, users**: see `PRODUCT.md`.
- **Tests**: `bun test` runs `bun:test` against an in-process `bun:sqlite` `:memory:` database (same engine as prod) — no Docker required. E2E: `bun run test:e2e` (Playwright; the script resets a throwaway SQLite file first).
- **Claude Code setup** (reproducing plugins/skills/hooks/MCPs on a new machine): see `docs/claude-setup.md`. On a fresh clone, run `scripts/claude-setup.sh`, then open the project in Claude Code to auto-install plugins.

## Conventions Claude must respect

- **French UI, no anglicisms.** Use "Enregistrer" not "logger", "Régularité" not "Streak", "Adresse e-mail" not "Email", "Bilan" not "Stats". PR reviewers reject regressions.
- **Use Bun, not npm/Node.** `bun install`, `bun run X`, `bun test`. `bun --bun <cmd>` forces tools with Node shebangs (vite, drizzle-kit, playwright, svelte-check) to run under Bun — without it, server code that imports `bun` / `bun:sqlite` fails to resolve.
- **Pre-commit**: husky runs `lint-staged` (prettier + eslint). Don't bypass with `--no-verify`.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:

- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

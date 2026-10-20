# Diversif — Claude context

## Orientation

- **Stack & commands**: see `README.md` (Bun-native: SvelteKit on `@sveltejs/adapter-node` run under Bun + SQLite via `bun:sqlite` + Drizzle + WebAuthn passkeys + `Bun.password` Argon2id).
- **Product, tone, users**: see `PRODUCT.md`.
- **Tests**: `bun run test`, never bare `bun test` (component tests need the wrapper's `--conditions=browser`). It runs `bun:test` against an in-process `bun:sqlite` `:memory:` database (same engine as prod) — no Docker required. E2E: `bun run test:e2e` (Playwright; the script resets a throwaway SQLite file first). Before writing or debugging a test, read `docs/agents/testing.md`.
- **Claude Code setup** (reproducing plugins/skills/hooks/MCPs on a new machine): see `docs/claude-setup.md`. On a fresh clone, run `scripts/claude-setup.sh`, then open the project in Claude Code to auto-install plugins.

## Conventions Claude must respect

- **French UI, no anglicisms.** Use "Enregistrer" not "logger", "Régularité" not "Streak", "Adresse e-mail" not "Email", "Bilan" not "Stats". PR reviewers reject regressions.
- **Use Bun, not npm/Node.** `bun install`, `bun run X`. `bun --bun <cmd>` forces tools with Node shebangs (vite, drizzle-kit, playwright, svelte-check) to run under Bun — without it, server code that imports `bun` / `bun:sqlite` fails to resolve.
- **Pre-commit**: husky runs `lint-staged` (prettier + eslint). Don't bypass with `--no-verify`.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:

- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- Refresh the graph only in a dedicated chore PR cut from the main checkout (the #383 pattern). Keep `graphify update .` output out of feature and fix PRs and out of worktree commits: it rewrites graph.json wholesale and relabels communities, and from a worktree it stamps the worktree's directory name into the graph (#264, #415). Undo a stray run with `git restore graphify-out`, then delete the untracked `graphify-out/.graphify_labels.pending.json`
- On a graph.json merge conflict, take one side and regenerate

## Merge authority

Agents may merge their own PR without asking once all three hold: a code review ran on the diff (the `code-review` skill or the `pr-review-toolkit:code-reviewer` agent) and its real findings are fixed; CI is green on the pushed SHA; the branch is up to date with `origin/main`. The production deploy that the merge triggers is accepted. Ask first only when the PR drops or rewrites stored data (a destructive migration, a backfill that overwrites rows).

## Agent skills

### Issue tracker

Issues live on the self-hosted Forgejo (git.sbrn.eu/simonbrunou/diversif), driven with the `fj` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default role labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

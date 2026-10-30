# Diversif — agent context

## Orientation

- **Stack & commands**: see `README.md` (Bun-native: SvelteKit on `@sveltejs/adapter-node` run under Bun + SQLite via `bun:sqlite` + Drizzle + WebAuthn passkeys + `Bun.password` Argon2id).
- **Product, tone, users**: see `PRODUCT.md`.
- **Tests**: `bun run test`, never bare `bun test` (component tests need the wrapper's `--conditions=browser`). It runs `bun:test` against an in-process `bun:sqlite` `:memory:` database (same engine as prod) — no Docker required. E2E: `bun run test:e2e` (Playwright; the script resets a throwaway SQLite file first). Before writing or debugging a test, read `docs/agents/testing.md`.
- **E2E slot**: two Playwright jobs on CI's shared runner time each other out. Before you open a PR, push to an open one, rerun a CI job or merge, run `scripts/wait-e2e-slot.sh &&` in front of that command. The rule and its exit codes: `docs/agents/testing.md`, "Start an E2E job only when no other one runs or waits".
- **Deploy**: a merge to `main` deploys to production. What a deploy does, how to check one, and where to read a production environment value: `docs/agents/deploy.md`.
- **Claude Code setup** (reproducing plugins/skills/hooks/MCPs on a new machine): see `docs/claude-setup.md`. On a fresh clone, run `scripts/claude-setup.sh`, then open the project in Claude Code to auto-install plugins.

## Conventions agents must respect

- **French UI, no anglicisms.** Use "Enregistrer" not "logger", "Régularité" not "Streak", "Adresse e-mail" not "Email", "Bilan" not "Stats". PR reviewers reject regressions.
- **Use Bun, not npm/Node.** `bun install`, `bun run X`. `bun --bun <cmd>` forces tools with Node shebangs (vite, drizzle-kit, playwright, svelte-check) to run under Bun — without it, server code that imports `bun` / `bun:sqlite` fails to resolve.
- **Pre-commit**: husky runs `lint-staged` (prettier + eslint). Don't bypass with `--no-verify`.

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:

- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- For cross-module "how does X relate to Y" questions, prefer `graphify query "<question>"`, `graphify path "<A>" "<B>"`, or `graphify explain "<concept>"` over grep — these traverse the graph's EXTRACTED + INFERRED edges instead of scanning files
- Refresh the graph only in a dedicated chore PR cut from the main checkout (the #383 pattern); this overrides the "run `graphify update .` after code changes" line in GRAPH_REPORT.md. Keep `graphify update .` output out of feature and fix PRs and out of worktree commits: it rewrites graph.json wholesale and relabels communities, and from a worktree it stamps the worktree's directory name into the graph (#264; seen again while working on #415, never committed). Undo a stray run with `git restore graphify-out`, then delete the untracked `graphify-out/.graphify_labels.pending.json`
- On a graph.json merge conflict, take one side and regenerate

## Merge authority

Agents may merge their own PR without asking once all three hold:

- a code review ran on the diff (the `code-review` skill or the `pr-review-toolkit:code-reviewer` agent) and you fixed its real findings, nits aside (the global agent rules define a nit);
- CI is green on the pushed SHA;
- the pushed SHA has no conflict with `origin/main`. Run `git fetch origin` right before merging, then check that `git merge-tree --write-tree origin/main <pushed SHA>` exits 0.

When the branch is behind `main` but has no conflict, merge it as it is. Merging `origin/main` into it first costs a full CI run, so skip that step. The accepted risk is that two PRs that pass on their own can break `main` together. The CI run on the newest `main` commit shows such a break. After you merge, check that run along with the deploy. If a newer merge cancelled it, check the run on the newer `main` commit instead. If the run is red, file a Forgejo issue labelled `needs-triage`.

The merge-tree check exits 1 on a conflict and prints `CONFLICT` lines. It also exits 1 when it cannot find the SHA, and then prints `not something we can merge` instead. In that case, fetch or correct the SHA and run the check again. On a conflict:

1. Merge `origin/main` into the branch and resolve the conflict.
2. Run `bun run test`.
3. Push, and wait for CI on the new head.
4. Check all three conditions again on the new pushed SHA.

The user accepts the production deploy that the merge triggers. Ask first only when the PR drops or rewrites stored data (a destructive migration, a backfill that overwrites rows).

After the merge, check the deploy with `scripts/smoke-prod.sh <sha>`, where `<sha>` is the newest `main` commit that changes a deployed file. A merge that changes only `*.md` or `docs/` files deploys nothing (see `docs/agents/deploy.md`).

## Agent skills

### Issue tracker

Issues live on the self-hosted Forgejo (git.sbrn.eu/simonbrunou/diversif), driven with the `fj` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default role labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

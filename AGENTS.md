# Diversif — agent context

## Orientation

- **Stack & commands**: see `README.md` (Bun-native: SvelteKit on `@sveltejs/adapter-node` run under Bun + SQLite via `bun:sqlite` + Drizzle + WebAuthn passkeys + `Bun.password` Argon2id).
- **Product, tone, users**: see `PRODUCT.md`.
- **Tests**: `bun run test`, never bare `bun test` (component tests need the wrapper's `--conditions=browser`). It runs `bun:test` against an in-process `bun:sqlite` `:memory:` database (same engine as prod) — no Docker required. E2E: `bun run test:e2e` (Playwright; the script resets a throwaway SQLite file first). Before writing or debugging a test, read `docs/agents/testing.md`.
- **Deploy**: a merge to `main` deploys to production, also when it changes only tests or scripts. What a deploy does, how to check one, and where to read a production environment value: `docs/agents/deploy.md`.
- **Claude Code setup** (reproducing plugins/skills/hooks/MCPs on a new machine): see `docs/claude-setup.md`. On a fresh clone, run `scripts/claude-setup.sh`, then open the project in Claude Code to auto-install plugins.

## Conventions agents must respect

- **French UI, no anglicisms.** Use "Enregistrer" not "logger", "Régularité" not "Streak", "Adresse e-mail" not "Email", "Bilan" not "Stats". PR reviewers reject regressions.
- **Use Bun, not npm/Node.** `bun install`, `bun run X`. `bun --bun <cmd>` forces tools with Node shebangs (vite, drizzle-kit, playwright, svelte-check) to run under Bun — without it, server code that imports `bun` / `bun:sqlite` fails to resolve.
- **The dev shell's Bun may lag the pinned one.** The dev shell's `bun` follows the nixpkgs rev that `flake.lock` locks, so it can differ from the Bun that CI and production pin. `scripts/check-bun-pins.sh` names the pin files and prints the pinned version. « Merge authority » asks for green CI on the pushed SHA, so a local run on the dev shell's Bun never decides a merge. When a check fails in CI on an assertion or an output difference and passes in the dev shell, rerun it first as `nix develop -c scripts/pinned-bun.sh <command>`: if it fails there too, the Bun version is the likely cause (`docs/agents/testing.md`, « The dev shell's Bun may lag the pinned one »).
- **Pre-commit**: husky runs `lint-staged` (prettier + eslint). Don't bypass with `--no-verify`.
- **Before you start a CI E2E job** (open or reopen a PR, push to an open one, rerun the E2E job or a whole run, merge), run `scripts/wait-e2e-slot.sh && <that command>` in one foreground shell call with `timeout: 600000`, and run it again at once on exit 3, which keeps your place in its queue. When that command works on a branch other than the checked-out one, pass that branch's pushed SHA: `scripts/wait-e2e-slot.sh <sha> && <that command>`. Why, which SHA in each case, and the other exit codes: `docs/agents/testing.md`, "Start an E2E job only when no other one runs or waits". Run a branch's review and re-checks before you open its PR ("Review a branch before you open its PR", same file).

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

- a code review ran on the diff (the `code-review` skill or the `pr-review-toolkit:code-reviewer` agent, each reviewer briefed with « Rules for review sub-agents » from `docs/agents/testing.md`) and you fixed its real findings, nits aside (the global agent rules define a nit);
- CI is green on the pushed SHA;
- the pushed SHA has no conflict with `origin/main`. Run `git fetch origin` right before merging, then check that `git merge-tree --write-tree origin/main <pushed SHA>` exits 0.

When the branch is behind `main` but has no conflict, merge it as it is. Merging `origin/main` into it first costs a full CI run, so skip that step. The accepted risk is that two PRs that pass on their own can break `main` together. The CI run on the newest `main` commit shows such a break, and « After every merge » below says when to wait for it.

The merge-tree check exits 1 on a conflict and prints `CONFLICT` lines. It also exits 1 when it cannot find the SHA, and then prints `not something we can merge` instead. In that case, fetch or correct the SHA and run the check again. On a conflict:

1. Merge `origin/main` into the branch and resolve the conflict.
2. Run `bun run test`.
3. Push behind `scripts/wait-e2e-slot.sh &&`, and wait for CI on the new head.
4. Check all three conditions again on the new pushed SHA.

The user accepts the production deploy that the merge triggers. Ask first only when the PR drops or rewrites stored data (a destructive migration, a backfill that overwrites rows).

After every merge, decide whether to wait for the CI run the merge starts on `main`:

1. Run `git fetch origin`. Read the merge SHA from `merge_commit_sha` in `python3 -I ~/.agents/skills/forgejo-issues/scripts/forgejo.py get diversif#<n>`, since `fj pr -R origin merge` prints none.
2. Run `git rev-parse <merge SHA>^{tree} <pushed SHA>^{tree}`.
   - Two different hashes mean the merge commit holds files that no CI run tested together, as when the branch was behind `main`. Wait for `main`'s run (step 3).
   - The same hash twice means the merge commit holds the files the PR's run passed, since that run checks out the pushed SHA itself. Then run `nix develop -c bun scripts/check-push-repeats-pr.ts <pushed SHA> <merge SHA>` in the PR's worktree, its head still at the pushed SHA. The script compares the two trees again, reads the workflows and the other files at the pushed SHA, and exits 0 only when the `push` run on `main` repeats the PR run's jobs and steps, apart from the differences its `ALLOWED` list keeps on purpose, each with its reason. On exit 0, skip the wait. On any other exit, or when the script cannot run, wait as for different hashes. It prints each difference it found. A PR whose run skipped `End-to-end tests (Playwright)` (a change to Markdown and `docs/` only) still skips the wait: with equal trees, each file the PR did not change against its merge base keeps the version of the `main` commit it merged onto, so `main`'s E2E job tests that commit's app files again. The skip means the merge adds nothing the PR's run did not test, not that `main`'s run will be green: a new advisory or a flaky test can still turn it red.
3. To wait, run `python3 -I ~/.agents/skills/forgejo-issues/scripts/forgejo.py ci diversif --follow main` alone in a shell call, and run it again on exit 3. When a newer merge cancels the run, it follows `main` to the newer commit's run, which you then check instead. If the run is red, take each failure in turn. While #478 is open, an E2E timeout that « Triaging a red run » in `docs/agents/testing.md` lists as runner overload gets a sighting there, as that bullet says. A job the runner cancelled mid-step (`[runner]: context canceled`, no failed test) gets the rerun that section describes. For any other failure, comment the run, its SHA and the failing test or step on the open issue that tracks that failure, or file a Forgejo issue labelled `needs-triage` when none does. When the merge itself broke `main` (two PRs that pass alone but fail together), also fix it in a new PR.

Check the deploy whatever the hashes say: run `scripts/smoke-prod.sh <sha>`, where `<sha>` is the newest `main` commit that started a deploy. A merge that changes only `*.md` or `docs/` files deploys nothing (see `docs/agents/deploy.md`).

## Agent skills

### Issue tracker

Issues live on the self-hosted Forgejo (git.sbrn.eu/simonbrunou/diversif), driven with the `fj` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five default role labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.

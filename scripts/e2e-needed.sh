#!/usr/bin/env bash
# Prints whether CI's E2E job and the three build jobs (bundle-budget,
# db-backup-verify, docker-build) have to run for a pull request: `false`
# when every path the branch changes is on the skip list, `true` otherwise.
# The skip list holds:
#   - Markdown files and everything under docs/;
#   - agent tooling (#718): everything under .claude/, and the rule-hook
#     scripts with their tests, scripts/rule-hook.ts,
#     scripts/rule-hook.test.ts and scripts/e2e-slot-rule.test.ts, named one
#     by one, since package.json, playwright.config.ts and the Dockerfile run
#     other scripts there.
# A file on the skip list reaches the build output only through Tailwind's
# source scan, which can add or drop CSS rules for class names written in
# that file. No file the E2E job or the build reads names an agent-tooling
# path: scripts/e2e-skip-list.test.ts checks it, and its header says what it
# cannot see.
#
# Each such PR still ran the full Playwright job on the one shared E2E slot:
# on 2026-11-07 the #685 thread waited for the slot behind PR #699's run
# 4039, whose E2E job took 8.5 minutes and changed only
# docs/agents/testing.md; PRs #688, #709 and #716 ran E2E for agent tooling
# (#718).
#
# The production deploy skips fewer paths: its Coolify watch paths
# (docs/agents/deploy.md) skip Markdown and docs/ only, so a merge that
# changes agent tooling still deploys, with the same src/.
#
# A push to main always runs E2E and the build jobs, and CI does not call
# this script for it.
# A newer merge cancels main's running CI (cancel-in-progress), so a merge
# that skipped E2E would leave the code merge before it with no E2E run, and
# « Merge authority » in AGENTS.md reads E2E on the newest main commit.
#
# The diff is <base>...HEAD, so the commits the base gained after the branch
# point do not count. Renames show both paths: a file moved from src/ to
# docs/ or .claude/ still changes src/. It prints `true` whenever it cannot
# tell: a base git cannot find (it says so on stderr), or an empty diff.
#
# Usage: scripts/e2e-needed.sh origin/<base branch>
#   It always exits 0.
set -uo pipefail

needed() {
  echo "$1"
  exit 0
}

files="$(git diff --no-renames --name-only "${1:-}...HEAD" 2>/dev/null)" || {
  echo "e2e-needed: git cannot diff ${1:-<no base>}...HEAD, so E2E and the build jobs run" >&2
  needed true
}
# An empty diff reads as one empty name, which matches no pattern. The test
# reads each skip arm below, so keep one arm per line.
while IFS= read -r file; do
  case "$file" in
    docs/* | *.md) ;;
    .claude/* | scripts/rule-hook.ts | scripts/rule-hook.test.ts | scripts/e2e-slot-rule.test.ts) ;;
    *) needed true ;;
  esac
done <<<"$files"
needed false

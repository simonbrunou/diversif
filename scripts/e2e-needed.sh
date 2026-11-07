#!/usr/bin/env bash
# Prints whether CI's E2E job has to run for a pull request: `false` when
# every path the branch changes is a Markdown file or sits under docs/,
# `true` otherwise. Nothing under src/, e2e/, static/ or the Vite and
# Playwright configs reads a Markdown file or docs/, so such a change leaves
# what the E2E tests drive as it was. The production deploy skips the same
# paths (the Coolify watch paths in docs/agents/deploy.md). Each docs-only PR
# still ran the full Playwright job on the one shared E2E slot: on 2026-11-07
# the #685 thread waited for the slot behind PR #699's run 4039, whose E2E
# job took 8.5 minutes and changed only docs/agents/testing.md.
#
# A push to main always runs E2E, and CI does not call this script for it.
# A newer merge cancels main's running CI (cancel-in-progress), so a
# docs-only merge would leave the code merge before it with no E2E run, and
# « Merge authority » in AGENTS.md reads E2E on the newest main commit.
#
# The diff is <base>...HEAD, so the commits the base gained after the branch
# point do not count. Renames show both paths: a file moved from src/ to
# docs/ still changes src/. It prints `true` whenever it cannot tell: a base
# git cannot find (it says so on stderr), or an empty diff.
#
# Usage: scripts/e2e-needed.sh origin/<base branch>
#   It always exits 0.
set -uo pipefail

needed() {
  echo "$1"
  exit 0
}

files="$(git diff --no-renames --name-only "${1:-}...HEAD" 2>/dev/null)" || {
  echo "e2e-needed: git cannot diff ${1:-<no base>}...HEAD, so E2E runs" >&2
  needed true
}
# An empty diff reads as one empty name, which matches neither pattern.
while IFS= read -r file; do
  case "$file" in
    docs/* | *.md) ;;
    *) needed true ;;
  esac
done <<<"$files"
needed false

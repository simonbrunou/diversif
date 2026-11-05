#!/usr/bin/env bash
# Refuses a push whose commits conflict with the branch they will merge into.
#
# Opening a PR, or pushing to an open one, starts a CI run and its E2E job.
# When the branch conflicts with main, Merge authority (AGENTS.md) has you
# merge main into it and push again: a second run, and a second wait for the
# E2E slot. On #665 the conflict showed up after the PR's first run had
# started, and the second push waited 52 minutes for the slot. The husky
# pre-push hook runs this script first, so the conflict shows before the push.
#
# The base is origin/main, or FALLOW_AUDIT_BASE (origin/<parent>) for a
# branch stacked on another, as for the hook's Fallow audit. The script
# fetches the base first: a clone's origin/main is only as new as the last
# fetch from any of its worktrees, and #665's branch conflicted with a PR
# merged 10 minutes before its push. When the fetch fails, it checks the
# local ref and says so.
#
# Usage:
#   scripts/check-base-conflict.sh <commit>...  checks each commit
#   scripts/check-base-conflict.sh              reads pre-push lines on stdin
#                                               (<local ref> <sha> <remote
#                                               ref> <sha>) and checks each
#                                               pushed branch
# Exit 0: no conflict. 1: a commit conflicts with the base. 2: a wrong call,
# or a commit or base git cannot find.
set -uo pipefail

base="${FALLOW_AUDIT_BASE:-origin/main}"
remote="${base%%/*}"
branch="${base#*/}"
if [ "$remote" = "$base" ] || [ -z "$branch" ]; then
  echo "check-base-conflict: base '$base' is not <remote>/<branch>" >&2
  exit 2
fi

commits=("$@")
if [ ${#commits[@]} -eq 0 ]; then
  # A deleted branch comes as "(delete)", and a tag has nothing to merge.
  while read -r local_ref local_sha _remote_ref _remote_sha; do
    case "$local_ref" in
      refs/heads/*) commits+=("$local_sha") ;;
    esac
  done
fi
if [ ${#commits[@]} -eq 0 ]; then
  echo "check-base-conflict: no branch to check"
  exit 0
fi

if ! git fetch -q "$remote" "$branch"; then
  echo "check-base-conflict: could not fetch $base; checking the local ref, which may be stale" >&2
fi
if ! git rev-parse -q --verify "$base^{commit}" >/dev/null; then
  echo "check-base-conflict: no commit at $base" >&2
  exit 2
fi

status=0
for commit in "${commits[@]}"; do
  # merge-tree exits 1 on a commit it cannot find too, as on a conflict.
  if ! git rev-parse -q --verify "$commit^{commit}" >/dev/null; then
    echo "check-base-conflict: no commit at $commit" >&2
    exit 2
  fi
  out=$(git merge-tree --write-tree --name-only "$base" "$commit" 2>&1)
  rc=$?
  short=$(git rev-parse -q --short "$commit" 2>/dev/null || echo "$commit")
  case $rc in
    0) echo "check-base-conflict: $short merges cleanly into $base" ;;
    1)
      echo "check-base-conflict: $short conflicts with $base:" >&2
      printf '%s\n' "$out" | grep '^CONFLICT' >&2
      echo "Merge $base into the branch, resolve, run bun run test, then push (AGENTS.md, Merge authority)." >&2
      status=1
      ;;
    *)
      echo "check-base-conflict: git merge-tree failed on $commit:" >&2
      printf '%s\n' "$out" >&2
      exit 2
      ;;
  esac
done
exit $status

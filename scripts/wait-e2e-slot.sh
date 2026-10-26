#!/usr/bin/env bash
# Wait until no other CI run of this repo has its E2E job waiting or running,
# before a push, a merge to main or a rerun starts another one. The rule and
# why: docs/agents/testing.md, « Start an E2E job only when no other one runs
# or waits ».
#
#   scripts/wait-e2e-slot.sh [<own sha>]
#
# It leaves out the runs of <own sha> (full or a prefix of 7+ characters),
# by default origin/<current branch>: your branch's pushed head, whose run
# your next push cancels. It polls every 30 s for up to E2E_WAIT seconds
# (default 420, so a call ends inside a 600 s shell timeout even when every
# request takes its full 20 s) and prints each busy run it sees.
# A clear check then claims the slot for this worktree in the file
# E2E_SLOT_CLAIM (default diversif-e2e-slot.claim in $XDG_RUNTIME_DIR, else
# in /tmp), and another worktree's fresh claim counts as busy (claim_slot).
# Exit 0: no other E2E job waits or runs, and no other worktree holds a claim.
# Exit 3: still busy, run it again. Exit 2: no token on this host, the forge
# refused it, or a wrong call (a bad SHA or E2E_WAIT, a JOB that ci.yml no
# longer names, or a claim file it cannot write).
#
# It reads `actions/runs` and each run's jobs. `actions/tasks` lists only the
# jobs a runner has taken, so a queued run and an E2E job still waiting for a
# slot are missing there. Hand-written loops read a busy runner as clear twice
# on 2026-10-25: once on run ids zsh kept as one word, once on a jobs reply
# read as an object.
set -uo pipefail

API="https://git.sbrn.eu/api/v1/repos/simonbrunou/diversif"
# The job's `name:` in .forgejo/workflows/ci.yml; checked below.
JOB="End-to-end tests (Playwright)"
REPO="$(dirname "$0")/.."
WAIT="${E2E_WAIT:-420}"
CLAIM="${E2E_SLOT_CLAIM:-${XDG_RUNTIME_DIR:-/tmp}/diversif-e2e-slot.claim}"

die() {
  echo "wait-e2e-slot: $1" >&2
  exit 2
}

if [ $# -gt 0 ]; then
  OWN="$1"
else
  OWN="$(git -C "$REPO" rev-parse --verify -q "origin/$(git -C "$REPO" branch --show-current)" 2>/dev/null)"
fi
OWN="$(printf '%s' "$OWN" | tr '[:upper:]' '[:lower:]')"

[[ "$WAIT" =~ ^[0-9]+$ ]] || die "E2E_WAIT must be a number of seconds, got '$WAIT'"
WAIT=$((10#$WAIT))
[ -z "$OWN" ] || [[ "$OWN" =~ ^[0-9a-f]{7,40}$ ]] || die "'$OWN' is not a commit SHA"
grep -qxF "    name: $JOB" "$REPO/.forgejo/workflows/ci.yml" ||
  die "ci.yml has no job named '$JOB': update JOB in this script"
[ -d "$(dirname "$CLAIM")" ] && [ -w "$(dirname "$CLAIM")" ] && [ ! -d "$CLAIM" ] ||
  die "cannot write the claim file $CLAIM"

keys="$HOME/.local/share/forgejo-cli/keys.json"
[ -f "$keys" ] || keys="$HOME/Library/Application Support/forgejo-cli/keys.json"
FJ_TOKEN="$(jq -r '.hosts["git.sbrn.eu"].token // empty' "$keys" 2>/dev/null)"
[ -n "$FJ_TOKEN" ] || die "no git.sbrn.eu token in fj's keys.json (log fj in on this host)"

api() {
  curl -sSf --max-time 20 -H "Authorization: token $FJ_TOKEN" "$API/$1"
}

start=$(date +%s)
code="$(curl -s --max-time 20 -o /dev/null -w '%{http_code}' \
  -H "Authorization: token $FJ_TOKEN" "$API/actions/runs?page=1&limit=1")"
case "$code" in
  401 | 403 | 404) die "the forge answered $code: check fj's login and the repo path in API" ;;
esac

# Print one line per busy run, then "checked" once every run was read. A
# request that fails, an empty or misshapen reply, a run with no E2E job and
# any job state but a finished one all count as busy, and so does a check
# that stops before "checked": a false "clear" starts two E2E jobs at once.
busy_runs() {
  local runs active id label jobs e2e
  runs="$(api 'actions/runs?status=waiting&status=running')" || {
    echo "the active-run list did not answer"
    return
  }
  # jq -e fails on an empty reply, which plain jq reads as "no runs".
  jq -e '.workflow_runs | type == "array"' >/dev/null 2>&1 <<<"$runs" || {
    echo "the active-run list was unreadable"
    return
  }
  # A run has `commit_sha`; its `head_sha` and `head_branch` read null here.
  active="$(jq -r --arg own "$OWN" '.workflow_runs[]
      | select($own == "" or ((.commit_sha // "") | startswith($own) | not))
      | "\(.id) #\(.index_in_repo) \(.title)"' <<<"$runs")"
  while read -r id label; do
    [ -n "$id" ] || continue
    # The jobs reply is a bare array, not {jobs: [...]}.
    jobs="$(api "actions/runs/$id/jobs")" || {
      echo "run $id $label: its jobs did not answer"
      continue
    }
    if jq -e 'type == "array"' >/dev/null 2>&1 <<<"$jobs"; then
      e2e="$(jq -r --arg job "$JOB" '[.[] | select(.name == $job) | .status] | first // "missing"' \
        <<<"$jobs")"
    else
      e2e="unreadable"
    fi
    case "$e2e" in
      success | failure | cancelled | skipped) ;;
      *) echo "run $id $label: E2E $e2e" ;;
    esac
  done <<<"$active"
  echo "checked"
}

# Two sessions that wait on the same run see it end at the same poll, and
# both start an E2E job (#471's and #472's retros, 2026-10-26). So a clear
# check also claims the slot in a file the sessions on this host share, and
# another worktree's claim younger than CLAIM_TTL counts as busy. The new run
# shows up only after the pre-push hook (about 80 s) or after the session
# writes its PR body. 240 s is three times the hook, to leave room for that
# writing, and a session that then starts nothing holds the slot that long.
CLAIM_TTL=240
ME="$(git -C "$REPO" rev-parse --show-toplevel)"

# Write this worktree's claim, or print the other one and fail. The lock
# ends with the $(...) subshell this runs in; without flock (macOS) the
# read-check-write is unguarded, and sessions that poll 30 s apart rarely
# meet there.
claim_slot() {
  local now age at holder
  exec 9>>"$CLAIM.lock" || {
    echo "cannot open $CLAIM.lock"
    return 1
  }
  if command -v flock >/dev/null && ! flock -w 10 9; then
    echo "the claim lock stayed held for 10 s"
    return 1
  fi
  now=$(date +%s)
  read -r at holder 2>/dev/null <"$CLAIM"
  [[ "${at:-}" =~ ^[0-9]+$ ]] || at=0
  # Base 10, and a stamp from the future counts as stale.
  age=$((now - 10#$at))
  if [ -n "${holder:-}" ] && [ "$holder" != "$ME" ] && [ "$age" -ge 0 ] &&
    [ "$age" -lt "$CLAIM_TTL" ]; then
    echo "claimed by $holder $age s ago"
    return 1
  fi
  printf '%s %s\n' "$now" "$ME" >"$CLAIM"
}

deadline=$((start + WAIT))
while :; do
  out="$(busy_runs)"
  if [ "$out" = "checked" ]; then
    out="$(claim_slot)" && {
      echo "wait-e2e-slot: clear at $(date +%T)"
      exit 0
    }
  fi
  busy="${out%checked}"
  busy="${busy%$'\n'}"
  [ -n "$busy" ] || busy="the check stopped before it read every run"
  printf '%s busy:\n%s\n' "$(date +%T)" "$busy"
  if [ $(($(date +%s) + 30)) -ge "$deadline" ]; then
    echo "wait-e2e-slot: still busy after $(($(date +%s) - start))s, run it again"
    exit 3
  fi
  sleep 30
done

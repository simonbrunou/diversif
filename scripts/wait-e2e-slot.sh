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
# Each poll also queues this worktree in E2E_SLOT_CLAIM.queue, and the
# worktrees on this host take the slot in the order they joined. A call that
# ends on exit 3 keeps its place for the next call; a waiter that has not
# polled for WAITER_TTL (120 s) drops out. A clear check claims the slot
# for this worktree in the file E2E_SLOT_CLAIM (default
# diversif-e2e-slot.claim in $XDG_RUNTIME_DIR, else in /tmp), but only once
# no live waiter joined before it, and another worktree's fresh claim counts
# as busy (take_turn). While this worktree's own claim is fresh, it goes
# before every waiter. Each busy poll prints the waiters ahead of you.
# Exit 0: no other E2E job waits or runs, no other worktree holds a claim
# and no other waiter is ahead. Exit 3: still busy or behind another waiter,
# run it again. Exit 2: no token on this host, the forge refused it, or a
# wrong call (a bad SHA or E2E_WAIT, a JOB that ci.yml no longer names, or a
# claim file it cannot write); it also drops this worktree from the queue.
# E2E_SLOT_API replaces the forge's repo API URL, for the test.
#
# It reads `actions/runs` and each run's jobs. `actions/tasks` lists only the
# jobs a runner has taken, so a queued run and an E2E job still waiting for a
# slot are missing there. Hand-written loops read a busy runner as clear twice
# on 2026-10-25: once on run ids zsh kept as one word, once on a jobs reply
# read as an object.
set -uo pipefail

API="${E2E_SLOT_API:-https://git.sbrn.eu/api/v1/repos/simonbrunou/diversif}"
# The job's `name:` in .forgejo/workflows/ci.yml; checked below.
JOB="End-to-end tests (Playwright)"
REPO="$(dirname "$0")/.."
WAIT="${E2E_WAIT:-420}"
CLAIM="${E2E_SLOT_CLAIM:-${XDG_RUNTIME_DIR:-/tmp}/diversif-e2e-slot.claim}"
# The waiters, one line each, "<joined> <seen> <worktree>", in the order
# they joined.
QUEUE="$CLAIM.queue"
# The identity of this worktree in the claim and in the queue.
ME="$(git -C "$REPO" rev-parse --show-toplevel 2>/dev/null)"
# Whoever polled first after a run ended took the slot, so on 2026-11-01 the
# #600 session waited 70 min while two sessions that came later started
# three E2E jobs (#615). So each poll refreshes this worktree's line in the
# queue, before and after its forge check, and a waiter whose line is
# WAITER_TTL old drops out. Two refreshes come at most 30 s apart, or one
# forge check apart when the forge is slower; between two calls come the gap
# while the agent reads exit 3 and the next call's first request. 120 s
# leaves room for both, and a session that ended holds the queue that long.
# A forge check that takes longer (five runs whose every request takes its
# full 20 s) still sends the waiter to the back.
WAITER_TTL=120

# Take the claim lock on fd 9, or print why not and fail. The lock ends with
# the shell that took it: take_turn runs in a subshell, so a session never
# holds it through its 30 s sleep. Without flock (macOS) the
# read-check-write of the claim and the queue is unguarded, and sessions that
# poll 30 s apart rarely meet there.
lock() {
  exec 9>>"$CLAIM.lock" || {
    echo "cannot open $CLAIM.lock"
    return 1
  }
  if command -v flock >/dev/null && ! flock -w 10 9; then
    echo "the claim lock stayed held for 10 s"
    return 1
  fi
}

# An epoch stamp as a clock time: GNU date, else BSD date (macOS).
clock() {
  date -d "@$1" +%T 2>/dev/null || date -r "$1" +%T
}

# Read the queue's live lines, in file order, into the caller's variables:
# rest, the other worktrees' lines; queue, the same with this worktree's
# line kept in its place with its seen stamp set to $1 (now), or added at
# the end; ahead, one line for each waiter that joined before this worktree,
# or in the same second above it. Base 10, and a stamp from the future
# counts as stale.
read_queue() {
  local now=$1 joined seen who line age mine="" above=1
  queue="" rest="" ahead=""
  while read -r joined seen who; do
    [[ "${joined:-}" =~ ^[0-9]+$ && "${seen:-}" =~ ^[0-9]+$ && -n "${who:-}" ]] || continue
    age=$((now - 10#$seen))
    [ "$age" -ge 0 ] && [ "$age" -lt "$WAITER_TTL" ] || continue
    line="$((10#$joined)) $((10#$seen)) $who"
    if [ "$who" = "$ME" ]; then
      [ -z "$mine" ] || continue
      mine=$((10#$joined))
      line="$mine $now $ME"
    else
      rest+="$line"$'\n'
    fi
    queue+="$line"$'\n'
  done 2>/dev/null <"$QUEUE"
  if [ -z "$mine" ]; then
    mine=$now
    queue+="$now $now $ME"$'\n'
  fi
  # The here-string adds a blank line after queue's last newline.
  while read -r joined seen who; do
    if [ -z "${who:-}" ]; then
      continue
    elif [ "$who" = "$ME" ]; then
      above=""
    elif [ "$joined" -lt "$mine" ] || { [ "$joined" -eq "$mine" ] && [ -n "$above" ]; }; then
      ahead+="ahead in the queue: $who, waiting since $(clock "$joined")"$'\n'
    fi
  done <<<"$queue"
}

# Drop this worktree's line from the queue, if it can: die calls it, also
# before the claim file's directory was checked.
leave_queue() {
  local queue rest ahead
  [ -n "$ME" ] && [ -f "$QUEUE" ] || return 0
  lock >/dev/null 2>&1 || return 0
  read_queue "$(date +%s)"
  printf '%s' "$rest" 2>/dev/null >"$QUEUE"
}

die() {
  echo "wait-e2e-slot: $1" >&2
  leave_queue
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
[ -d "$(dirname "$CLAIM")" ] && [ -w "$(dirname "$CLAIM")" ] && [ ! -d "$CLAIM" ] &&
  [ ! -d "$QUEUE" ] || die "cannot write the claim file $CLAIM or its queue"
[ -n "$ME" ] || die "$REPO is not inside a git worktree"

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

# Refresh this worktree's line in the queue. When $1 is 1 (the forge check
# read clear), no waiter is ahead and no other worktree holds a fresh claim,
# write the claim, leave the queue and succeed. Otherwise print that claim
# and each waiter ahead, and fail. This worktree's own fresh claim puts it
# ahead of every waiter: the command it chained after its exit 0 failed
# before it started an E2E job (a pre-push hook, say), and it calls again.
take_turn() {
  local now at holder age queue rest ahead reasons=""
  lock || return 1
  now=$(date +%s)
  read_queue "$now"
  read -r at holder 2>/dev/null <"$CLAIM"
  [[ "${at:-}" =~ ^[0-9]+$ ]] || at=0
  age=$((now - 10#$at))
  if [ -n "${holder:-}" ] && [ "$age" -ge 0 ] && [ "$age" -lt "$CLAIM_TTL" ]; then
    if [ "$holder" = "$ME" ]; then
      ahead=""
    else
      reasons="claimed by $holder $age s ago"$'\n'
    fi
  fi
  if [ -z "$reasons" ] && [ "$1" = 1 ] && [ -z "$ahead" ]; then
    printf '%s %s\n' "$now" "$ME" 2>/dev/null >"$CLAIM" &&
      printf '%s' "$rest" 2>/dev/null >"$QUEUE" && return 0
    reasons="cannot write $CLAIM or $QUEUE"$'\n'
  fi
  printf '%s' "$queue" 2>/dev/null >"$QUEUE" || reasons+="cannot write $QUEUE"$'\n'
  printf '%s%s' "$reasons" "$ahead"
  return 1
}

deadline=$((start + WAIT))
while :; do
  # Refresh this worktree's line before the forge check too (WAITER_TTL), in
  # a subshell so that the lock ends with it.
  (take_turn 0 >/dev/null)
  out="$(busy_runs)"
  clear=0
  [ "$out" = "checked" ] && clear=1
  reasons="$(take_turn "$clear")" && {
    echo "wait-e2e-slot: clear at $(date +%T)"
    exit 0
  }
  printf '%s busy:\n' "$(date +%T)"
  if [ "$clear" = 0 ]; then
    busy="${out%checked}"
    busy="${busy%$'\n'}"
    printf '%s\n' "${busy:-the check stopped before it read every run}"
  fi
  [ -z "$reasons" ] || printf '%s\n' "$reasons"
  if [ $(($(date +%s) + 30)) -ge "$deadline" ]; then
    echo "wait-e2e-slot: still busy after $(($(date +%s) - start))s," \
      "run it again at once to keep your place in the queue"
    exit 3
  fi
  sleep 30
done

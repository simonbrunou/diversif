#!/usr/bin/env bash
# Wait until no other CI run of this repo has its E2E job waiting or running,
# before a push, a merge to main or a rerun starts another one. The rule and
# why: docs/agents/testing.md, « Start an E2E job only when no other one runs
# or waits ».
#
#   scripts/wait-e2e-slot.sh [<own sha>]
#
# <own sha> (full or a prefix of 7+ characters) leaves out the runs of that
# commit: your branch's pushed head, whose run your next push cancels. It
# polls every 30 s for up to E2E_WAIT seconds (default 480, so one call ends
# inside Claude Code's 600 s Bash cap) and prints each busy run it sees.
# Exit 0: no other E2E job waits or runs. Exit 3: still busy, run it again.
# Exit 2: the forge refused the token, or the call itself is wrong.
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
OWN="$(printf '%s' "${1:-}" | tr '[:upper:]' '[:lower:]')"
WAIT="${E2E_WAIT:-480}"

die() {
  echo "wait-e2e-slot: $1" >&2
  exit 2
}

[[ "$WAIT" =~ ^[0-9]+$ ]] || die "E2E_WAIT must be a number of seconds, got '$WAIT'"
[ -z "$OWN" ] || [[ "$OWN" =~ ^[0-9a-f]{7,40}$ ]] || die "'$1' is not a commit SHA"
grep -qF "name: $JOB" "$(dirname "$0")/../.forgejo/workflows/ci.yml" ||
  die "ci.yml has no job named '$JOB': update JOB in this script"

keys="$HOME/.local/share/forgejo-cli/keys.json"
[ -f "$keys" ] || keys="$HOME/Library/Application Support/forgejo-cli/keys.json"
FJ_TOKEN="$(jq -r '.hosts["git.sbrn.eu"].token // empty' "$keys" 2>/dev/null)"
[ -n "$FJ_TOKEN" ] || die "no git.sbrn.eu token in fj's keys.json (log fj in on this host)"

api() {
  curl -sSf --max-time 20 -H "Authorization: token $FJ_TOKEN" "$API/$1"
}

code="$(curl -s --max-time 20 -o /dev/null -w '%{http_code}' \
  -H "Authorization: token $FJ_TOKEN" "$API/actions/runs?page=1&limit=1")"
case "$code" in
  401 | 403 | 404) die "the forge answered $code to the token: check fj's login" ;;
esac

# Print one line per busy run, then "checked" once every run was read. A
# request that fails, a reply jq can't read and a run with no E2E job all
# count as busy, and so does a check that stops before "checked": a false
# "clear" is what starts two E2E jobs at once.
busy_runs() {
  local runs active id label jobs e2e
  runs="$(api 'actions/runs?status=waiting&status=running')" || {
    echo "the active-run list did not answer"
    return
  }
  # A run has `commit_sha`; its `head_sha` and `head_branch` read null here.
  active="$(jq -r --arg own "$OWN" '.workflow_runs[]
      | select($own == "" or ((.commit_sha // "") | startswith($own) | not))
      | "\(.id) #\(.index_in_repo) \(.title)"' <<<"$runs")" || {
    echo "the active-run list was unreadable"
    return
  }
  while read -r id label; do
    [ -n "$id" ] || continue
    # The jobs reply is a bare array, not {jobs: [...]}.
    jobs="$(api "actions/runs/$id/jobs")" || {
      echo "run $id $label: its jobs did not answer"
      continue
    }
    e2e="$(jq -r --arg job "$JOB" '[.[] | select(.name == $job) | .status] | first // "missing"' \
      <<<"$jobs")" || e2e="unreadable"
    case "$e2e" in
      waiting | running | missing | unreadable) echo "run $id $label: E2E $e2e" ;;
    esac
  done <<<"$active"
  echo "checked"
}

deadline=$(($(date +%s) + WAIT))
while :; do
  out="$(busy_runs)"
  if [ "$out" = "checked" ]; then
    echo "wait-e2e-slot: clear at $(date +%T)"
    exit 0
  fi
  busy="${out%checked}"
  busy="${busy%$'\n'}"
  [ -n "$busy" ] || busy="the check stopped before it read every run"
  printf '%s busy:\n%s\n' "$(date +%T)" "$busy"
  if [ $(($(date +%s) + 30)) -ge "$deadline" ]; then
    echo "wait-e2e-slot: still busy after ${WAIT}s, run it again"
    exit 3
  fi
  sleep 30
done

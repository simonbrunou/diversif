#!/usr/bin/env bash
# Wait until no other CI run of this repo has its E2E job waiting or running,
# before a push, a merge to main or a rerun starts another one. The rule and
# why: docs/agents/testing.md, « Start an E2E job only when no other one runs
# or waits ».
#
#   scripts/e2e-busy.sh [<own sha>]
#
# <own sha> skips the runs of that commit, your own branch head. It polls every
# 30 s for at most E2E_WAIT seconds (default 540, under Claude Code's 600 s
# Bash cap) and prints each busy run it sees.
# Exit 0: no other E2E job waits or runs. Exit 3: still busy, run it again.
# Exit 2: no fj token on this host.
#
# It reads `actions/runs` and each run's jobs. `actions/tasks` lists only the
# jobs a runner has taken, so a queued run and an E2E job still waiting for a
# slot are missing there. Hand-written loops read a busy runner as clear twice
# on 2026-10-25: once on run ids zsh kept as one word, once on a jobs reply
# read as an object.
set -uo pipefail

API="https://git.sbrn.eu/api/v1/repos/simonbrunou/diversif"
JOB="End-to-end tests (Playwright)"
OWN="${1:-}"
WAIT="${E2E_WAIT:-540}"

keys="$HOME/.local/share/forgejo-cli/keys.json"
[ -f "$keys" ] || keys="$HOME/Library/Application Support/forgejo-cli/keys.json"
TOKEN="$(jq -r '.hosts["git.sbrn.eu"].token // empty' "$keys" 2>/dev/null)"

api() {
  curl -sSf --max-time 20 -H "Authorization: token $TOKEN" "$API/$1"
}

# Print one line per busy run. A request that fails, a reply jq can't read and
# a run with no E2E job all count as busy: this Forgejo answers them during
# outages, and a false "clear" is what starts two E2E jobs at once.
busy_runs() {
  local runs ids id label jobs status
  runs="$(api 'actions/runs?status=waiting&status=running')" || {
    echo "the active-run list did not answer"
    return
  }
  # A run has `commit_sha`; its `head_sha` and `head_branch` read null here.
  ids="$(jq -r --arg own "$OWN" \
    '.workflow_runs[] | select(.commit_sha != $own) | "\(.id) #\(.index_in_repo) \(.title)"' \
    <<<"$runs")" || {
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
    status="$(jq -r --arg job "$JOB" '[.[] | select(.name == $job) | .status] | first // "missing"' \
      <<<"$jobs")" || status="unreadable"
    case "$status" in
      waiting | running | missing | unreadable) echo "run $id $label: E2E $status" ;;
    esac
  done <<<"$ids"
}

if [ -z "$TOKEN" ]; then
  echo "e2e-busy: no git.sbrn.eu token in fj's keys.json (log fj in on this host)" >&2
  exit 2
fi

deadline=$(($(date +%s) + WAIT))
while :; do
  busy="$(busy_runs)"
  if [ -z "$busy" ]; then
    echo "e2e-busy: clear at $(date +%T)"
    exit 0
  fi
  printf '%s busy:\n%s\n' "$(date +%T)" "$busy"
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "e2e-busy: still busy after ${WAIT}s, run it again"
    exit 3
  fi
  sleep 30
done

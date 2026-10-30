#!/usr/bin/env bash
# Public HTTP smoke test of the production deploy. Run it after a merge to
# main, with the new main head SHA, to wait for that build to go live and then
# check it. Without a SHA it only checks whatever is live now.
#
#   scripts/smoke-prod.sh [<sha>]
#
# SMOKE_BASE_URL overrides the target (default https://diversif.app).
# SMOKE_WAIT is how long to wait for <sha> to go live, in seconds (default
# 540). SMOKE_CHECK_TIME (default 50) is the time the checks get on top of it.
# A run, with a SHA or without, ends SMOKE_WAIT + SMOKE_CHECK_TIME seconds
# after it starts at the latest (590 s by default), so it fits in one 600 s
# agent Bash call: a check left with no time fails with "not run: the time
# budget ran out". A `git fetch origin` still running 1 s before the deadline
# is cut off and counts as a failed fetch.
# Exit 0: every check passed. 1: a check failed, /_app/version.json never
# reported a version, <sha> is not a commit on main, or, given a <sha>, this
# file is not the scripts/smoke-prod.sh of a git checkout. 3: an older
# commit still served after SMOKE_WAIT, so the checks did not run. A check
# whose curl call fails (no answer, or one cut short) is retried up to 3
# times, 5 s apart.
# What each check expects, why, and what to run after exit 3:
# docs/agents/deploy.md.
set -uo pipefail

BASE="${SMOKE_BASE_URL:-https://diversif.app}"
SHA="${1:-}"
WAIT="${SMOKE_WAIT:-540}"
CHECK_TIME="${SMOKE_CHECK_TIME:-50}"

# clock: sets $now to the time in milliseconds. Bash before 5.0 (macOS's
# /bin/bash) has no EPOCHREALTIME, so the clock falls back to whole seconds,
# rounded up so that the time left is never overstated.
clock() {
  if [ -n "${EPOCHREALTIME:-}" ]; then
    now="${EPOCHREALTIME//[!0-9]/}" # microseconds; the separator follows the locale
    now="${now%???}"
  else
    now="$(($(date +%s) + 1))000"
  fi
}
clock
# The run starts at the second the rounded-up clock read is in.
[ -n "${EPOCHREALTIME:-}" ] || now=$((now - 1000))
wait_end=$((now + WAIT * 1000))
run_end=$((wait_end + CHECK_TIME * 1000))

# secs <ms>: the milliseconds as seconds, for curl and sleep.
secs() { printf '%d.%03d' $(($1 / 1000)) $(($1 % 1000)); }

TMP="$(mktemp -d)"
# It also sends TERM to a fetch_origin still running, which job control keeps
# out of reach of a Ctrl-C, and KILL to its timer.
trap 'rm -rf "$TMP"
[ -z "${fetch_pid:-}" ] || kill -TERM -- -"$fetch_pid" 2>/dev/null
[ -z "${fetch_timer:-}" ] || kill -KILL -- -"$fetch_timer" 2>/dev/null' EXIT

passed=0
failed=0
pass() { passed=$((passed + 1)); printf 'PASS %s\n' "$1"; }
fail() { failed=$((failed + 1)); printf 'FAIL %s\n' "$1"; }
late() { fail "$1 not run: the time budget ran out"; }

# fetch <path> [<end>]: body to $TMP/body, headers to $TMP/headers, sets $code
# and $ctype, and $got to a readable "<code> <content type>" for FAIL lines.
# The request gets 20 s, or less so that it ends by <end> (the run deadline by
# default). Once <end> has passed it is not sent: $code is 'late', and $got
# keeps the answer to the request before.
fetch() {
  local out max
  : >"$TMP/body"
  : >"$TMP/headers"
  clock
  max=$((${2:-$run_end} - now))
  # curl --max-time 0 would mean no limit at all.
  if [ "$max" -le 0 ]; then
    code=late
    return
  fi
  [ "$max" -le 20000 ] || max=20000
  out="$(curl -sS --max-time "$(secs "$max")" -o "$TMP/body" -D "$TMP/headers" \
    -w '%{http_code} %{content_type}' "$BASE$1" 2>"$TMP/err")" || out="000 "
  code="${out%% *}"
  ctype="${out#* }"
  if [ "$code" = 000 ]; then
    got="no answer ($(tr '\n' ' ' <"$TMP/err" | sed 's/ *$//'))"
  else
    got="$code ${ctype:-with no Content-Type}"
  fi
}

# fetch_retry <path>: fetch, retrying up to 3 times, 5 s apart, while curl
# fails ($code 000): during the container swap a request can time out, be
# refused or be cut short. A full answer is never retried, 5xx included. Once
# one check has used up its retries the script treats the host as down, not
# swapping, so later checks get one try each and a dead host does not spend
# the whole time budget on the first ones. No retry starts when its sleep
# would end at or after the run deadline: the check keeps the curl error.
host_down=''
fetch_retry() {
  local attempt tries=4 delay=5
  for ((attempt = 1; attempt <= tries; attempt++)); do
    if [ "$attempt" -gt 1 ]; then
      clock
      [ $((now + delay * 1000)) -lt "$run_end" ] || return
      printf 'RETRY %s got %s, attempt %d of %d in %d s\n' "$1" "$got" "$attempt" "$tries" "$delay"
      sleep "$delay"
    fi
    fetch "$1"
    if [ "$code" != 000 ] || [ -n "$host_down" ]; then return; fi
  done
  host_down=1
}

# header <name>: the value of that response header from the last fetch.
header() {
  grep -i "^$1:" "$TMP/headers" | head -n 1 | cut -d: -f2- | tr -d '\r' | sed 's/^ *//'
}

# expect <path> <status> [<content-type glob>]: fetch, then check both.
expect() {
  fetch_retry "$1"
  # shellcheck disable=SC2053 # $3 is a glob on purpose.
  if [ "$code" = late ]; then
    late "$1"
  elif [ "$code" = "$2" ] && [[ "$ctype" == ${3:-*} ]]; then
    pass "$1 $code ${ctype:-}"
  else
    fail "$1 returned $got, expected $2 ${3:-}"
  fi
}

# Sets $live to the SHA /_app/version.json reports, or '' when unreadable.
# The request ends by the end of the wait.
read_live() {
  live=''
  fetch /_app/version.json "$wait_end"
  [ "$code" = 200 ] && live="$(sed -n 's/.*"version":"\([^"]*\)".*/\1/p' "$TMP/body")"
}

REPO="$(dirname "$0")/.."

# fetch_origin: git fetch origin, cut off by the run deadline. Fails when the
# fetch fails or is cut off. Job control (set -m) starts the fetch and its
# timer each in a process group of its own, so that a kill reaches git with
# its ssh or upload-pack child, and the timer with its sleep. Their output
# goes to /dev/null: none keeps the script's open. The timer sends the fetch
# TERM 1 s before the deadline, which lets git remove its lock files, then
# KILL at the deadline: a script started with TERM ignored passes that on,
# and git then outlives TERM when its child ignores it too. Once git has
# exited after the TERM, KILL ends a child that ignored it. The timer gets
# KILL, as it may ignore TERM too, and signals nothing once the script is
# gone. The exit trap sends TERM to a fetch that the script's own end
# interrupts.
fetch_pid=''
fetch_timer=''
fetch_origin() {
  local term cut status
  clock
  [ "$run_end" -gt "$now" ] || return 1
  # The time to the TERM, and when it comes: at once with under 1 s left.
  term=$((run_end - now - 1000))
  [ "$term" -gt 0 ] || term=0
  cut=$((now + term))
  set -m
  git -C "$REPO" fetch -q origin </dev/null >/dev/null 2>&1 &
  fetch_pid=$!
  {
    sleep "$(secs "$term")"
    kill -0 $$ && kill -TERM -- -"$fetch_pid"
    sleep "$(secs $((run_end - cut)))"
    kill -0 $$ && kill -KILL -- -"$fetch_pid"
  } </dev/null >/dev/null 2>&1 &
  fetch_timer=$!
  set +m
  # Bash reports a job a signal killed on stderr, unless wait reaps it there.
  wait "$fetch_pid" 2>/dev/null
  status=$?
  clock
  [ "$now" -lt "$cut" ] || kill -KILL -- -"$fetch_pid" 2>/dev/null
  fetch_pid=''
  kill -KILL -- -"$fetch_timer" 2>/dev/null
  wait "$fetch_timer" 2>/dev/null
  fetch_timer=''
  return "$status"
}

# A newer merge can replace <sha> before the wait ends: a live commit that
# contains <sha> counts as live too. Fetches origin once if $live is unknown.
fetched=''
contains_sha() {
  [[ "$live" =~ ^[0-9a-f]{7,40}$ ]] || return 1
  if ! git -C "$REPO" cat-file -e "$live^{commit}" 2>/dev/null && [ -z "$fetched" ]; then
    fetched=1
    fetch_origin
  fi
  git -C "$REPO" merge-base --is-ancestor "$SHA" "$live" 2>/dev/null
}

# on_main: the full SHA of <sha> when origin/main contains it, else nothing.
on_main() {
  local full
  full="$(git -C "$REPO" rev-parse --verify --quiet "$SHA^{commit}" 2>/dev/null)" || return 1
  git -C "$REPO" merge-base --is-ancestor "$full" origin/main 2>/dev/null && printf '%s' "$full"
}

# not_deployable <reason> [<hint>]: fail before the wait, which <sha> could
# never end.
not_deployable() {
  fail "$1"
  printf 'smoke-prod: %s\n' "${2:-pass the new main head (git fetch origin && git rev-parse origin/main)}"
  exit 1
}

if [ -n "$SHA" ]; then
  # version.json reports a lowercase SHA.
  SHA="$(printf '%s' "$SHA" | tr 'A-F' 'a-f')"
  [[ "$SHA" =~ ^[0-9a-f]{7,40}$ ]] || not_deployable "$SHA is not a commit SHA"
  # A copy elsewhere can tell neither whether <sha> is on main nor whether a
  # newer live commit contains it: its wait ends only on a live SHA that
  # starts with <sha>, so a later merge makes it time out.
  git -C "$REPO" ls-files --error-unmatch scripts/smoke-prod.sh >/dev/null 2>&1 ||
    not_deployable "$0 is not the scripts/smoke-prod.sh of a git checkout" \
      "run scripts/smoke-prod.sh by its path in a checkout, not a copy or a link"
  # Only main deploys. When the fetch fails (offline, no origin) or is cut off,
  # the wait below still matches <sha> as a prefix of the live SHA.
  if fetch_origin; then
    full="$(on_main)" || not_deployable "$SHA is not a commit on origin/main"
    SHA="$full"
  fi
  last_live=''
  while :; do
    read_live
    case "$live" in "$SHA"*) [ -n "$live" ] && break ;; esac
    contains_sha && break
    [ -z "$live" ] || last_live="$live"
    # Sleep 15 s between polls, or less so that the last poll still gets 1 s
    # before the wait ends. With no time left for one, the wait is over.
    clock
    pause=$((wait_end - now - 1000))
    if [ "$pause" -le 0 ]; then
      if [ -z "$last_live" ]; then
        # No $got when SMOKE_WAIT left no time for even one poll.
        if [ -n "${got:-}" ]; then
          fail "/_app/version.json returned $got after ${WAIT}s"
        else
          late /_app/version.json
        fi
        printf 'smoke-prod: %s not live on %s, checks skipped\n' "$SHA" "$BASE"
        exit 1
      fi
      # An older commit served: the deploy may still be running.
      printf 'PENDING /_app/version.json is %s, not %s after %ss\n' "$last_live" "$SHA" "$WAIT"
      printf 'smoke-prod: checks skipped; run homelab-stacks %s <app uuid> %s\n' \
        scripts/coolify-deploy-status.sh "$SHA"
      exit 3
    fi
    if [ "$pause" -ge 15000 ]; then sleep 15; else sleep "$(secs "$pause")"; fi
  done
  pass "/_app/version.json is $live"
fi

expect / 200 'text/html*'
if [ "$code" = late ]; then
  # These read the headers of the answer to /, which was never asked for.
  late CSP
  late HSTS
  late X-Frame-Options
else
  csp="$(header content-security-policy)"
  hsts="$(header strict-transport-security)"
  xfo="$(header x-frame-options)"
  if [[ "$csp" == *"default-src 'self'"* ]]; then pass "CSP has default-src 'self'"; else fail "CSP is '${csp}'"; fi
  if [[ "$hsts" == *max-age=* ]]; then pass "HSTS $hsts"; else fail "HSTS is '${hsts}'"; fi
  if [ "$xfo" = DENY ]; then pass "X-Frame-Options DENY"; else fail "X-Frame-Options is '${xfo}'"; fi
fi

expect /guide 200 'text/html*'
expect /en 200 'text/html*'
expect /_app/env.js 200 '*javascript*'
expect /service-worker.js 200 '*javascript*'
expect /sw.js 404

fetch_retry /healthz
if [ "$code" = late ]; then
  late /healthz
elif [ "$code" = 200 ] && grep -q '"ok":true' "$TMP/body" && grep -q '"db":"ok"' "$TMP/body"; then
  pass "/healthz ok, db ok"
else
  fail "/healthz returned $got $(head -c 120 "$TMP/body")"
fi

# Served with no Content-Type today; text/html is fine too.
fetch_retry /offline
if [ "$code" = late ]; then
  late /offline
elif [ "$code" = 200 ] && grep -qi '<html' "$TMP/body" && [[ -z "$ctype" || "$ctype" == text/html* ]]; then
  pass "/offline 200 HTML (Content-Type: ${ctype:-none})"
else
  fail "/offline returned $got, expected 200 HTML"
fi

total=$((passed + failed))
if [ "$failed" -eq 0 ]; then
  printf 'smoke-prod: %d of %d checks passed on %s\n' "$passed" "$total" "$BASE"
else
  printf 'smoke-prod: %d of %d checks failed on %s\n' "$failed" "$total" "$BASE"
  exit 1
fi

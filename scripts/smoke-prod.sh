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
# budget ran out". The one exception is a `git fetch origin` that hangs: it
# has no timeout of its own, and its time counts against the deadline.
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
trap 'rm -rf "$TMP"' EXIT

passed=0
failed=0
pass() { passed=$((passed + 1)); printf 'PASS %s\n' "$1"; }
fail() { failed=$((failed + 1)); printf 'FAIL %s\n' "$1"; }
late() { fail "$1 not run: the time budget ran out"; }

# fetch <path> [<end>]: body to $TMP/body, headers to $TMP/headers, sets $code
# and $ctype, and $got to a readable "<code> <content type>" for FAIL lines.
# The request gets 20 s, or less so that it ends by <end> (the run deadline by
# default). Once <end> has passed it is not sent and $code is 'late'.
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
# The request ends by the end of the wait, but gets 1 s at least, so that
# SMOKE_WAIT=0 still polls once.
read_live() {
  local end
  live=''
  clock
  end=$((now + 1000))
  [ "$wait_end" -le "$end" ] || end="$wait_end"
  fetch /_app/version.json "$end"
  [ "$code" = 200 ] && live="$(sed -n 's/.*"version":"\([^"]*\)".*/\1/p' "$TMP/body")"
}

# A newer merge can replace <sha> before the wait ends: a live commit that
# contains <sha> counts as live too. Fetches origin once if $live is unknown.
REPO="$(dirname "$0")/.."
fetched=''
contains_sha() {
  [[ "$live" =~ ^[0-9a-f]{7,40}$ ]] || return 1
  if ! git -C "$REPO" cat-file -e "$live^{commit}" 2>/dev/null && [ -z "$fetched" ]; then
    fetched=1
    git -C "$REPO" fetch -q origin 2>/dev/null
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
  # Only main deploys. When the fetch fails (offline, no origin), the wait
  # below still matches <sha> as a prefix of the live SHA.
  if git -C "$REPO" fetch -q origin 2>/dev/null; then
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
        fail "/_app/version.json returned $got after ${WAIT}s"
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

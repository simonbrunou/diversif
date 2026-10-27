#!/usr/bin/env bash
# Public HTTP smoke test of the production deploy. Run it after a merge to
# main, with the new main head SHA, to wait for that build to go live and then
# check it. Without a SHA it only checks whatever is live now.
#
#   scripts/smoke-prod.sh [<sha>]
#
# SMOKE_BASE_URL overrides the target (default https://diversif.app).
# SMOKE_WAIT is how long to wait for <sha> to go live, in seconds (default
# 540, so a failed wait still ends inside one 600 s agent Bash call).
# Exit 0: every check passed. 1: a check failed, /_app/version.json never
# reported a version, or <sha> is not a commit on main. 3: an older commit
# still served after SMOKE_WAIT, so the checks did not run. A check whose
# request gets no HTTP answer is retried up to 3 times, 5 s apart.
# What each check expects, why, and what to run after exit 3:
# docs/agents/deploy.md.
set -uo pipefail

BASE="${SMOKE_BASE_URL:-https://diversif.app}"
SHA="${1:-}"
WAIT="${SMOKE_WAIT:-540}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

passed=0
failed=0
pass() { passed=$((passed + 1)); printf 'PASS %s\n' "$1"; }
fail() { failed=$((failed + 1)); printf 'FAIL %s\n' "$1"; }

# fetch <path>: body to $TMP/body, headers to $TMP/headers, sets $code and
# $ctype, and $got to a readable "<code> <content type>" for FAIL lines.
fetch() {
  local out
  : >"$TMP/body"
  : >"$TMP/headers"
  out="$(curl -sS --max-time 20 -o "$TMP/body" -D "$TMP/headers" \
    -w '%{http_code} %{content_type}' "$BASE$1" 2>"$TMP/err")" || out="000 "
  code="${out%% *}"
  ctype="${out#* }"
  if [ "$code" = 000 ]; then
    got="no answer ($(tr '\n' ' ' <"$TMP/err" | sed 's/ *$//'))"
  else
    got="$code ${ctype:-with no Content-Type}"
  fi
}

# fetch_check <path>: fetch for a check, retrying up to 3 times, 5 s apart,
# while the request gets no HTTP answer: during the container swap a request
# can time out or be refused. Any HTTP status is an answer, 5xx included.
# Once one check has used up its retries the host is down, not swapping, so
# later checks get one try each: a run where every request times out still
# ends inside one 600 s agent Bash call.
host_down=''
fetch_check() {
  local attempt=1
  fetch "$1"
  while [ "$code" = 000 ] && [ -z "$host_down" ]; do
    if [ "$attempt" -eq 4 ]; then
      host_down=1
      return
    fi
    attempt=$((attempt + 1))
    printf 'RETRY %s got %s, attempt %d of 4 in 5 s\n' "$1" "$got" "$attempt"
    sleep 5
    fetch "$1"
  done
}

# header <name>: the value of that response header from the last fetch.
header() {
  grep -i "^$1:" "$TMP/headers" | head -n 1 | cut -d: -f2- | tr -d '\r' | sed 's/^ *//'
}

# expect <path> <status> [<content-type glob>]: fetch, then check both.
expect() {
  fetch_check "$1"
  # shellcheck disable=SC2053 # $3 is a glob on purpose.
  if [ "$code" = "$2" ] && [[ "$ctype" == ${3:-*} ]]; then
    pass "$1 $code ${ctype:-}"
  else
    fail "$1 returned $got, expected $2 ${3:-}"
  fi
}

# Sets $live to the SHA /_app/version.json reports, or '' when unreadable.
read_live() {
  live=''
  fetch /_app/version.json
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

# not_deployable <reason>: fail before the wait, which <sha> could never end.
not_deployable() {
  fail "$1"
  printf 'smoke-prod: pass the new main head (git fetch origin && git rev-parse origin/main)\n'
  exit 1
}

if [ -n "$SHA" ]; then
  deadline=$(($(date +%s) + WAIT))
  # version.json reports a lowercase SHA.
  SHA="$(printf '%s' "$SHA" | tr 'A-F' 'a-f')"
  [[ "$SHA" =~ ^[0-9a-f]{7,40}$ ]] || not_deployable "$SHA is not a commit SHA"
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
    if [ "$(date +%s)" -ge "$deadline" ]; then
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
    sleep 15
  done
  pass "/_app/version.json is $live"
fi

expect / 200 'text/html*'
csp="$(header content-security-policy)"
hsts="$(header strict-transport-security)"
xfo="$(header x-frame-options)"
if [[ "$csp" == *"default-src 'self'"* ]]; then pass "CSP has default-src 'self'"; else fail "CSP is '${csp}'"; fi
if [[ "$hsts" == *max-age=* ]]; then pass "HSTS $hsts"; else fail "HSTS is '${hsts}'"; fi
if [ "$xfo" = DENY ]; then pass "X-Frame-Options DENY"; else fail "X-Frame-Options is '${xfo}'"; fi

expect /guide 200 'text/html*'
expect /en 200 'text/html*'
expect /_app/env.js 200 '*javascript*'
expect /service-worker.js 200 '*javascript*'
expect /sw.js 404

fetch_check /healthz
if [ "$code" = 200 ] && grep -q '"ok":true' "$TMP/body" && grep -q '"db":"ok"' "$TMP/body"; then
  pass "/healthz ok, db ok"
else
  fail "/healthz returned $got $(head -c 120 "$TMP/body")"
fi

# Served with no Content-Type today; text/html is fine too.
fetch_check /offline
if [ "$code" = 200 ] && grep -qi '<html' "$TMP/body" && [[ -z "$ctype" || "$ctype" == text/html* ]]; then
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

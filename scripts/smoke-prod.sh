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
# What each check expects, and why: docs/agents/deploy.md.
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

# header <name>: the value of that response header from the last fetch.
header() {
  grep -i "^$1:" "$TMP/headers" | head -n 1 | cut -d: -f2- | tr -d '\r' | sed 's/^ *//'
}

# expect <path> <status> [<content-type glob>]: fetch, then check both.
expect() {
  fetch "$1"
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

if [ -n "$SHA" ]; then
  # A mistyped SHA can never go live: fail now instead of after the wait.
  resolve() { git -C "$REPO" rev-parse --verify --quiet "$SHA^{commit}" 2>/dev/null; }
  full="$(resolve)"
  if [ -z "$full" ]; then
    fetched=1
    git -C "$REPO" fetch -q origin 2>/dev/null
    full="$(resolve)"
  fi
  if [ -z "$full" ]; then
    fail "$SHA names no single commit in this clone, even after git fetch origin"
    printf 'smoke-prod: pass the new main head (git rev-parse origin/main)\n'
    exit 1
  fi
  SHA="$full"
  deadline=$(($(date +%s) + WAIT))
  while :; do
    read_live
    case "$live" in "$SHA"*) [ -n "$live" ] && break ;; esac
    contains_sha && break
    if [ "$(date +%s)" -ge "$deadline" ]; then
      if [ -n "$live" ]; then
        fail "/_app/version.json is $live, not $SHA after ${WAIT}s"
      else
        fail "/_app/version.json returned $got after ${WAIT}s"
      fi
      printf 'smoke-prod: %s not live on %s, checks skipped\n' "$SHA" "$BASE"
      exit 1
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

fetch /healthz
if [ "$code" = 200 ] && grep -q '"ok":true' "$TMP/body" && grep -q '"db":"ok"' "$TMP/body"; then
  pass "/healthz ok, db ok"
else
  fail "/healthz returned $got $(head -c 120 "$TMP/body")"
fi

# Served with no Content-Type today; text/html is fine too.
fetch /offline
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

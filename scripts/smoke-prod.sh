#!/usr/bin/env bash
# Public HTTP smoke test of the production deploy. Run it after a merge to
# main, with the new main head SHA, to wait for that build to go live and then
# check it. Without a SHA it only checks whatever is live now.
#
#   scripts/smoke-prod.sh [<sha>]
#
# SMOKE_BASE_URL overrides the target (default https://diversif.app).
# SMOKE_WAIT is how long to wait for <sha> to go live, in seconds (default 600).
# What each check expects, and why: docs/agents/deploy.md.
set -uo pipefail

BASE="${SMOKE_BASE_URL:-https://diversif.app}"
SHA="${1:-}"
WAIT="${SMOKE_WAIT:-600}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

passed=0
failed=0
pass() { passed=$((passed + 1)); printf 'PASS %s\n' "$1"; }
fail() { failed=$((failed + 1)); printf 'FAIL %s\n' "$1"; }

# fetch <path>: body to $TMP/body, headers to $TMP/headers, sets $code and $ctype.
fetch() {
  local out
  : >"$TMP/body"
  : >"$TMP/headers"
  out="$(curl -sS --max-time 20 -o "$TMP/body" -D "$TMP/headers" \
    -w '%{http_code} %{content_type}' "$BASE$1" 2>"$TMP/err")" || out="000 "
  code="${out%% *}"
  ctype="${out#* }"
}

# header <name>: the value of that response header from the last fetch.
header() {
  grep -i "^$1:" "$TMP/headers" | head -n 1 | cut -d: -f2- | tr -d '\r' | sed 's/^ *//'
}

deployed_version() {
  fetch /_app/version.json
  [ "$code" = 200 ] || return 1
  sed -n 's/.*"version":"\([^"]*\)".*/\1/p' "$TMP/body"
}

if [ -n "$SHA" ]; then
  deadline=$(($(date +%s) + WAIT))
  while :; do
    live="$(deployed_version)"
    case "$live" in "$SHA"*) break ;; esac
    if [ "$(date +%s)" -ge "$deadline" ]; then
      fail "/_app/version.json is ${live:-unreadable}, not $SHA after ${WAIT}s"
      printf 'smoke-prod: %s not live on %s, checks skipped\n' "$SHA" "$BASE"
      exit 1
    fi
    sleep 15
  done
  pass "/_app/version.json is $live"
fi

for path in / /guide /en; do
  fetch "$path"
  if [ "$code" = 200 ] && [[ "$ctype" == text/html* ]]; then
    pass "$path 200 $ctype"
  else
    fail "$path returned $code ${ctype:-no Content-Type}, expected 200 text/html"
  fi
  if [ "$path" = / ]; then
    csp="$(header content-security-policy)"
    hsts="$(header strict-transport-security)"
    xfo="$(header x-frame-options)"
    if [[ "$csp" == *"default-src 'self'"* ]]; then pass "CSP has default-src 'self'"; else fail "CSP is '${csp}'"; fi
    if [[ "$hsts" == *max-age=* ]]; then pass "HSTS $hsts"; else fail "HSTS is '${hsts}'"; fi
    if [ "$xfo" = DENY ]; then pass "X-Frame-Options DENY"; else fail "X-Frame-Options is '${xfo}'"; fi
  fi
done

fetch /healthz
if [ "$code" = 200 ] && grep -q '"ok":true' "$TMP/body" && grep -q '"db":"ok"' "$TMP/body"; then
  pass "/healthz ok, db ok"
else
  fail "/healthz returned $code $(head -c 120 "$TMP/body")"
fi

fetch /service-worker.js
if [ "$code" = 200 ] && [[ "$ctype" == *javascript* ]]; then
  pass "/service-worker.js 200 $ctype"
else
  fail "/service-worker.js returned $code ${ctype:-no Content-Type}, expected 200 JavaScript"
fi

fetch /sw.js
if [ "$code" = 404 ]; then
  pass "/sw.js 404 (old worker path, gone on purpose)"
else
  fail "/sw.js returned $code, expected 404"
fi

fetch /offline
if [ "$code" = 200 ] && grep -qi '<html' "$TMP/body" && { [ -z "$ctype" ] || [[ "$ctype" == text/html* ]]; }; then
  pass "/offline 200 HTML (Content-Type: ${ctype:-none})"
else
  fail "/offline returned $code ${ctype:-no Content-Type}, expected 200 HTML"
fi

total=$((passed + failed))
if [ "$failed" -eq 0 ]; then
  printf 'smoke-prod: %d of %d checks passed on %s\n' "$passed" "$total" "$BASE"
else
  printf 'smoke-prod: %d of %d checks failed on %s\n' "$failed" "$total" "$BASE"
  exit 1
fi

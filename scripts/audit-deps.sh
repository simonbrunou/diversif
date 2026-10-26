#!/usr/bin/env bash
# Run the dependency audit of CI's `bun-audit` job, which calls this script
# once per scope, so a local run runs the same commands as CI. Why the gate
# sits at `high` and how the `overrides` block keeps it clean: the comment on
# that job in .forgejo/workflows/ci.yml.
#
#   scripts/audit-deps.sh [production|all]
#
# production: installs package.json with its devDependencies stripped into a
#   temporary directory, then audits that install: the production
#   dependencies, the set the Dockerfile's prod-deps stage installs. That
#   stage installs from bun.lock, while this scope resolves from the ranges,
#   so it audits the newest versions they allow, which can change from one
#   run to the next. Bun 1.4 also accepts `bun audit --production`, though
#   `--help` doesn't list it; this scope doesn't rely on it.
# all: runs `bun install --frozen-lockfile` in the repo, dev and build tooling
#   included, then audits it. The install also syncs the checkout's
#   node_modules to bun.lock. The Railpack production deploy ships this whole
#   set (#529).
# With no argument it runs both scopes and fails if either fails.
# The local Bun can differ from the version CI pins (#528).
# Exit 0: no advisory at high or above. Exit 2: a wrong call. Any other
# exit: an advisory or a failed install, and the output names it.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LEVEL=high
TMP=""

cleanup() {
  if [ -n "$TMP" ]; then rm -rf "$TMP"; fi
}
trap cleanup EXIT

# Each scope chains its commands with && instead of relying on set -e, which
# bash ignores inside a function called from an `||` list.
audit_production() {
  echo "== audit-deps: production dependencies only"
  TMP="$(mktemp -d)" &&
    PKG_IN="$REPO/package.json" PKG_OUT="$TMP/package.json" bun -e '
      const pkg = require(process.env.PKG_IN);
      delete pkg.devDependencies;
      require("fs").writeFileSync(process.env.PKG_OUT, JSON.stringify(pkg));
    ' &&
    (cd "$TMP" && bun install --ignore-scripts && bun audit --audit-level="$LEVEL")
}

audit_all() {
  echo "== audit-deps: all dependencies (dev and build tooling included)"
  (cd "$REPO" && bun install --frozen-lockfile && bun audit --audit-level="$LEVEL")
}

usage() {
  echo "usage: scripts/audit-deps.sh [production|all]" >&2
  exit 2
}

if [ $# -eq 0 ]; then
  status=0
  audit_production || status=$?
  audit_all || status=$?
  exit "$status"
fi
if [ $# -gt 1 ]; then usage; fi

case "$1" in
  production) audit_production ;;
  all) audit_all ;;
  *) usage ;;
esac

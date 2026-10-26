#!/usr/bin/env bash
# Run the dependency audit of CI's `bun-audit` job, which calls this script
# once per scope, so a local run checks exactly what CI checks. Why the gate
# sits at `high` and how the `overrides` block keeps it clean: the comment on
# that job in .forgejo/workflows/ci.yml.
#
#   scripts/audit-deps.sh [production|all]
#
# production: installs package.json with its devDependencies stripped into a
#   temporary directory, then audits that install. It resolves from the
#   ranges, without bun.lock, so it audits the newest versions they allow.
# all: installs the repo from bun.lock (--frozen-lockfile), dev and build
#   tooling included, then audits it.
# With no argument it runs both scopes and fails if either fails.
# Exit 0: no advisory at high or above. Exit 2: a wrong call. Any other
# exit: an advisory or a failed install, printed above it.
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
  echo "== audit-deps: production dependencies (strict: ships in the runtime image)"
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

case "${1:-both}" in
  production) audit_production ;;
  all) audit_all ;;
  both)
    status=0
    audit_production || status=$?
    audit_all || status=$?
    exit "$status"
    ;;
  *)
    echo "usage: scripts/audit-deps.sh [production|all]" >&2
    exit 2
    ;;
esac

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
#   dependencies, the set both production images install (the Dockerfile's
#   prod-deps stage, and the prune step of the Railpack image Coolify
#   deploys, #529). The images install from bun.lock, while this scope
#   resolves from the ranges, so it audits the newest versions they allow,
#   which can change from one run to the next. From bun.lock the images also
#   get the packages that production dependencies reach only through an
#   optional peer, such as eslint, typescript and esbuild, which this scope
#   does not install: on 2026-11-13, 78 of the image's 235 top-level
#   packages were missing from this scope's install for that reason, and 2
#   more because it resolved a newer @sentry/bundler-plugins that drops
#   supports-color. Bun 1.4 also accepts
#   `bun audit --production`, though `--help` doesn't list it; this scope
#   doesn't rely on it.
# all: runs `bun install --frozen-lockfile` in the repo, dev and build tooling
#   included, then audits it. The install also syncs the checkout's
#   node_modules to bun.lock. It is the scope that covers those packages the
#   images ship, and the tooling that no image ships.
# With no argument it runs both scopes and fails if either fails.
# The dev shell's Bun can lag the version CI pins: scripts/check-bun-pins.sh
# prints the pinned version and warns when the shell runs another (#528).
#
# Both scopes pass `--ignore=GHSA-fc5q-39xc-vjpf` to `bun audit` (#780). That
# advisory (picomatch ReDoS through single-branch repeated extglobs, high)
# covers picomatch <= 4.0.7, and on 2026-11-18 npm had no release past 4.0.7,
# so no bump or `overrides` entry could clear it. picomatch reaches the
# production install only through vite, and only for globs the repo's own
# config writes. The ignore expires by itself: before any audit, each run
# asks the npm registry for picomatch's `latest` dist-tag
# (`bun info picomatch dist-tags.latest`), once, with no retry. When that
# version is past 4.0.7, the run fails and says so: remove IGNORE_GHSA,
# IGNORE_PACKAGE, IGNORE_UP_TO, check_ignore_expiry and its call, the
# `--ignore` of both scopes, the tests in scripts/audit-deps.test.ts that
# cover them, and this paragraph, then bump picomatch as the « new advisory »
# bullet of docs/agents/testing.md says. A failed lookup, or one that prints
# no version, also fails the run.
#
# Exit 0: no advisory at high or above, the ignored one aside. Exit 2: a
# wrong call. Any other exit: an advisory, a failed install, a failed
# registry lookup or an expired ignore, and the output names it.
set -uo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
LEVEL=high
TMP=""
# The one advisory both scopes ignore, and the newest picomatch it covers
# (header, #780).
IGNORE_GHSA=GHSA-fc5q-39xc-vjpf
IGNORE_PACKAGE=picomatch
IGNORE_UP_TO=4.0.7

cleanup() {
  if [ -n "$TMP" ]; then rm -rf "$TMP"; fi
}
trap cleanup EXIT

# Fails once npm's latest picomatch is past IGNORE_UP_TO, or when the lookup
# fails or prints no version. One lookup, no retry.
check_ignore_expiry() {
  local lookup="bun info $IGNORE_PACKAGE dist-tags.latest"
  local latest verdict
  if ! latest="$(cd "$REPO" && bun info "$IGNORE_PACKAGE" dist-tags.latest)"; then
    echo "audit-deps: the registry lookup \`$lookup\` failed, so the run cannot tell whether the ignore of $IGNORE_GHSA has expired" >&2
    return 1
  fi
  # Bun.semver.order throws on an empty or malformed version.
  verdict="$(LATEST="$latest" UP_TO="$IGNORE_UP_TO" bun -e '
    try {
      const newer = Bun.semver.order(process.env.LATEST, process.env.UP_TO) > 0;
      console.log(newer ? "newer" : "covered");
    } catch {
      console.log("invalid");
    }
  ')"
  case "$verdict" in
    covered) ;;
    newer)
      echo "audit-deps: npm's latest $IGNORE_PACKAGE is $latest, past the $IGNORE_UP_TO that the ignore of $IGNORE_GHSA covers. Drop that ignore (header of scripts/audit-deps.sh, #780) and bump $IGNORE_PACKAGE as the « new advisory » bullet of docs/agents/testing.md says." >&2
      return 1
      ;;
    *)
      echo "audit-deps: the registry lookup \`$lookup\` printed '$latest', not a version, so the run cannot tell whether the ignore of $IGNORE_GHSA has expired" >&2
      return 1
      ;;
  esac
}

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
    (cd "$TMP" && bun install --ignore-scripts && bun audit --audit-level="$LEVEL" --ignore="$IGNORE_GHSA")
}

audit_all() {
  echo "== audit-deps: all dependencies (dev and build tooling included)"
  (cd "$REPO" && bun install --frozen-lockfile && bun audit --audit-level="$LEVEL" --ignore="$IGNORE_GHSA")
}

usage() {
  echo "usage: scripts/audit-deps.sh [production|all]" >&2
  exit 2
}

# Check the call before the registry lookup, so a wrong call exits 2 without
# touching the network.
if [ $# -gt 1 ]; then usage; fi
if [ $# -eq 1 ]; then
  case "$1" in
    production | all) ;;
    *) usage ;;
  esac
fi

check_ignore_expiry || exit 1

if [ $# -eq 0 ]; then
  status=0
  audit_production || status=$?
  audit_all || status=$?
  exit "$status"
fi
case "$1" in
  production) audit_production ;;
  all) audit_all ;;
esac

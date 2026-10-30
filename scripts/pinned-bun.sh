#!/usr/bin/env bash
# Run a command with the Bun that CI and production pin first on PATH. The
# dev shell's Bun follows nixpkgs and may lag that pin, and a result can
# depend on the version: Bun 1.4.4's coverage counts a default-parameter line
# that 1.4.2's does not (#528, docs/agents/testing.md).
#
#   nix develop -c scripts/pinned-bun.sh bun run test:coverage
#
# It reads the version from railpack.json's `packages.bun`, which
# scripts/check-bun-pins.sh keeps equal to CI's and the Dockerfile's. The
# first run for a version downloads that release's zip for this host from
# GitHub, checks it against the release's SHASUMS256.txt and unzips it into
# $PINNED_BUN_DIR/<version> (default /tmp/bun-pinned); later runs reuse it.
# PINNED_BUN_RELEASES replaces the download base
# (https://github.com/oven-sh/bun/releases/download) for the tests in
# scripts/pinned-bun.test.ts.
# Exit 2: no command, no x.y.z version in railpack.json, a host Bun ships no
# build for, a failed download, a checksum that does not match, or an
# unzipped bun that reports another version. Otherwise the command's own
# exit code.
set -uo pipefail

fail() {
  echo "pinned-bun: $*" >&2
  exit 2
}

[ $# -gt 0 ] || fail "usage: scripts/pinned-bun.sh <command> [<arg>...]"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

version=$(RAILPACK="$ROOT/railpack.json" bun -e \
  'console.log(require(process.env.RAILPACK).packages?.bun ?? "")' 2>/dev/null)
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] ||
  fail "railpack.json holds no x.y.z packages.bun (read: '$version')"

case "$(uname -s)-$(uname -m)" in
  Linux-x86_64) asset=bun-linux-x64 ;;
  Linux-aarch64) asset=bun-linux-aarch64 ;;
  Darwin-arm64) asset=bun-darwin-aarch64 ;;
  Darwin-x86_64) asset=bun-darwin-x64 ;;
  *) fail "no Bun build for $(uname -s) $(uname -m)" ;;
esac

dir="${PINNED_BUN_DIR:-/tmp/bun-pinned}/$version"
if [ ! -x "$dir/$asset/bun" ]; then
  base="${PINNED_BUN_RELEASES:-https://github.com/oven-sh/bun/releases/download}/bun-v$version"
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT
  echo "pinned-bun: downloading Bun $version ($asset) from $base" >&2
  curl -fsSL -o "$tmp/$asset.zip" "$base/$asset.zip" &&
    curl -fsSL -o "$tmp/SHASUMS256.txt" "$base/SHASUMS256.txt" ||
    fail "the download from $base failed"
  expected=$(awk -v f="$asset.zip" '$2 == f { print $1 }' "$tmp/SHASUMS256.txt")
  if command -v sha256sum >/dev/null 2>&1; then
    actual=$(sha256sum "$tmp/$asset.zip" | cut -d' ' -f1)
  else
    actual=$(shasum -a 256 "$tmp/$asset.zip" | cut -d' ' -f1)
  fi
  [ -n "$expected" ] && [ "$expected" = "$actual" ] ||
    fail "$asset.zip does not match its SHASUMS256.txt line (expected '$expected', got '$actual')"
  unzip -q "$tmp/$asset.zip" -d "$tmp/out" || fail "could not unzip $asset.zip"
  mkdir -p "$dir"
  # Another run may have installed it meanwhile; keep the first one.
  [ -e "$dir/$asset" ] || mv "$tmp/out/$asset" "$dir/$asset" ||
    fail "could not move Bun $version into $dir"
  rm -rf "$tmp"
  trap - EXIT
fi

running=$("$dir/$asset/bun" --version 2>/dev/null)
[ "$running" = "$version" ] ||
  fail "$dir/$asset/bun reports '$running', not $version: delete $dir and run again"

PATH="$dir/$asset:$PATH" exec "$@"

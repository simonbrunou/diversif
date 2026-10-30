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
# first run for a version downloads that release's bun-linux-x64.zip from
# GitHub, checks it against the release's SHASUMS256.txt and unzips it into
# $PINNED_BUN_DIR/<version> (default ~/.cache/bun-pinned, which only this
# user can write); later runs reuse it. A run that starts while another one
# installs the same version waits for it under a lock, then reuses its
# install. PINNED_BUN_RELEASES replaces the download base
# (https://github.com/oven-sh/bun/releases/download) for the tests in
# scripts/pinned-bun.test.ts. It runs on x86_64 Linux only, the one system
# flake.nix gives a dev shell for.
# Exit 2: no command, no x.y.z version in railpack.json, another system, a
# failed download, a checksum that does not match, a zip that does not
# unzip, a cache it cannot write, or a bun that reports another version.
# Otherwise the command's own exit code.
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

system="$(uname -s) $(uname -m)"
[ "$system" = "Linux x86_64" ] ||
  fail "runs on x86_64 Linux only, the one system flake.nix gives a dev shell for, not $system"
asset=bun-linux-x64

cache="${PINNED_BUN_DIR:-${XDG_CACHE_HOME:-$HOME/.cache}/bun-pinned}"
dir="$cache/$version"
mkdir -p -m 700 "$cache" 2>/dev/null || fail "could not create $cache"
# Held until the command starts: one run installs a version at a time.
exec 9>"$dir.lock" || fail "could not open $dir.lock"
if ! flock -n 9; then
  echo "pinned-bun: waiting for another run to install Bun $version" >&2
  flock 9 || fail "could not lock $dir.lock"
fi
if [ ! -x "$dir/$asset/bun" ]; then
  # In the cache, so the move below is a rename on one file system.
  tmp=$(mktemp -d "$cache/.download.XXXXXX") || fail "could not create a directory in $cache"
  trap 'rm -rf "$tmp"' EXIT
  base="${PINNED_BUN_RELEASES:-https://github.com/oven-sh/bun/releases/download}/bun-v$version"
  echo "pinned-bun: downloading Bun $version from $base" >&2
  curl -fsSL -o "$tmp/$asset.zip" "$base/$asset.zip" &&
    curl -fsSL -o "$tmp/SHASUMS256.txt" "$base/SHASUMS256.txt" ||
    fail "the download from $base failed"
  expected=$(awk -v f="$asset.zip" '$2 == f { print $1 }' "$tmp/SHASUMS256.txt")
  actual=$(sha256sum "$tmp/$asset.zip" | cut -d' ' -f1)
  [ -n "$expected" ] && [ "$expected" = "$actual" ] ||
    fail "$asset.zip does not match its SHASUMS256.txt line (expected '$expected', got '$actual')"
  unzip -q "$tmp/$asset.zip" -d "$tmp/out" 2>/dev/null || fail "could not unzip $asset.zip"
  # A directory left without its bun would take the move below inside it.
  rm -rf "${dir:?}/$asset"
  mkdir -p "$dir" 2>/dev/null && mv "$tmp/out/$asset" "$dir/$asset" ||
    fail "could not move Bun $version into $dir"
  rm -rf "$tmp"
  trap - EXIT
fi
exec 9>&-

running=$("$dir/$asset/bun" --version 2>/dev/null)
[ "$running" = "$version" ] ||
  fail "$dir/$asset/bun reports '$running', not $version: delete $dir and run again"

PATH="$dir/$asset:$PATH" exec "$@"

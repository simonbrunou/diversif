#!/usr/bin/env bash
# Check that CI, the production build and the Docker image pin one Bun
# version (#528). CI's `Lint + typecheck` job calls this script, so a local
# run runs the same check.
#
#   scripts/check-bun-pins.sh [<repo dir>]
#
# It reads each pin from the file that sets it:
#   .forgejo/workflows/ci.yml  the `bun-version` input of every
#     oven-sh/setup-bun step. A step without one runs whatever Bun setup-bun
#     picks, so the inputs must be as many as the steps.
#   railpack.json  `packages.bun`, the Bun of the production build
#     (docs/agents/deploy.md).
#   Dockerfile  the version part of every `FROM oven/bun:<tag>` (1.4.4 out of
#     1.4.4-debian@sha256:...).
# The bun group in renovate.json moves the three together. The dev shell's
# Bun follows nixpkgs and may lag them, so a `bun --version` that differs
# prints a warning only (docs/agents/testing.md).
# Exit 0: every pin reads the same version. Exit 1: the pins differ or one is
# missing, and the output names each file, line and value. Exit 2: a wrong
# call.
set -uo pipefail

if [ $# -gt 1 ]; then
  echo "usage: scripts/check-bun-pins.sh [<repo dir>]" >&2
  exit 2
fi
ROOT="${1:-$(cd "$(dirname "$0")/.." && pwd)}"
if [ ! -d "$ROOT" ]; then
  echo "check-bun-pins: no directory $ROOT" >&2
  exit 2
fi
# It parses railpack.json with bun, so in CI it runs after setup-bun.
if ! command -v bun >/dev/null 2>&1; then
  echo "check-bun-pins: needs bun on PATH" >&2
  exit 2
fi

CI=.forgejo/workflows/ci.yml
RAILPACK=railpack.json
DOCKERFILE=Dockerfile

# One entry per pin: where it is, and the version it reads.
where=()
version=()
status=0

missing() {
  echo "check-bun-pins: $1" >&2
  status=1
}

read_ci() {
  local file="$ROOT/$CI" steps inputs=0 line value
  if [ ! -f "$file" ]; then
    missing "$CI not found"
    return
  fi
  steps=$(grep -cE '^[[:space:]-]*uses:[[:space:]]*oven-sh/setup-bun@' "$file")
  while IFS= read -r line; do
    value=$(printf '%s\n' "${line#*:}" |
      sed -E "s/^[[:space:]]*bun-version:[[:space:]]*['\"]?([^'\"[:space:]#]*).*/\1/")
    where+=("$CI:${line%%:*}")
    version+=("$value")
    inputs=$((inputs + 1))
  done < <(grep -nE '^[[:space:]]*bun-version:' "$file")
  if [ "$steps" -eq 0 ]; then
    missing "$CI has no oven-sh/setup-bun step"
  elif [ "$inputs" -ne "$steps" ]; then
    missing "$CI has $steps oven-sh/setup-bun steps but $inputs bun-version inputs"
  fi
}

read_railpack() {
  local file="$ROOT/$RAILPACK" value
  if [ ! -f "$file" ]; then
    missing "$RAILPACK not found"
    return
  fi
  value=$(PIN_FILE="$file" bun -e '
    const v = JSON.parse(require("fs").readFileSync(process.env.PIN_FILE, "utf8")).packages?.bun;
    if (typeof v === "string") console.log(v);
  ') || {
    missing "$RAILPACK is not valid JSON"
    return
  }
  if [ -z "$value" ]; then
    missing "$RAILPACK has no packages.bun"
    return
  fi
  where+=("$RAILPACK packages.bun")
  version+=("$value")
}

read_dockerfile() {
  local file="$ROOT/$DOCKERFILE" line tag found=0
  if [ ! -f "$file" ]; then
    missing "$DOCKERFILE not found"
    return
  fi
  while IFS= read -r line; do
    found=1
    # The tag, without the digest: empty when the image has no tag.
    tag=$(printf '%s\n' "$line" | sed -nE 's#.*oven/bun:([^[:space:]@]+).*#\1#p')
    where+=("$DOCKERFILE:${line%%:*}")
    version+=("$(printf '%s\n' "$tag" | grep -oE '^[0-9]+\.[0-9]+\.[0-9]+' || true)")
    if [ -z "${version[${#version[@]} - 1]}" ]; then
      missing "$DOCKERFILE:${line%%:*} oven/bun tag '${tag}' carries no version"
    fi
  done < <(grep -niE '^[[:space:]]*FROM[[:space:]]+(--[^[:space:]]+[[:space:]]+)*oven/bun([:@[:space:]]|$)' "$file")
  if [ "$found" -eq 0 ]; then
    missing "$DOCKERFILE has no FROM oven/bun line"
  fi
}

read_ci
read_railpack
read_dockerfile

expected="${version[0]:-}"
differ=0
for v in "${version[@]}"; do
  if [ "$v" != "$expected" ]; then differ=1; fi
done

if [ "$differ" -eq 1 ] || [ "$status" -ne 0 ]; then
  if [ "$differ" -eq 1 ]; then echo "check-bun-pins: the Bun pins differ" >&2; fi
  for i in "${!where[@]}"; do
    printf '  %s  %s\n' "${where[$i]}" "${version[$i]:-<none>}" >&2
  done
  exit 1
fi

echo "check-bun-pins: ${#version[@]} pins read Bun $expected ($CI, $RAILPACK, $DOCKERFILE)"
running=$(bun --version)
if [ "$running" != "$expected" ]; then
  echo "check-bun-pins: warning: this shell runs Bun $running, not $expected." \
    "The dev shell's Bun follows nixpkgs (docs/agents/testing.md)." >&2
fi

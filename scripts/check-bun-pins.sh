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
#     picks, so each step must carry its own, and a `bun-version` outside such
#     a step fails too.
#   railpack.json  `packages.bun`, the Bun of the production build
#     (docs/agents/deploy.md).
#   Dockerfile  the x.y.z part of every `FROM [<registry>/]oven/bun:<tag>`
#     (1.4.4 out of 1.4.4-debian@sha256:...).
# The bun group in renovate.json moves the three together. The dev shell's
# Bun follows nixpkgs and may lag them, so a `bun --version` that differs
# prints a warning only (docs/agents/testing.md).
# Exit 0: every pin reads the same version. Exit 1: the pins differ or one is
# missing, and the output names each file, line and value. Exit 2: a wrong
# call, a <repo dir> that does not exist, or no bun on PATH.
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

pin() {
  where+=("$1")
  version+=("$2")
}

fail() {
  echo "check-bun-pins: $1" >&2
  status=1
}

read_ci() {
  local file="$ROOT/$CI" kind line value steps=0
  if [ ! -f "$file" ]; then
    fail "$CI not found"
    return
  fi
  # A step ends at the next line indented no deeper than its `-`, and its
  # `with:` block at the next line indented no deeper than `with:`. Prints
  # `pin <line> <value>` per input in a setup-bun step's `with:`,
  # `nopin <line>` for a setup-bun step without one, `stray <line>` for a
  # `bun-version` anywhere else (setup-bun ignores one under `env:`).
  while read -r kind line value; do
    case "$kind" in
      pin)
        steps=$((steps + 1))
        pin "$CI:$line" "$value"
        ;;
      nopin)
        steps=$((steps + 1))
        fail "$CI:$line oven-sh/setup-bun step has no bun-version"
        ;;
      stray) fail "$CI:$line bun-version is not in an oven-sh/setup-bun step" ;;
    esac
  done < <(awk -v q="'" '
    function indent(s) { match(s, /^ */); return RLENGTH }
    function close_step() { if (open) print "nopin", open; open = 0; inwith = 0 }
    { sub(/\r$/, "") }
    /^[ \t]*(#|$)/ { next }
    {
      ind = indent($0)
      if (open && ind <= step) close_step()
      if (inwith && ind <= withind) inwith = 0
      # A list item: remember its dash by the column its keys start at.
      if (match($0, /^ *- +/)) dash[RLENGTH] = ind
    }
    $0 ~ ("^[ \t-]*uses:[ \t]*[\"" q "]?oven-sh/setup-bun@") {
      open = NR
      # `- uses:` opens the step; a bare `uses:` belongs to the item whose
      # keys start at its column.
      if ($0 ~ /^ *- /) step = ind
      else step = (ind in dash) ? dash[ind] : ind - 2
      next
    }
    open && /^[ \t]*with:[ \t]*(#.*)?$/ { inwith = 1; withind = ind; next }
    /^[ \t]*bun-version:/ {
      v = $0
      sub(/^[ \t]*bun-version:[ \t]*/, "", v)
      sub(/[ \t]*#.*$/, "", v)
      gsub(/"/, "", v)
      gsub(q, "", v)
      if (open && inwith) { print "pin", NR, v; open = 0; inwith = 0 } else print "stray", NR
    }
    END { close_step() }
  ' "$file")
  if [ "$steps" -eq 0 ]; then
    fail "$CI has no oven-sh/setup-bun step"
  fi
}

read_railpack() {
  local file="$ROOT/$RAILPACK" value
  if [ ! -f "$file" ]; then
    fail "$RAILPACK not found"
    return
  fi
  value=$(PIN_FILE="$file" bun -e '
    let config;
    try {
      config = JSON.parse(require("fs").readFileSync(process.env.PIN_FILE, "utf8"));
    } catch {
      process.exit(1);
    }
    const v = config?.packages?.bun;
    if (typeof v === "string") console.log(v);
  ') || {
    fail "$RAILPACK is not valid JSON"
    return
  }
  if [ -z "$value" ]; then
    fail "$RAILPACK has no packages.bun"
    return
  fi
  pin "$RAILPACK packages.bun" "$value"
}

read_dockerfile() {
  local file="$ROOT/$DOCKERFILE" line tag value found=0
  if [ ! -f "$file" ]; then
    fail "$DOCKERFILE not found"
    return
  fi
  while IFS= read -r line; do
    found=1
    # The tag, without the digest: empty when the image has no tag.
    tag=$(printf '%s\n' "$line" | sed -nE 's#.*oven/bun:([^[:space:]@]+).*#\1#p')
    value=$(printf '%s\n' "$tag" | grep -oE '^[0-9]+\.[0-9]+\.[0-9]+' || true)
    pin "$DOCKERFILE:${line%%:*}" "$value"
    if [ -z "$tag" ]; then
      fail "$DOCKERFILE:${line%%:*} oven/bun has no tag"
    elif [ -z "$value" ]; then
      fail "$DOCKERFILE:${line%%:*} oven/bun tag '${tag}' does not start with an x.y.z version"
    fi
  done < <(grep -niE '^[[:space:]]*FROM[[:space:]]+(--[^[:space:]]+[[:space:]]+)*([^[:space:]]+/)?oven/bun([:@[:space:]]|$)' "$file")
  if [ "$found" -eq 0 ]; then
    fail "$DOCKERFILE has no FROM oven/bun line"
  fi
  # An image named by a build arg (FROM ${IMAGE}) hides its tag from this
  # check, so it fails instead of passing that stage unread.
  while IFS= read -r line; do
    fail "$DOCKERFILE:${line%%:*} FROM takes its image from a build arg, which this check cannot read"
  done < <(grep -niE '^[[:space:]]*FROM[[:space:]]+(--[^[:space:]]+[[:space:]]+)*[^[:space:]]*\$' "$file")
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

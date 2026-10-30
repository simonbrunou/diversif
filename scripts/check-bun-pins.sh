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
#     (1.4.4 out of 1.4.4-debian@sha256:...). It reads lines, continuations
#     and comments as BuildKit's parser does (see read_dockerfile). Where
#     this script could read a Dockerfile otherwise than Docker does, it
#     fails rather than skip a line: a heredoc body (RUN <<EOF) reads like
#     any other line, so a body line FROM oven/bun:<tag> counts as a stage,
#     and so does a line that starts with FROM inside a continued
#     instruction, read with the lines that continue it; an escape directive
#     other than a backslash fails. Skipping heredoc bodies would take
#     BuildKit's parser, and any way this script read one differently could
#     let a real stage go unread.
# The bun group in renovate.json moves the three together. The dev shell's
# Bun follows nixpkgs and may lag them, so a `bun --version` that differs
# prints a warning only (docs/agents/testing.md).
# Exit 0: every pin reads the same version. Exit 1: the pins differ or one is
# missing, and the output names each file, line and value. Exit 2: a wrong
# call, a <repo dir> that does not exist, or no bun on PATH.
# scripts/check-bun-pins.test.ts runs it on edited copies of the three files,
# one failure class per test: add a test there when the parsing changes.
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

# Whether a FROM line named an oven/bun image.
found_bun=0

# Read one FROM: its line number and image.
read_from() {
  local n="$1" image="$2" ref name last tag value
  # An image named by a build arg (FROM ${IMAGE}) hides its tag from this
  # check, so it fails instead of passing that stage unread.
  if [[ "$image" == *'$'* ]]; then
    fail "$DOCKERFILE:$n FROM takes its image from a build arg, which this check cannot read"
    return
  fi
  ref=${image%%@*}
  # The tag follows the last colon after the last slash, so a registry port
  # (localhost:5000/oven/bun) is not read as a tag.
  name=$ref
  tag=
  last=${ref##*/}
  if [[ "$last" == *:* ]]; then
    tag=${last##*:}
    name=${ref%:*}
  fi
  if [[ ! "$name" =~ (^|/)oven/bun$ ]]; then
    return
  fi
  found_bun=1
  value=
  if [[ "$tag" =~ ^[0-9]+\.[0-9]+\.[0-9]+ ]]; then value=${BASH_REMATCH[0]}; fi
  pin "$DOCKERFILE:$n" "$value"
  if [ -z "$tag" ]; then
    fail "$DOCKERFILE:$n oven/bun has no tag"
  elif [ -z "$value" ]; then
    fail "$DOCKERFILE:$n oven/bun tag '${tag}' does not start with an x.y.z version"
  fi
}

read_dockerfile() {
  local file="$ROOT/$DOCKERFILE" entry n i
  local -a words
  if [ ! -f "$file" ]; then
    fail "$DOCKERFILE not found"
    return
  fi
  while IFS= read -r entry; do
    n=${entry%%:*}
    entry=${entry#*:}
    if [ "$entry" = '#escape' ]; then
      fail "$DOCKERFILE:$n sets an escape character other than a backslash, which this check does not read"
      continue
    fi
    read -ra words <<<"$entry"
    # Skip the flags (--platform=...) between FROM and the image.
    i=1
    while [[ "${words[i]:-}" == --* ]]; do i=$((i + 1)); done
    read_from "$n" "${words[i]:-}"
  done < <(
    # One `<line>:FROM ...` per FROM instruction, read line by line as
    # BuildKit's parser (frontend/dockerfile/parser/parser.go, Parse) reads
    # a Dockerfile: trailing CRs and, on line 1, a UTF-8 byte order mark
    # dropped; leading Unicode spaces trimmed from an instruction's first
    # line; comment lines, and blank lines inside an instruction, skipped; a
    # line that ends in one backslash (not two) continued into the next
    # with no separator; words split on tabs, vertical tabs, form feeds, CRs
    # and spaces. Two rules read more than Docker, failing closed: a line
    # that starts with FROM inside a continued instruction also prints, with
    # the lines that continue it, since Docker may end the instruction
    # before it (a heredoc end word that ends in a backslash); and any escape
    # directive other than a backslash prints `<line>:#escape`, since
    # escape=` makes a backslash literal and this parser does not follow it.
    LC_ALL=C awk '
      # bytes.TrimLeftFunc(s, unicode.IsSpace), on UTF-8 bytes.
      function ltrim(s) {
        while (match(s, /^([\t\n\v\f\r ]|\302[\205\240]|\341\232\200|\342\200[\200-\212\250\251\257]|\342\201\237|\343\200\200)/))
          s = substr(s, RLENGTH + 1)
        return s
      }
      # The column of s where a FROM instruction word starts, or 0.
      function from_at(s, t) {
        t = ltrim(s)
        if (tolower(t) !~ /^from([\t\v\f\r ]|$)/) return 0
        return length(s) - length(t) + 1
      }
      function out(n, s) {
        gsub(/[\t\v\f\r]/, " ", s)
        print n ":" s
      }
      # The instruction if it is a FROM, then each FROM line inside it: the
      # rest of buf from the column at[k] where line inner[k] starts.
      function emit(k, c) {
        if ((c = from_at(buf))) out(start, substr(buf, c))
        for (k = 1; k <= froms; k++) if (inner[k] != start) out(inner[k], substr(buf, at[k]))
      }
      { sub(/\r+$/, "") }
      NR == 1 { sub(/^\357\273\277/, "") }
      {
        t = ltrim($0)
        if (t ~ /^#/) {
          d = ltrim(substr(t, 2))
          if (tolower(d) ~ /^escape[\t\n\v\f\r ]*=/ && d !~ /=[\t\n\v\f\r ]*\\[\t\n\v\f\r ]*$/) print NR ":#escape"
          next
        }
        if (t == "") next
        line = cont ? $0 : t
        if (!cont) {
          buf = ""
          start = NR
          froms = 0
        } else if ((c = from_at(line))) {
          froms++
          inner[froms] = NR
          at[froms] = length(buf) + c
        }
        cont = line ~ /(^|[^\\])\\[ \t]*$/
        if (cont) sub(/\\[ \t]*$/, "", line)
        buf = buf line
        if (!cont) emit()
      }
      END { if (cont) emit() }
    ' "$file" | grep -iE '^[0-9]+:(FROM|#escape$)'
  )
  if [ "$found_bun" -eq 0 ]; then
    fail "$DOCKERFILE has no FROM oven/bun line"
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

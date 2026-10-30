#!/usr/bin/env bash
# Check that CI, the production build and the Docker image pin one Bun
# version (#528). CI's `Lint + typecheck` job calls this script, so a local
# run runs the same check.
#
#   scripts/check-bun-pins.sh [<repo dir>]
#
# It reads each pin from the file that sets it:
#   .forgejo/workflows/ci.yml  the `bun-version` input of every
#     oven-sh/setup-bun step (its `uses:` may name the action by a full URL,
#     in any letter case). A step without one runs whatever Bun setup-bun
#     picks, so each step must carry its own, and it must read an x.y.z
#     version. A `bun-version` anywhere else fails too: under env:, outside
#     any setup-bun step, or nested deeper than the inputs of `with:`, which
#     are the keys at the indentation of the first line under it. A quoted
#     value keeps its text up to the closing quote, and a plain one loses
#     only a comment (a # after a blank). The step and its `with:` must be
#     block mappings, `uses:` before `with:`, as in this repo's ci.yml (an
#     anchor or !!map may name the `with:`), and the body of a block scalar
#     (run: |) is skipped. Reading any other form would take a YAML parser,
#     so these fail rather than pass a pin the check did not read: a step or
#     `with:` in flow style (with: { bun-version: 1.4.4 }); any line that
#     names setup-bun@ outside its comment and outside a `uses:` this reader
#     opens a step on; a `bun-version` value that runs onto the next line;
#     and, anywhere in the file, an escape in a double-quoted string
#     ("bun\x2dversion"), an alias (*name), an explicit key (? ), a tag
#     other than !!map (!!binary decodes to other text), and a quoted string
#     or a flow collection left open at the line end.
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
  # The awk program prints one tab-separated line per step and per refused
  # line, a kind and a line number: `pin <line> <value>` for a setup-bun
  # step's bun-version input, and a kind of its own for each form the header
  # lists as failing. The value keeps its blanks, so `" 1.4.4"` fails.
  while IFS=$'\t' read -r kind line value; do
    case "$kind" in
      pin)
        steps=$((steps + 1))
        if [[ "$value" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
          pin "$CI:$line" "$value"
        else
          fail "$CI:$line bun-version '$value' is not an x.y.z version"
        fi
        ;;
      nopin)
        steps=$((steps + 1))
        fail "$CI:$line oven-sh/setup-bun step has no bun-version"
        ;;
      continued)
        steps=$((steps + 1))
        fail "$CI:$line bun-version continues on the next line, which this check cannot read"
        ;;
      flow)
        steps=$((steps + 1))
        fail "$CI:$line oven-sh/setup-bun step does not write with: as a block mapping, which this check cannot read"
        ;;
      flowstep)
        steps=$((steps + 1))
        fail "$CI:$line names setup-bun@ in a flow mapping or sequence ({ uses: ... }), which this check cannot read"
        ;;
      unread)
        steps=$((steps + 1))
        fail "$CI:$line names setup-bun@ outside a uses: key this check reads (after a tag or an anchor, or in plain text), which this check cannot read"
        ;;
      twice) fail "$CI:$line oven-sh/setup-bun step sets bun-version twice" ;;
      nested) fail "$CI:$line bun-version is nested deeper than the inputs of the step's with:, so setup-bun does not read it" ;;
      stray) fail "$CI:$line bun-version is not in an oven-sh/setup-bun step" ;;
      escape) fail "$CI:$line holds an escape in a double-quoted string, which this check cannot read" ;;
      alias) fail "$CI:$line uses a YAML alias, which this check cannot read" ;;
      explicit) fail "$CI:$line uses a YAML explicit key (?), which this check cannot read" ;;
      tag) fail "$CI:$line uses a YAML tag other than !!map, which this check cannot read" ;;
      unclosed) fail "$CI:$line leaves a quoted string open onto the next line, which this check cannot read" ;;
      openflow) fail "$CI:$line leaves a flow mapping or sequence open onto the next line, which this check cannot read" ;;
    esac
  done < <(awk -v q="'" '
    BEGIN {
      OFS = "\t"
      body = -1
      # The input key, plain or quoted, after an optional anchor. The colon
      # must follow, so bun-version-file is another key.
      BV = "^[ \t]*(&[^ \t]+[ \t]+)?(bun-version|\"bun-version\"|" q "bun-version" q ")[ \t]*:"
      # A with: key, plain or quoted.
      WITH = "^[ \t]*[\"" q "]?with[\"" q "]?[ \t]*:"
    }
    function indent(s) { match(s, /^ */); return RLENGTH }
    function reset() { open = 0; inwith = 0; bv = 0; cont = 0; follow = 0 }
    # A step reports once it ends, so a line read later in its with: block
    # still counts: `pin` for its bun-version, `continued` for one whose
    # value runs onto the next line, and `nopin` for neither.
    function close_step() {
      if (open) {
        if (cont) print "continued", cont
        else if (bv) print "pin", bv, bvval
        else print "nopin", open
      }
      reset()
    }
    # The value of a YAML scalar: the text inside its quotes, or a plain
    # scalar up to a comment (a # after a blank). A quote that never closes,
    # or text after the closing quote, comes back as written, so it fails
    # the x.y.z pattern.
    function scalar(s,   c, i, rest) {
      sub(/^[ \t]+/, "", s)
      c = substr(s, 1, 1)
      if (c == "\"" || c == q) {
        i = index(substr(s, 2), c)
        if (!i) return s
        rest = substr(s, i + 2)
        if (rest !~ /^[ \t]*(#.*)?$/) return s
        return substr(s, 2, i - 1)
      }
      if (s ~ /^#/) return ""
      sub(/[ \t]+#.*$/, "", s)
      sub(/[ \t]+$/, "", s)
      return s
    }
    function value(s) {
      sub(/^[^:]*:/, "", s)
      return scalar(s)
    }
    # Read one line as YAML does, far enough to drop its comment and to see
    # the forms that spell a key or a value as other text than the line
    # shows: an escape in a double-quoted string ("bun\x2dversion"), an
    # alias (*name), an explicit key (? ) and a tag (!!binary). A quote, a *,
    # a ! or a ? is syntax only where a node starts: at the line start, after
    # `- `, `? ` or `: `, after a tag or an anchor, and in a flow collection
    # after [, { or ,. Anywhere else, as in run: echo "a\b" or a double quote
    # inside a single-quoted string, it is text. Sets code (the line without
    # its comment), escape, alias, explicit, tag (one other than !!map),
    # flowed for a flow collection on the line, unclosed for a quoted string
    # still open at the line end, and openflow for a flow collection.
    function scan(s,   n, i, j, c, nx, start, depth, inq) {
      escape = 0; alias = 0; explicit = 0; tag = 0; flowed = 0; unclosed = 0; openflow = 0
      n = length(s); start = 1; depth = 0; inq = ""
      for (i = 1; i <= n; i++) {
        c = substr(s, i, 1)
        nx = substr(s, i + 1, 1)
        if (inq != "") {
          if (inq == "\"" && c == "\\") { escape = 1; i++ }
          else if (c == inq && inq == q && nx == q) i++
          else if (c == inq) inq = ""
          continue
        }
        if (c == " " || c == "\t") continue
        if (c == "#" && (i == 1 || substr(s, i - 1, 1) ~ /[ \t]/)) {
          code = substr(s, 1, i - 1)
          sub(/[ \t]+$/, "", code)
          openflow = (depth > 0)
          return
        }
        if (start) {
          if (c == "\"" || c == q) { inq = c; start = 0; continue }
          if ((c == "-" || c == "?") && (nx == "" || nx ~ /[ \t]/)) {
            if (c == "?") explicit = 1
            continue
          }
          if (c == "[" || c == "{") { depth++; flowed = 1; continue }
          if (depth && (c == "]" || c == "}")) { depth--; start = 0; continue }
          if (c == "!" || c == "&" || c == "*") {
            j = i
            while (i < n && substr(s, i + 1, 1) !~ /[] \t,{}[]/) i++
            if (c == "!" && substr(s, j, i - j + 1) != "!!map") tag = 1
            if (c == "*") { alias = 1; start = 0 }
            continue
          }
          # A plain scalar starts here.
          start = 0
        }
        if (c == ":" && (nx == "" || nx ~ /[ \t]/ || (depth && nx ~ /[],{}[]/))) start = 1
        else if (depth && c == ",") start = 1
        else if (depth && (c == "]" || c == "}")) depth--
      }
      code = s
      unclosed = (inq != "")
      openflow = (!unclosed && depth > 0)
    }
    { sub(/\r$/, "") }
    /^[ \t]*(#|$)/ { next }
    {
      ind = indent($0)
      # The body of a block scalar (run: |) is text, not YAML keys: it runs
      # until a line indented no deeper than its key.
      if (body >= 0) {
        if (ind > body) next
        body = -1
      }
      # A line indented deeper than the bun-version input just read carries
      # on its value, as YAML folds a plain scalar: 1.4.4 then oops reads
      # `1.4.4 oops`, and a value on the next line reads that line.
      if (follow) {
        if (ind > bvind) cont = bv
        follow = 0
      }
      # A step ends at the next line indented no deeper than its `-`, and
      # its `with:` block at the next line indented no deeper than `with:`.
      if (open && ind <= step) close_step()
      if (inwith && ind <= withind) inwith = 0
      # A list item: remember its dash by the column its keys start at.
      if (match($0, /^ *- +/)) dash[RLENGTH] = ind
      # A key whose value is a block scalar (| or >) starts a body on the
      # next line. The key is matched from the start of the line, so a `: |`
      # inside a comment (hidden: # note: |) starts none.
      if ($0 ~ /^ *(- +)*[^ \t#:]+[ \t]*:[ \t]*[|>][-+0-9]*[ \t]*(#.*)?$/) {
        match($0, /^ *(- +)*/)
        body = RLENGTH
      }
      scan($0)
      low = tolower(code)
    }
    # oven-sh/setup-bun@<ref>, or a full URL to it.
    low ~ ("^[ \t-]*[\"" q "]?uses[\"" q "]?[ \t]*:[ \t]*[\"" q "]?([^ \t\"" q "]*/)?oven-sh/setup-bun@") {
      close_step()
      open = NR
      # `- uses:` opens the step; a bare `uses:` belongs to the item whose
      # keys start at its column. keyind is the column of the step keys,
      # where its with: must sit.
      if (match($0, /^ *- +/)) { step = ind; keyind = RLENGTH }
      else { step = (ind in dash) ? dash[ind] : ind - 2; keyind = ind }
      next
    }
    # Any other line that names setup-bun outside its comment: a step
    # written in flow style (- { uses: oven-sh/setup-bun@v2, ... }), a tag
    # before the action (uses: !!str oven-sh/setup-bun@v2), an anchor that
    # an alias reuses. A step this reader does not open is never read, so it
    # fails rather than pass unread.
    low ~ /setup-bun@/ {
      k = flowed ? "flowstep" : "unread"
      print k, NR
      next
    }
    # The with: of the step as a block mapping of inputs, which an anchor
    # (&inputs) or the mapping tag (!!map) may name first.
    open && ind == keyind && $0 ~ (WITH "[ \t]*((&[^ \t#]+|!!map)([ \t]+(&[^ \t#]+|!!map))*)?[ \t]*(#.*)?$") {
      inwith = 1; withind = ind; inputind = -1
      next
    }
    # Any other with: of the step ({ ... }, an alias, another tag, a block
    # scalar): reading those forms would take a YAML parser.
    open && ind == keyind && $0 ~ WITH { print "flow", NR; reset(); next }
    # The patterns here would miss a bun-version or a setup-bun step written
    # with a form scan() flags, so each prints its kind, wherever in the
    # file it is. So does a quoted string or a flow collection that runs
    # onto the next line, whose next line this reader would read as keys.
    escape { print "escape", NR; next }
    alias { print "alias", NR; next }
    explicit { print "explicit", NR; next }
    tag { print "tag", NR; next }
    unclosed { print "unclosed", NR; next }
    openflow { print "openflow", NR; next }
    # The inputs are the keys at the indentation of the first line under
    # with:. A bun-version nested deeper is no input.
    inwith {
      if (inputind < 0) inputind = ind
      if ($0 ~ BV && ind > inputind) { print "nested", NR; next }
      if ($0 ~ BV && ind == inputind) {
        if (bv) print "twice", NR
        else { bv = NR; bvval = value($0); bvind = ind; follow = 1 }
        next
      }
    }
    # A bun-version key on any other line, a flow mapping included.
    code ~ ("(^|[^A-Za-z0-9_.-])[\"" q "]?bun-version[\"" q "]?[ \t]*:") { print "stray", NR }
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

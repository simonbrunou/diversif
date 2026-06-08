#!/usr/bin/env bash
# Reproduce the diversif Claude Code setup on a fresh machine.
#
# What this script does:
#   1. Seeds .claude/settings.local.json from the committed example (if missing).
#   2. Installs the curated standalone agent skills listed in
#      .claude/skills.manifest.json into your user skills dir.
#
# What this script does NOT do (handled natively by Claude Code):
#   - Plugins + their bundled MCP servers auto-install from .claude/settings.json
#     (extraKnownMarketplaces + enabledPlugins) the first time you open this
#     project in Claude Code and trust it.
#
# Prereqs to run this script: git, jq. (Runtime prereqs for the tooling itself:
# bun, gh, python3 — used by the graphify hook — and the external `graphify`
# CLI. See docs/claude-setup.md.)
#
# Usage:
#   scripts/claude-setup.sh            # install missing skills, seed local settings
#   scripts/claude-setup.sh --force    # re-install/refresh every skill
#   scripts/claude-setup.sh --dry-run  # print actions without changing anything
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="$REPO_ROOT/.claude/skills.manifest.json"
FORCE=0
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    --dry-run) DRY_RUN=1 ;;
    # Print the header comment block (lines after the shebang, up to the first
    # non-comment line) as help — robust to line-number drift.
    -h|--help) awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "$0"; exit 0 ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

command -v git >/dev/null || { echo "error: git is required" >&2; exit 1; }
command -v jq  >/dev/null || { echo "error: jq is required"  >&2; exit 1; }
[ -f "$MANIFEST" ] || { echo "error: $MANIFEST not found" >&2; exit 1; }

# 1. Seed local settings from the committed example.
LOCAL="$REPO_ROOT/.claude/settings.local.json"
EXAMPLE="$REPO_ROOT/.claude/settings.local.json.example"
if [ ! -f "$LOCAL" ] && [ -f "$EXAMPLE" ]; then
  if [ "$DRY_RUN" = 1 ]; then
    echo "[dry-run] would create .claude/settings.local.json from example"
  else
    cp "$EXAMPLE" "$LOCAL" \
      || { echo "error: failed to seed $LOCAL from example — check permissions" >&2; exit 1; }
    echo "Created .claude/settings.local.json — edit it and set GITHUB_PERSONAL_ACCESS_TOKEN."
  fi
fi

# 2. Install standalone skills.
INSTALL_DIR="$(jq -r '.installDir // empty' "$MANIFEST")"
[ -n "$INSTALL_DIR" ] || { echo "error: .installDir missing in $MANIFEST" >&2; exit 1; }
INSTALL_DIR="${INSTALL_DIR/#\~/$HOME}"
if [ "$DRY_RUN" = 0 ]; then
  mkdir -p "$INSTALL_DIR" \
    || { echo "error: cannot create skills dir $INSTALL_DIR — check permissions on \$HOME" >&2; exit 1; }
fi

count="$(jq -r 'if (.skills | type) == "array" then (.skills | length) else -1 end' "$MANIFEST")"
[ "$count" -gt 0 ] 2>/dev/null \
  || { echo "error: .skills is empty or not an array in $MANIFEST" >&2; exit 1; }
echo "Installing $count standalone skills into $INSTALL_DIR ..."

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

# Check out one skill's folder inside $work. Every git step is checked
# explicitly: do NOT lean on `set -e` here — it is suppressed for any command
# whose status is tested (the `( ... ) ||` caller below), so an unchecked
# intermediate failure would be swallowed and could install corrupt contents.
# Runs in a subshell so the `cd` does not leak into the loop.
checkout_skill() {
  local work="$1" ref="$2" skillPath="$3"
  cd "$work" || return 1
  if [ -n "$ref" ]; then
    git fetch --depth 1 origin "$ref" >/dev/null 2>&1 \
      || { echo "    fetch of ref '$ref' failed" >&2; return 1; }
    git checkout FETCH_HEAD >/dev/null 2>&1 \
      || { echo "    checkout of ref '$ref' failed" >&2; return 1; }
  fi
  git sparse-checkout init --no-cone >/dev/null 2>&1 \
    || { echo "    sparse-checkout init failed (need git >= 2.25)" >&2; return 1; }
  git sparse-checkout set "$skillPath" >/dev/null 2>&1 \
    || { echo "    sparse-checkout set '$skillPath' failed" >&2; return 1; }
  git checkout >/dev/null 2>&1 \
    || { echo "    working-tree checkout failed" >&2; return 1; }
}

failed=0
failed_names=()
while IFS= read -r row; do
  name="$(jq -r '.name' <<<"$row")"
  repo="$(jq -r '.repo' <<<"$row")"
  ref="$(jq -r '.ref // ""' <<<"$row")"
  skillPath="$(jq -r '.skillPath' <<<"$row")"
  dest="$INSTALL_DIR/$name"

  if [ -e "$dest" ] && [ "$FORCE" = 0 ]; then
    echo "  = $name (exists, skip)"
    continue
  fi
  if [ "$DRY_RUN" = 1 ]; then
    echo "  + $name  <-  $repo/$skillPath"
    continue
  fi

  work="$tmp/$name"
  rm -rf "$work"
  if ! git clone --depth 1 --filter=blob:none --no-checkout \
        "https://github.com/$repo.git" "$work" >/dev/null 2>&1; then
    echo "  ! $name: clone failed ($repo)" >&2
    failed=1; failed_names+=("$name"); continue
  fi
  if ! ( checkout_skill "$work" "$ref" "$skillPath" ); then
    echo "  ! $name: checkout failed ($repo/$skillPath)" >&2
    failed=1; failed_names+=("$name"); continue
  fi
  if [ ! -d "$work/$skillPath" ]; then
    echo "  ! $name: '$skillPath' not found in $repo" >&2
    failed=1; failed_names+=("$name"); continue
  fi

  # Stage into a temp dir, then swap — so a failed copy never leaves $dest
  # deleted, and an existing skill survives until the new copy fully lands.
  staging="$dest.tmp.$$"
  rm -rf "$staging"
  if ! cp -R "$work/$skillPath" "$staging"; then
    echo "  ! $name: copy into $dest failed" >&2
    rm -rf "$staging"; failed=1; failed_names+=("$name"); continue
  fi
  rm -rf "$dest"
  mv "$staging" "$dest"
  echo "  + $name"
done < <(jq -c '.skills[]' "$MANIFEST")

echo
if [ "$failed" != 0 ]; then
  echo "Done — ${#failed_names[@]} skill(s) failed: ${failed_names[*]}"
  echo "Re-run with --force to retry, or check network / the repo paths in"
  echo ".claude/skills.manifest.json."
else
  echo "Done."
fi
echo "Next steps:"
echo "  1. Open this project in Claude Code and trust it — plugins + MCP servers"
echo "     auto-install from .claude/settings.json."
echo "  2. Edit .claude/settings.local.json — set GITHUB_PERSONAL_ACCESS_TOKEN."
echo "  3. Install the graphify CLI (provides the /graphify skill + 'graphify'"
echo "     command). See docs/claude-setup.md."
echo "  4. Ensure 'bun', 'gh', and 'jq' are on PATH."
exit "$failed"

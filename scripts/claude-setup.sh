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
# Prereqs: git, jq. (Runtime prereqs for the tooling itself: bun, gh, and the
# external `graphify` CLI — see docs/claude-setup.md.)
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
    -h|--help) sed -n '2,25p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
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
    cp "$EXAMPLE" "$LOCAL"
    echo "Created .claude/settings.local.json — edit it and set GITHUB_PERSONAL_ACCESS_TOKEN."
  fi
fi

# 2. Install standalone skills.
INSTALL_DIR="$(jq -r '.installDir' "$MANIFEST")"
INSTALL_DIR="${INSTALL_DIR/#\~/$HOME}"
[ "$DRY_RUN" = 1 ] || mkdir -p "$INSTALL_DIR"

count="$(jq '.skills | length' "$MANIFEST")"
echo "Installing $count standalone skills into $INSTALL_DIR ..."

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

failed=0
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
    echo "  ! $name: clone failed ($repo)" >&2; failed=1; continue
  fi
  (
    cd "$work"
    [ -n "$ref" ] && git fetch --depth 1 origin "$ref" >/dev/null 2>&1 && git checkout FETCH_HEAD >/dev/null 2>&1 || true
    git sparse-checkout init --no-cone >/dev/null 2>&1
    git sparse-checkout set "$skillPath" >/dev/null 2>&1
    git checkout >/dev/null 2>&1
  ) || { echo "  ! $name: sparse-checkout failed ($skillPath)" >&2; failed=1; continue; }

  if [ ! -d "$work/$skillPath" ]; then
    echo "  ! $name: '$skillPath' not found in $repo" >&2; failed=1; continue
  fi
  rm -rf "$dest"
  cp -R "$work/$skillPath" "$dest"
  echo "  + $name"
done < <(jq -c '.skills[]' "$MANIFEST")

echo
if [ "$failed" != 0 ]; then
  echo "Done — some skills failed (see ! lines above)."
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

#!/usr/bin/env bash
# Cloud environment SETUP SCRIPT entrypoint for Claude Code on the web.
#
# Point your cloud environment's "Setup Script" field (web UI) at this file:
#     scripts/cloud-setup.sh
# It runs ONCE before Claude Code launches, and the resulting filesystem is
# snapshotted/cached — so the pieces that aren't committed to the repo are
# present at launch:
#   - the curated standalone skills (via scripts/claude-setup.sh)
#   - the gh CLI (used by the code-review-on-push hook; not in the cloud image)
#
# Requires the environment's network access set to Trusted/Custom (to reach
# GitHub for skills + gh). Prereqs already in the cloud image: git, jq, python3.
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[cloud-setup] installing curated standalone skills..."
"$ROOT/scripts/claude-setup.sh" || echo "[cloud-setup] claude-setup.sh reported errors (continuing)"

if ! command -v gh >/dev/null 2>&1; then
  echo "[cloud-setup] installing gh CLI..."
  if command -v apt-get >/dev/null 2>&1; then
    { sudo apt-get update -y && sudo apt-get install -y gh; } >/dev/null 2>&1 \
      || apt-get install -y gh >/dev/null 2>&1 \
      || echo "[cloud-setup] could not apt-install gh — the push->/code-review hook will simply no-op without it"
  else
    echo "[cloud-setup] no apt-get found; install gh manually if you want the push->/code-review hook"
  fi
fi

# The external 'graphify' CLI has no public installer here; install it yourself
# if you want /graphify queries in the cloud. The committed graphify-out/ is
# readable regardless, so the graphify search-nudge hook keeps working.
echo "[cloud-setup] done. (Install the graphify CLI separately if you want /graphify.)"

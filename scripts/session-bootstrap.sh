#!/usr/bin/env bash
# SessionStart hook (startup|resume). Provisions per-session project state that a
# fresh clone needs but a local dev machine already has.
#
# Cloud-only: a local machine already has node_modules + deps, so this is a no-op
# there to avoid churn. Claude Code on the web sets CLAUDE_CODE_REMOTE.
# Runs AFTER Claude Code launches — fine for deps/tools, but NOT for skills/plugins
# (those must exist before launch; see scripts/cloud-setup.sh + docs/claude-setup.md).
set -u
[ -n "${CLAUDE_CODE_REMOTE:-}" ] || exit 0

ROOT="${CLAUDE_PROJECT_DIR:-.}"
cd "$ROOT" || exit 0

# Install app + tooling deps so the format-on-edit hook has a local prettier and
# the app can build/test. Non-fatal — a failure must never block the session.
# Note: bun package fetching can hit proxy issues in the cloud sandbox; if so,
# move deps into the environment Setup Script (see docs/claude-setup.md).
if command -v bun >/dev/null 2>&1 && [ -f package.json ]; then
  bun install --frozen-lockfile >/dev/null 2>&1 || bun install >/dev/null 2>&1 || true
fi
exit 0

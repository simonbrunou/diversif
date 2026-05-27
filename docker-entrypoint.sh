#!/bin/sh
set -eu

# Coolify injects COOLIFY_URL=http://<deploy>.diversif.app at runtime, but
# SvelteKit's adapter-node captures process.env.ORIGIN at module init time,
# before user hooks ever execute. Setting ORIGIN from inside the Node
# process (e.g. in hooks.server.ts) is too late — adapter-node has already
# cached the build-time value and CSRF rejects every cross-origin POST.
#
# Set ORIGIN here, before exec'ing Node, so the SvelteKit entry sees the
# per-deploy hostname on its first read. Cloudflare terminates TLS in
# front of the container, so rewrite the scheme to https.
#
# Prod is unaffected when COOLIFY_URL matches the canonical hostname.
# When COOLIFY_URL is unset (e.g. local docker compose), the existing
# ORIGIN env var is left intact.
if [ -n "${COOLIFY_URL:-}" ]; then
  ORIGIN=$(printf '%s' "$COOLIFY_URL" | sed 's,^http:,https:,')
  export ORIGIN
fi

# Resolve SENTRY_RELEASE before exec'ing node. Order:
#   1. SENTRY_RELEASE already in env (operator-set override)
#   2. /app/.release-sha — populated by the Dockerfile builder when .git/
#      is in the build context (local docker build, dev images)
#   3. SOURCE_COMMIT — Coolify exposes this for nixpacks-based builds
#   4. GITHUB_SHA / GIT_COMMIT_SHA — CI-style hosts
# Coolify's env panel single-quotes literal values, so $VAR / ${VAR} /
# $(cmd) entered there never expand — the expansion has to happen here
# in the entrypoint shim against env vars Coolify (or another orchestrator)
# injects as real values.
if [ -z "${SENTRY_RELEASE:-}" ]; then
  if [ -s /app/.release-sha ]; then
    SENTRY_RELEASE=$(cat /app/.release-sha)
  elif [ -n "${SOURCE_COMMIT:-}" ]; then
    SENTRY_RELEASE=$SOURCE_COMMIT
  elif [ -n "${GITHUB_SHA:-}" ]; then
    SENTRY_RELEASE=$GITHUB_SHA
  elif [ -n "${GIT_COMMIT_SHA:-}" ]; then
    SENTRY_RELEASE=$GIT_COMMIT_SHA
  fi
fi
if [ -n "${SENTRY_RELEASE:-}" ]; then
  export SENTRY_RELEASE
  # Mirror the same SHA into PUBLIC_SENTRY_RELEASE so $env/dynamic/public
  # surfaces it to the browser. Without this, hooks.client.ts initializes
  # Sentry with `release: undefined`, so client-side errors arrive at Sentry
  # untagged — even though @sentry/vite-plugin uploaded source maps under
  # the same SHA, Sentry has no way to associate them.
  export PUBLIC_SENTRY_RELEASE=$SENTRY_RELEASE
fi

exec node build

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

exec node build

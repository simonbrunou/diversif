# syntax=docker/dockerfile:1
FROM node:24-alpine AS builder
WORKDIR /app
# HUSKY=0 stops the `prepare` script from running `husky install` during
# `npm ci`. Husky's hook-install path is unnecessary inside the container —
# we don't commit from here.
ENV HUSKY=0
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci
COPY . .
# Best-effort SHA capture for sentry release tagging. When .git/ is in the
# build context (local `docker build .` from a checkout), install git and
# write the HEAD SHA into /app/.release-sha; the runtime stage copies it
# and docker-entrypoint.sh exports it as SENTRY_RELEASE before node boots.
#
# Coolify's archive-based deploys don't include .git/ in the build context,
# so the file is left empty and the entrypoint falls back to SOURCE_COMMIT
# / GITHUB_SHA / GIT_COMMIT_SHA from the runtime env. Either path is fine
# — what we want to avoid is failing the build when the SHA can't be
# resolved at this layer.
RUN if [ -d .git ]; then \
      apk add --no-cache git && git rev-parse HEAD > /app/.release-sha; \
    else \
      : > /app/.release-sha; \
    fi
RUN npm run build
RUN npm prune --omit=dev

FROM node:24-alpine
WORKDIR /app
RUN apk add --no-cache tini

COPY --from=builder --chown=node:node /app/build ./build
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
# Read by docker-entrypoint.sh, which exports its contents as
# SENTRY_RELEASE before exec'ing node — adapter-node + sentry-init.server.ts
# both see the SHA on first read.
COPY --from=builder --chown=node:node /app/.release-sha ./.release-sha
# Wrapper script copies COOLIFY_URL into ORIGIN before exec'ing node so
# adapter-node sees the per-deploy hostname (it caches process.env.ORIGIN
# at module init, so a JS-side override in hooks.server.ts runs too late).
COPY --chown=node:node docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
EXPOSE 3000

USER node

# /healthz returns {ok:true} only when the pg pool answers SELECT 1, so this
# doubles as a liveness + DB-reachability probe. start-period gives migrations
# room before the first probe counts.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz | grep -q '"ok":true' || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["/docker-entrypoint.sh"]


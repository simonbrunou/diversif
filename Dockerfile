# syntax=docker/dockerfile:1
FROM oven/bun:1.3.14-debian AS builder
WORKDIR /app
# HUSKY=0 stops the `prepare` script from running `husky install` during
# `bun install`. Husky's hook-install path is unnecessary inside the
# container — we don't commit from here.
ENV HUSKY=0
# If bun.lock ever gains a patchedDependencies entry again, add
# `COPY patches ./patches` back here before `bun install` — it fails with
# "Couldn't find patch file" without it (this broke the image build when the
# @inlang/sdk patch landed; the patch — and this COPY — were later removed
# once the paraglide-js v2 migration made it unnecessary).
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
    bun install --frozen-lockfile
COPY . .
# Sentry release SHA is resolved by vite.config.ts at build time (reads
# SENTRY_RELEASE / SOURCE_COMMIT / GITHUB_SHA / GIT_COMMIT_SHA / git HEAD
# in that order) and inlined into both server + client bundles via Vite's
# `define`. No runtime SHA file or entrypoint mirroring required.
RUN bun run build

# Separate, --production-only install: the runtime image must not ship the
# builder's devDependencies (vite, svelte-check, playwright, ...) — they're
# needed to build but not to run the built server.
FROM oven/bun:1.3.14-debian AS prod-deps
WORKDIR /app
COPY package.json bun.lock ./
# --ignore-scripts: this stage only needs node_modules for the runtime copy,
# not a build — running the root `prepare` script (husky) here fails anyway
# because --production excludes husky itself (a devDependency).
RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
    bun install --frozen-lockfile --production --ignore-scripts

FROM oven/bun:1.3.14-debian
WORKDIR /app

# Run as a dedicated non-root user. Without this the server (and the
# /app/data SQLite volume it creates) runs as root inside the container.
RUN groupadd --gid 1001 diversif \
    && useradd --uid 1001 --gid diversif --system --no-create-home diversif \
    && mkdir -p /app/data \
    && chown -R diversif:diversif /app

COPY --from=builder --chown=diversif:diversif /app/build ./build
COPY --from=prod-deps --chown=diversif:diversif /app/node_modules ./node_modules
COPY --from=builder --chown=diversif:diversif /app/package.json ./package.json
# drizzle/ holds the SQL migrations that the server applies on boot
# (src/lib/server/db/index.ts → migrate()). They must travel with the
# runtime image, not just CI.
COPY --from=builder --chown=diversif:diversif /app/drizzle ./drizzle

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
# Trust Cloudflare/Traefik's forwarded headers so the SvelteKit handler
# derives the request origin per-request instead of from a build-baked
# ORIGIN env var. Lets CSRF accept POSTs from every preview hostname
# (`*.diversif.app`) without per-deploy configuration. Only set these when
# sitting behind a trusted reverse proxy — clients could otherwise spoof
# them.
ENV PROTOCOL_HEADER=x-forwarded-proto
ENV HOST_HEADER=x-forwarded-host
# ADDRESS_HEADER is deliberately NOT baked into the image:
#  - adapter-node THROWS on every request that lacks the configured header,
#    so a baked x-forwarded-for default turns "no proxy in front" into a
#    total auth outage;
#  - x-forwarded-for is client-suppliable when no trusted proxy strips it,
#    letting an attacker mint fresh rate-limit buckets per request.
# The operator must set ADDRESS_HEADER (and XFF_DEPTH when applicable) for
# their topology — see DEPLOY.md / .env.example. The server logs a boot
# warning (src/hooks.server.ts) when PROTOCOL_HEADER is set without it.
ENV WEBAUTHN_RP_ID=diversif.app
# SQLite file location. Mount a persistent volume here (Coolify / docker-compose
# both map /app/data) so the database survives redeploys and image rebuilds.
ENV DATABASE_PATH=/app/data/diversif.db
VOLUME /app/data
EXPOSE 3000

# /healthz returns {ok:true} only when bun:sqlite answers SELECT 1, so this
# doubles as a liveness + DB-reachability probe. start-period gives
# migrations room before the first probe counts.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz | grep -q '"ok":true' || exit 1

USER diversif

CMD ["bun", "build/index.js"]

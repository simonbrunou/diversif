# syntax=docker/dockerfile:1
FROM oven/bun:1.3-debian AS builder
WORKDIR /app
# HUSKY=0 stops the `prepare` script from running `husky install` during
# `bun install`. Husky's hook-install path is unnecessary inside the
# container — we don't commit from here.
ENV HUSKY=0
# patches/ must be present before `bun install`: bun.lock references the
# patchedDependencies entries and install fails with "Couldn't find patch
# file" without them (broke the image build when the @inlang/sdk patch
# landed — there is no docker gate in CI to catch it).
COPY package.json bun.lock ./
COPY patches ./patches
RUN --mount=type=cache,target=/root/.bun/install/cache,sharing=locked \
    bun install --frozen-lockfile
COPY . .
# Sentry release SHA is resolved by vite.config.ts at build time (reads
# SENTRY_RELEASE / SOURCE_COMMIT / GITHUB_SHA / GIT_COMMIT_SHA / git HEAD
# in that order) and inlined into both server + client bundles via Vite's
# `define`. No runtime SHA file or entrypoint mirroring required.
RUN bun run build

FROM oven/bun:1.3-debian
WORKDIR /app

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
# drizzle/ holds the SQL migrations that the server applies on boot
# (src/lib/server/db/index.ts → migrate()). They must travel with the
# runtime image, not just CI.
COPY --from=builder /app/drizzle ./drizzle

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
# Without ADDRESS_HEADER, getClientAddress() returns the proxy's socket IP and
# every per-IP rate-limit bucket collapses onto one key — a single abuser then
# locks out every legitimate user. Bake the standard proxy default into the
# image so a forgotten env var fails safe; behind Cloudflare prefer overriding
# with ADDRESS_HEADER=cf-connecting-ip (see DEPLOY.md / .env.example).
# XFF_DEPTH=1 reads the rightmost x-forwarded-for entry — the one appended by
# the trusted proxy in front of the app, the only one a client can't forge.
ENV ADDRESS_HEADER=x-forwarded-for
ENV XFF_DEPTH=1
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

CMD ["bun", "build/index.js"]

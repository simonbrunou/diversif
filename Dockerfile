# syntax=docker/dockerfile:1
FROM node:22-alpine AS builder
WORKDIR /app
# HUSKY=0 stops the `prepare` script from trying to install git hooks during
# `npm ci` — the build context has no .git so husky would otherwise error.
ENV HUSKY=0
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci
COPY . .
RUN npm run build
RUN npm prune --omit=dev

FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache tini

COPY --from=builder --chown=node:node /app/build ./build
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/drizzle ./drizzle

RUN mkdir -p /app/data && chown -R node:node /app/data

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/app/data/diversif.db
EXPOSE 3000
VOLUME /app/data

USER node

# /healthz returns {ok:true} only when the SQLite handle answers SELECT 1,
# so this doubles as a liveness + DB-reachability probe. start-period gives
# migrations + first-boot seeding room before the first probe counts.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/healthz | grep -q '"ok":true' || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "build"]

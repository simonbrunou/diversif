# Multi-stage Elixir release build for the diversif Phoenix app.
#
# - Builder stage uses the hex.pm Elixir image (Elixir + OTP + build tools).
# - Runner stage is a slim Debian image with just the OpenSSL / libstdc++
#   runtimes the BEAM needs.
# - `bin/migrate` runs `Ecto.Migrator.run` for every configured repo, then
#   the release starts and listens on $PORT (default 4000).
#
# Build:  docker build -f phoenix/Dockerfile -t diversif:latest phoenix/
# Run:    docker run -e DATABASE_URL=... -e SECRET_KEY_BASE=... ... -p 4000:4000 diversif:latest

ARG ELIXIR_VERSION=1.19.5
ARG OTP_VERSION=28.4.2
ARG DEBIAN_VERSION=bookworm-20260518-slim

ARG BUILDER_IMAGE="hexpm/elixir:${ELIXIR_VERSION}-erlang-${OTP_VERSION}-debian-${DEBIAN_VERSION}"
ARG RUNNER_IMAGE="debian:${DEBIAN_VERSION}"

# -----------------------------------------------------------------------------
FROM ${BUILDER_IMAGE} AS builder

# Build deps. `git` is needed for any deps that point at git repos (none today,
# but cheap insurance for future hex_pkg overrides).
RUN apt-get update -y \
 && apt-get install -y --no-install-recommends build-essential git \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN mix local.hex --force && mix local.rebar --force

ENV MIX_ENV="prod"

# Resolve hex deps before copying app source, so dep changes alone trigger
# a layer rebuild but a Lib edit doesn't redownload the world.
COPY mix.exs mix.lock ./
RUN mix deps.get --only $MIX_ENV
RUN mkdir config

COPY config/config.exs config/${MIX_ENV}.exs config/
RUN mix deps.compile

COPY priv priv
COPY lib lib
COPY assets assets

# `mix compile` MUST run before `mix assets.deploy`: the `:phoenix_live_view`
# compiler emits colocated JS hooks under
# `_build/prod/lib/phoenix-colocated/diversif/`, and `app.js` imports that
# path. Running esbuild first would fail to resolve the import.
RUN mix compile
RUN mix assets.deploy

# runtime.exs is evaluated at release boot — copy it last so dev-only edits
# don't invalidate the compile cache.
COPY config/runtime.exs config/
COPY rel rel
RUN mix release

# -----------------------------------------------------------------------------
FROM ${RUNNER_IMAGE} AS runner

RUN apt-get update -y \
 && apt-get install -y --no-install-recommends libstdc++6 openssl libncurses6 locales ca-certificates curl \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

# UTF-8 locale — French copy / regex assumptions depend on this.
RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen
ENV LANG=en_US.UTF-8 \
    LANGUAGE=en_US:en \
    LC_ALL=en_US.UTF-8

WORKDIR /app
RUN chown nobody /app

ENV MIX_ENV="prod"
ENV PHX_SERVER="true"

COPY --from=builder --chown=nobody:root /app/_build/${MIX_ENV}/rel/diversif ./

# Custom entrypoint runs ecto migrations before exec'ing the release server.
COPY --chown=nobody:root docker-entrypoint.sh /app/docker-entrypoint.sh

# Belt-and-braces: ensure the entrypoint AND release scripts are executable.
# `mix phx.gen.release` generates rel/overlays/bin/{migrate,server} without
# setting the executable bit, and git's filemode tracking is host-dependent.
# A defensive chmod here means the image works regardless of what got
# committed.
RUN chmod +x /app/docker-entrypoint.sh /app/bin/server /app/bin/migrate /app/bin/diversif

USER nobody

EXPOSE 4000

# Healthcheck so `docker ps` and Coolify's own probe agree on health
# without each having to be configured separately. start-period gives the
# release time to migrate + bind the socket before failures count.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT:-4000}/health" || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["/app/bin/server"]

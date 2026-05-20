#!/bin/sh
# Boot wrapper: runs Ecto migrations before exec'ing the release server.
# `bin/migrate` is provided by mix phx.gen.release (runs Diversif.Release.migrate/0).
# Running migrate inside the same container is fine here because there's
# exactly one app node — the migration table itself serialises concurrent
# bootups if/when we scale to paired stacks under Traefik.
set -eu

echo "[entrypoint] running ecto migrations…"
/app/bin/migrate

echo "[entrypoint] starting server on port ${PORT:-4000}"
exec "$@"

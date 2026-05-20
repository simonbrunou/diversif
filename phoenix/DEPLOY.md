# Deploying the Phoenix rewrite

Build context is the `phoenix/` directory (NOT the repo root — that builds the
SvelteKit app via a different Dockerfile). In Coolify, point the application
at this directory and select "Dockerfile" as the build pack with
`phoenix/Dockerfile` as the file.

## Required environment variables

The release **will refuse to boot** without these (it raises in
`config/runtime.exs`):

| Variable | How to set | What it does |
|---|---|---|
| `DATABASE_URL` | `ecto://USER:PASS@HOST:5432/DBNAME` | Postgres connection. Coolify Postgres add-on injects this. |
| `SECRET_KEY_BASE` | `mix phx.gen.secret` (64 chars) | Signs/encrypts the Plug.Session cookie (holds `:user_token`). Rotate ⇒ everyone logs out. |
| `LIVE_VIEW_SIGNING_SALT` | `mix phx.gen.secret 32` | Signs LiveView socket tokens. Hardcoding it once meant any reader of the repo could sign LV tokens — that's why it's env-sourced now. |
| `PHX_HOST` | `diversif.example.com` | Canonical public hostname (no scheme, no slash). Drives URL generation for sitemap, email, etc. |
| `PHX_SERVER` | `true` | Tells the endpoint to actually bind a socket. The Dockerfile sets this by default; included here so a Coolify run without the Dockerfile (`mix release` artifact only) still works. |

## Optional but you almost certainly want them

| Variable | Default | What it does |
|---|---|---|
| `ORIGIN` | `http://localhost:4000` | WebAuthn relying-party id derives from this. Set to `https://diversif.example.com`. RP-ID stays bound to the eTLD+1, so previews on `*.diversif.example.com` work without re-registering passkeys. |
| `TRUSTED_PROXIES` | empty (no trust) | Comma-separated CIDRs that may set `cf-connecting-ip` / `x-forwarded-for`. **Without this, the rate limiter and audit log key on the load-balancer IP instead of the real client.** Cloudflare's IPv4 ranges: see https://www.cloudflare.com/ips-v4/. Boot refuses to start if every entry is malformed (loud failure on typos). |
| `PORT` | `4000` | What the BEAM binds. Coolify usually proxies. |
| `POOL_SIZE` | `10` | Postgres pool. Raise under high concurrency. |
| `ECTO_IPV6` | unset | Set to `true` or `1` if your DB endpoint is IPv6-only. |

## Migrations

`docker-entrypoint.sh` runs `bin/migrate` (which calls
`Diversif.Release.migrate/0` → `Ecto.Migrator.run`) before exec'ing the server.

- First boot creates all 12 tables, indexes, CHECK constraints, and the
  `audit_events` table.
- Re-deploys are no-ops when no new migration files have shipped.
- **First boot does NOT seed the foods catalog.** Run `bin/diversif eval
  'Code.eval_file("priv/repo/seeds.exs")'` once after first deploy, or shell
  into the container and `mix run priv/repo/seeds.exs` if mix is available.
  The seed is idempotent — re-runs no-op.

## Healthcheck

`GET /healthz` returns `{"ok":true}` (200) iff the Repo can complete
`SELECT 1`. Point Coolify's container healthcheck at it.

## Cutover from the SvelteKit deploy

- The Phoenix schema is structurally compatible with the existing SvelteKit
  Drizzle schema (same tables, columns, constraints). For a **data-preserving
  cutover** you'll want to seed Ecto's `schema_migrations` table with the
  versions matching the already-applied Drizzle migrations BEFORE booting,
  so `bin/migrate` doesn't try to re-create tables that exist.
- For a **clean rebuild** (no data preservation) just point at an empty DB
  and let `bin/migrate` create everything.

## Sanity-check the build locally

```bash
cd phoenix
docker build -t diversif:test .
docker run --rm \
  -e DATABASE_URL=ecto://postgres:postgres@host.docker.internal:5434/diversif_dev \
  -e SECRET_KEY_BASE="$(openssl rand -base64 48)" \
  -e LIVE_VIEW_SIGNING_SALT="$(openssl rand -base64 32 | head -c 32)" \
  -e PHX_HOST=localhost \
  -p 4000:4000 \
  diversif:test
```

(Adjust `host.docker.internal` if you're on Linux without Docker Desktop —
or use `--network=host` and point at `127.0.0.1:5434`.)

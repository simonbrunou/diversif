# Komodo zero-downtime deploy — handoff brief

**Audience:** a Claude Code session helping the user operationalize the Komodo deploy. You did not design this; the design and the in-repo artifacts are already done. Your job is to wire it up in Komodo and verify it works.

---

## Goal

Zero-downtime rolling deploy for diversif on a self-hosted Komodo host. Currently a single container is recreated on every release (~5s gap). After this work, traffic should flip between two long-lived slots with no perceived downtime.

## Constraint to keep in mind

The app uses **SQLite via better-sqlite3** with WAL mode. Two writers cannot hold the file lock simultaneously, so the two slots cannot both write at the same instant — they serialize via `busy_timeout=5000` (already configured in `src/lib/server/db/index.ts`). During the brief overlap when both slots are healthy, writes wait up to 5s for the lock; reads are unaffected (WAL allows multiple readers). This is fine in practice but means **migrations must be expand-and-contract** — never ship a destructive schema change in a single deploy, because the old slot will run against the new schema for a few seconds.

## Architecture

```
                 diversif.app (DNS A → host)
                          │
                          ▼
                   ┌──────────────┐
                   │   Traefik    │   reads container labels via Docker socket
                   │   :80/:443   │   load-balances across healthy upstreams
                   └──────┬───────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
     ┌─────────────────┐    ┌─────────────────┐
     │ diversif-a      │    │ diversif-b      │   both run continuously
     │  :3000          │    │  :3000          │   redeployed sequentially
     └────────┬────────┘    └────────┬────────┘   by the Komodo Procedure
              │                      │
              └─────────┬────────────┘
                        ▼
            volume: diversif-data (external)
            (shared SQLite WAL file)
```

Both `diversif-a` and `diversif-b` register identical Traefik labels under the same router (`diversif`). Traefik discovers them by their Docker labels and removes/adds upstreams as health flips.

## Why two stages, not one

Komodo's deploy primitives:

- **Stacks** = `docker compose up` units. Redeploying a stack does `compose down → up` ≈ 5s gap.
- **Procedures** = sequential **stages**, each containing executions that run in parallel.

Putting `DeployStack diversif-a` and `DeployStack diversif-b` in the same stage = parallel = both slots down at the same moment = downtime. Putting them in **separate stages** = sequential = while A is recreating, B serves; while B is recreating, A (now on new image) serves. That's the entire trick.

## Files in the repo (already committed on `main`)

```
compose/traefik.yaml              one-time host stack — Traefik v3 + Let's Encrypt
compose/diversif-a.yaml           slot A — long-lived stack
compose/diversif-b.yaml           slot B — long-lived stack (identical service def)
compose/komodo-procedure.toml     the rolling-deploy Procedure (two stages)
src/routes/healthz/+server.ts     /healthz endpoint Traefik gates upstreams on
docker-compose.yml                root file — kept for simple single-container mode
```

Both `diversif-a.yaml` and `diversif-b.yaml` declare the data volume and Traefik network as `external: true` so they share state without one stack having to "own" creation.

## Komodo setup checklist

You will work through these in order. Do not skip the volume/network creation — the stacks expect them to exist.

### 1. One-time host preparation

On the Komodo host (via Komodo's terminal, an Action's `execute_server_terminal`, or SSH):

```bash
docker network create traefik-web
docker volume create diversif-data
```

### 2. Deploy the Traefik stack

Register a Komodo Stack pointing to `compose/traefik.yaml`. Provide the env var:

```
ACME_EMAIL=you@example.com
```

Deploy. Verify Traefik is listening on 80/443 and the dashboard (if enabled) is reachable.

### 3. Register the two diversif stacks

Two Komodo Stacks, both pointing at the same git repo + branch but different file paths:

| Stack name   | Compose file              |
| ------------ | ------------------------- |
| `diversif-a` | `compose/diversif-a.yaml` |
| `diversif-b` | `compose/diversif-b.yaml` |

For both, set `auto_update = false`. If left enabled, both stacks would redeploy in parallel on a new image digest, defeating the rolling pattern.

Both stacks need the same env vars:

```
DOMAIN=diversif.app
ORIGIN=https://diversif.app
IMAGE=ghcr.io/simonbrunou/diversif:latest
```

**Why `:latest`** — the GitHub Actions `publish` job pushes both `:latest` (mutable, what the stacks pull) and `:${{ github.sha }}` (immutable, for traceability and rollback). Procedure executions pull-and-recreate, so `:latest` always lands the freshly built image. The `:sha` tag stays in GHCR forever — to roll back, override `IMAGE` on both stacks to a known-good `:sha` and run the Procedure manually.

Plus a `.env` alongside each compose file for app secrets (`SESSION_SECRET`, `SENTRY_DSN`, etc. — get these from the existing single-stack deploy if migrating).

Deploy both stacks once. Both should become healthy. Traefik should route to both.

### 4. Register the Procedure

Sync `compose/komodo-procedure.toml` into Komodo's resource sync, or recreate the equivalent in the UI:

- Stage 1: `DeployStack` with `stack = "diversif-a"`
- Stage 2: `DeployStack` with `stack = "diversif-b"`

### 5. Wire the Procedure trigger

This is already done in CI. `.github/workflows/ci.yml` has a `publish` job that runs after the three test jobs pass on `main`. It builds the image, pushes `ghcr.io/simonbrunou/diversif:${sha}` and `:latest`, then POSTs to Komodo's `/execute` to fire `RunProcedure { procedure: "diversif-rolling-deploy" }`.

You need to set three GitHub Actions secrets on the repo before the next push to `main`:

| Secret              | Value                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `KOMODO_ADDRESS`    | The base URL of your Komodo Core, e.g. `https://komodo.example.com` (no trailing slash needed; the workflow strips). |
| `KOMODO_API_KEY`    | Generate in Komodo: User → Settings → API Keys.                                                                      |
| `KOMODO_API_SECRET` | Paired secret from the same key generation.                                                                          |

The API key needs permission to **Execute** the `diversif-rolling-deploy` Procedure (and read the linked Stacks). Scope it as narrowly as Komodo allows.

Verify by pushing a no-op commit to `main` and watching:

1. The three test jobs pass.
2. The `publish` job builds and pushes the image (visible in GHCR).
3. Komodo's UI shows the Procedure firing, stage 1 (`DeployStack diversif-a`) completing, then stage 2 (`DeployStack diversif-b`) completing.
4. The verify-with-curl loop below stays green throughout.

## How to verify it works

1. From a separate machine, run `while true; do curl -fsS https://diversif.app/healthz && echo $(date); sleep 0.2; done` during a deploy.
2. You should see continuous 200s — no failures, no 503s, no DNS-resolution gaps.
3. Inside the Komodo UI, the Procedure should show stage 1 complete, then stage 2 complete, with healthy state on both slots at the end.

If you see a 5s gap of failures: check that both stacks are running BEFORE the Procedure starts. If only one slot is up at the moment the Procedure begins, recreating the only slot = downtime by definition.

## Failure modes

- **Both stacks crash-looping with the same broken image.** Rollback by overriding `IMAGE` in both stacks to the previous SHA and redeploying. There's no automatic rollback — Komodo doesn't track previous-known-good.
- **Migration breaks the old slot.** This is the expand-and-contract violation. If a deploy adds a NOT NULL column without default, the still-running old slot's INSERTs (without the new column) will fail during the overlap window. Convention: mark new columns nullable in deploy N, fill in code-side, then mark NOT NULL in deploy N+1.
- **Traefik certificate expiry.** Let's Encrypt renews automatically via the ACME resolver. If the certs volume gets nuked, certs will be reissued — but you'll burn rate-limit budget. Don't delete `traefik_certs` volume casually.
- **Both slots holding the SQLite write lock.** Should not happen — `busy_timeout=5000` serializes them. If you see app-level errors about "database is locked", check that nobody is running long-lived transactions across the deploy window.

## What is NOT in scope

- Postgres migration (architectural alternative discussed but not chosen).
- Litestream / LiteFS replication (DR-grade HA — overkill at current traffic).
- CI image-build setup (assumed separate; the Procedure only triggers from a successful build).
- Database backup strategy (covered separately under LXC vzdump → R2; see project memory).

## Open questions for the user

You may need to ask the user:

- Which Komodo Build resource (or external CI) produces the diversif image? You need the build identity to wire the webhook.
- Is Traefik already running on the host, or is this a fresh setup? If existing, skip step 2 and just verify the network and ACME resolver match.
- Do they want a maintenance/error page when both slots fail? Out of scope for the rolling deploy itself, but Traefik can serve one via a fallback router.

---

**End of brief.** Everything you need to operationalize is above. The repo files are committed; your work is on the Komodo side.

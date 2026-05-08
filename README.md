# Diversif

[![Sponsor](https://img.shields.io/badge/sponsor-%E2%9D%A4-ec4899?logo=github)](https://github.com/sponsors/simonbrunou)

Web app to track a baby's food diversification, with parent sharing. Self-hosted, single Docker container, French UI.

## Stack

- SvelteKit (Svelte 5 + TypeScript)
- SQLite via `better-sqlite3` + Drizzle ORM
- Tailwind CSS, in-house auth (Argon2id sessions, WebAuthn passkeys)
- i18n via `@inlang/paraglide-sveltekit` (FR default, `/en/` for English)
- PWA via `@vite-pwa/sveltekit` with an in-page offline log queue
- Observability via `@sentry/sveltekit` (strict PII scrubbing)
- Node adapter, deployed in a single Alpine Docker image

## Development

```bash
npm install
npm run db:generate   # only when schema.ts changes
npm run dev
```

The app creates `./data/diversif.db` on first run, runs migrations, and seeds the food catalog automatically.

## Tests / checks

```bash
npm run check
npm run lint
npm run test
npm run build
```

## Production with Docker

```bash
cp .env.example .env  # edit ORIGIN if needed
docker compose build
docker compose up -d
```

The SQLite DB is persisted in the named Docker volume `diversif-data` (pinned via `name:` so it is independent of the Compose project name), mounted at `/app/data` inside the container. The volume survives rebuilds, container recreations, repo re-clones, and renames of the project directory, so accounts and data are kept across deploys. Migrations and seeding run on every container start (idempotent).

### Volume ownership (non-root container)

The container runs as the `node` user (UID 1000). The build-time `chown` on `/app/data` only fixes the **empty** image layer — it cannot change ownership of an already-populated named volume. Two cases to handle:

**Fresh deploy on an unprivileged Proxmox LXC:** container UID 1000 maps to host UID 101000. The first deploy will create the volume owned by host root, and migrations will fail with `EACCES`. Fix once on the LXC host before `docker compose up`:

```bash
docker volume create diversif-data  # if not yet created
chown -R 101000:101000 /var/lib/docker/volumes/diversif-data/_data
```

(Replace `101000` with the actual mapped UID if your LXC uses a different `subuid` range.)

**Upgrading from an older deploy that ran as root:** the existing DB and WAL files are owned by root inside the volume, so the new non-root container can open the DB read-only and then crash on the first write. Stop the container, chown on the host, then start:

```bash
docker compose down
# Privileged LXC or non-LXC host: container UID 1000 == host UID 1000
chown -R 1000:1000 /var/lib/docker/volumes/diversif-data/_data
# Unprivileged LXC: map to subuid range
chown -R 101000:101000 /var/lib/docker/volumes/diversif-data/_data
docker compose up -d
```

You can verify in-container with `docker exec diversif id` (should show `uid=1000(node)`) and `docker exec diversif ls -lan /app/data` (`diversif.db` should be owned by UID 1000).

### Reverse proxy / Cloudflare Tunnel

When the app sits behind a proxy (Coolify/Traefik, a Cloudflare Tunnel, nginx, etc.), `adapter-node` needs a few env vars to recover the real client IP and scheme. Without them the per-IP rate limits on `/signup` and `/login` see the proxy as a single client, so one bad actor can lock everyone out.

For a Cloudflare Tunnel terminating at Coolify (the reference deploy):

```
ADDRESS_HEADER=cf-connecting-ip
PROTOCOL_HEADER=x-forwarded-proto
HOST_HEADER=x-forwarded-host
```

`cf-connecting-ip` is safe to trust **only because** a Tunnel origin has no public port — all traffic must transit Cloudflare, so a direct connection can't spoof the header. If you ever expose the Coolify host directly to the Internet, switch to `ADDRESS_HEADER=x-forwarded-for` and set `XFF_DEPTH` to the number of trusted proxies between you and the client (otherwise a client-supplied XFF entry wins).

### Pre-migration safety net

On every container start, **before** migrations run, the app takes an online snapshot (`VACUUM INTO`) of the current DB into `/app/data/backups/diversif-<ISO timestamp>.db`. The last `DB_BACKUP_KEEP` snapshots (default 10) are retained — older ones are pruned. If a future migration eats data, recover by stopping the container and copying the most recent snapshot back over `diversif.db`:

```bash
docker compose stop
docker run --rm -v diversif-data:/data alpine sh -c \
  'cp "$(ls -1t /data/backups/*.db | head -n1)" /data/diversif.db && \
   rm -f /data/diversif.db-shm /data/diversif.db-wal'
docker compose start
```

To inspect, back up, or restore the database:

```bash
# Locate the volume on the host
docker volume inspect diversif-data

# Hot backup using a one-shot alpine container with sqlite3 installed
docker run --rm \
  -v diversif-data:/data \
  -v "$PWD":/backup \
  alpine sh -c 'apk add --no-cache sqlite >/dev/null && \
    sqlite3 /data/diversif.db ".backup /backup/diversif-backup.db"'

# Restore (stop the app first to avoid clobbering an open DB)
docker compose stop
docker run --rm -v diversif-data:/data -v "$PWD":/backup alpine \
  cp /backup/diversif-backup.db /data/diversif.db
docker compose start
```

> Only run `docker compose down -v` if you intend to wipe the database — the `-v` flag deletes named volumes.

## Routes overview

- `/login`, `/signup`, `/logout`, `/join/[code]`
- `/child/new`, `/child/[id]` (dashboard)
- `/child/[id]/log` — log a food
- `/child/[id]/foods` — full history with filters
- `/child/[id]/allergens` — allergen exposure status
- `/child/[id]/suggestions` — what to introduce next
- `/child/[id]/settings` — child info, members, invitations, danger zone
- `/account` — profile, password, logout everywhere

## Vie privée & RGPD

Diversif est conçu pour être conforme au RGPD lorsqu'il est exposé en tant qu'instance publique (l'éditeur agit alors comme responsable de traitement). Aucune donnée n'est partagée avec un tiers ; la base SQLite reste sur l'hôte.

- **Pages légales** : `/mentions-legales`, `/politique-confidentialite`, `/cgu`, `/cookies`. Elles affichent « à compléter » tant que les variables d'environnement décrites ci-dessous ne sont pas renseignées.
- **Consentement** : à l'inscription, l'utilisateur doit confirmer avoir au moins 15 ans (article 45 LIL), accepter les CGU et la politique de confidentialité. Les horodatages sont stockés dans la table `users`.
- **Droits** : depuis « Mon compte », l'utilisateur peut télécharger ses données au format JSON (`/account/export`, limité à un export par minute) et supprimer son compte (typage de son email pour confirmer). La suppression est immédiate et transactionnelle ; les enfants partagés restent accessibles aux co-parents (le co-parent inscrit le plus tôt est promu si nécessaire).
- **Cookies** : seulement deux cookies strictement nécessaires (`session`, `wa_challenge`). Aucune mesure d'audience.
- **En-têtes de sécurité** : CSP, HSTS (en production), X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Cross-Origin-Opener-Policy sont posés dans `src/hooks.server.ts`.

### Variables d'environnement légales

Ajoutez ces variables au fichier `.env` (voir `.env.example`) avant la mise en production :

```
LEGAL_CONTROLLER_NAME=
LEGAL_CONTROLLER_EMAIL=
LEGAL_CONTROLLER_ADDRESS=
LEGAL_PUBLICATION_DIRECTOR=
LEGAL_HOST_PROVIDER=
LEGAL_HOST_PROVIDER_ADDRESS=
RETENTION_INACTIVE_DAYS=1095
```

### Rétention & nettoyage

Une tâche déclenchée au démarrage du process (puis toutes les 6 heures) supprime les sessions, invitations et défis WebAuthn expirés (`src/lib/server/cleanup.ts`). Pour un déclenchement manuel :

```bash
node scripts/cleanup.mjs
```

`scripts/list-stale-users.mjs` liste (sans supprimer) les comptes inactifs depuis plus de `RETENTION_INACTIVE_DAYS` jours. L'inactivité est mesurée sur le maximum de `users.last_login_at` (mis à jour à la connexion **et** lors du renouvellement automatique de la session), de la dernière session encore en base (moins 30 jours) et de `users.created_at`. Aucune suppression automatique des comptes inactifs n'est effectuée en v1.

### Export / suppression manuels d'un compte

Pour répondre manuellement à une demande RGPD article 15 / 20 (par exemple si l'utilisateur ne peut pas se connecter) :

```bash
node scripts/export-user.mjs user@example.com
```

## Out of scope (for the MVP)

BLW textures, photos, quantities, recipes, growth charts, push notifications, CSV/PDF export, i18n, offline queue, read-only sharing.

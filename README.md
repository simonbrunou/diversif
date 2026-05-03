# Diversif

Web app to track a baby's food diversification, with parent sharing. Self-hosted, single Docker container, French UI.

## Stack

- SvelteKit (Svelte 5 + TypeScript)
- SQLite via `better-sqlite3` + Drizzle ORM
- Tailwind CSS, in-house auth (Argon2id sessions)
- PWA via `@vite-pwa/sveltekit`
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

The SQLite DB is persisted in the named Docker volume `diversif-data`, mounted at `/app/data` inside the container. The volume survives rebuilds, container recreations, and repo re-clones, so accounts and data are kept across deploys. Migrations and seeding run on every container start (idempotent).

To inspect, back up, or restore the database:

```bash
# Locate the volume on the host
docker volume inspect diversif_diversif-data

# Back up to a local file
docker compose exec diversif sh -c 'sqlite3 /app/data/diversif.db ".backup /app/data/backup.db"'
docker cp diversif:/app/data/backup.db ./diversif-backup.db

# Restore (container must be stopped)
docker compose down
docker run --rm -v diversif_diversif-data:/data -v "$PWD":/backup alpine \
  sh -c 'cp /backup/diversif-backup.db /data/diversif.db'
docker compose up -d
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

## Out of scope (for the MVP)

BLW textures, photos, quantities, recipes, growth charts, push notifications, CSV/PDF export, i18n, offline queue, read-only sharing.

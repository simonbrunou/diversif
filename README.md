# Diversif

[![Sponsor](https://img.shields.io/badge/sponsor-%E2%9D%A4-ec4899?logo=github)](https://github.com/sponsors/simonbrunou)

Web app to track a baby's food diversification, with parent sharing. Self-hosted, single Docker container, French UI.

## Stack

- SvelteKit (Svelte 5 + TypeScript)
- Postgres via `pg` + Drizzle ORM (`pg-mem` in tests)
- Tailwind CSS, in-house auth (Argon2id sessions, WebAuthn passkeys)
- i18n via `@inlang/paraglide-sveltekit` (FR default, `/en/` for English)
- PWA via `@vite-pwa/sveltekit` with an in-page offline log queue
- Observability via `@sentry/sveltekit` (strict PII scrubbing)
- Node adapter, deployed in a single Alpine Docker image

## Development

```bash
npm install
docker compose up -d postgres   # local Postgres for dev
DATABASE_URL=postgres://diversif:diversif@localhost:5432/diversif npm run dev
npm run db:generate   # only when schema.ts changes
```

The app reads `DATABASE_URL` at startup, runs migrations, and seeds the food catalog automatically on first connect.

## Tests / checks

```bash
npm run check
npm run lint
npm run test
npm run build
```

## Production deploy

The reference deploy is **Coolify**, which provides a managed Postgres and injects `DATABASE_URL` into the app container automatically. Migrations and seeding run on every container start (idempotent). Backups are handled by Coolify's managed-DB tooling.

The repo's `docker-compose.yml` is a **local-dev example only** — it brings up the app plus a throwaway Postgres on `localhost:5432`. Don't use it in production unless you own the Postgres lifecycle yourself.

### Reverse proxy / Cloudflare Tunnel

When the app sits behind a proxy (Coolify/Traefik, a Cloudflare Tunnel, nginx, etc.), `adapter-node` needs a few env vars to recover the real client IP and scheme. Without them the per-IP rate limits on `/signup` and `/login` see the proxy as a single client, so one bad actor can lock everyone out.

For a Cloudflare Tunnel terminating at Coolify (the reference deploy):

```
ADDRESS_HEADER=cf-connecting-ip
PROTOCOL_HEADER=x-forwarded-proto
HOST_HEADER=x-forwarded-host
```

`cf-connecting-ip` is safe to trust **only because** a Tunnel origin has no public port — all traffic must transit Cloudflare, so a direct connection can't spoof the header. If you ever expose the Coolify host directly to the Internet, switch to `ADDRESS_HEADER=x-forwarded-for` and set `XFF_DEPTH` to the number of trusted proxies between you and the client (otherwise a client-supplied XFF entry wins).

### Backups

Coolify's managed-DB tooling owns backup orchestration in production. For ad-hoc local dumps:

```bash
docker compose exec postgres pg_dump -U diversif diversif > diversif-$(date +%F).sql
```

> Only run `docker compose down -v` if you intend to wipe the local-dev database — the `-v` flag deletes the named volume.

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

Diversif est conçu pour être conforme au RGPD lorsqu'il est exposé en tant qu'instance publique (l'éditeur agit alors comme responsable de traitement). Aucune donnée n'est partagée avec un tiers ; la base Postgres reste chez l'hébergeur de l'instance.

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

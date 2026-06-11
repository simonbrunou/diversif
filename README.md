# Diversif

[![Sponsor](https://img.shields.io/badge/sponsor-%E2%9D%A4-ec4899?logo=github)](https://github.com/sponsors/simonbrunou)

Web app to track a baby's food diversification, with parent sharing. Self-hosted, single Docker container, French UI.

## Stack

- Bun 1.3+ runtime (dev, test, build, prod server)
- SvelteKit (Svelte 5 + TypeScript) on `svelte-adapter-bun`
- SQLite via `bun:sqlite` + Drizzle ORM (in-memory `bun:sqlite` in tests)
- Tailwind CSS, in-house auth (`Bun.password` Argon2id sessions, WebAuthn passkeys)
- i18n via `@inlang/paraglide-sveltekit` (FR default, `/en/` for English)
- PWA via `@vite-pwa/sveltekit` with an in-page offline log queue
- Observability via `@sentry/sveltekit` (strict PII scrubbing)
- Deployed in a single `oven/bun` Docker image

## Development

```bash
bun install
DATABASE_PATH=./dev.db WEBAUTHN_RP_ID=localhost bun run dev
bun run db:generate   # only when schema.ts changes
```

The app reads `DATABASE_PATH` at startup, creates the SQLite file if absent, runs migrations, and seeds the food catalog automatically on first boot.

Passkeys require `WEBAUTHN_RP_ID` to match the browser host's registrable domain. The hosted default is `diversif.app`; set `WEBAUTHN_RP_ID=localhost` for local Docker, or to your own bare hostname when self-hosting on a custom domain.

## Tests / checks

```bash
bun run check
bun run lint
bun test
bun run build
```

## Production deploy

The reference deploy is **Coolify** with the **Railpack** builder. A persistent volume is mounted at `/app/data` and `DATABASE_PATH=/app/data/diversif.db` is set, so the SQLite database survives redeploys. Migrations and seeding run on every container start (idempotent). The volume MUST persist and be backed up — losing it loses all data.

The repo's `docker-compose.yml` is a **local-dev / self-hosting example** — it builds the app and mounts a named volume at `/app/data` for the SQLite file.

### Reverse proxy / Cloudflare Tunnel

When the app sits behind a proxy (Coolify/Traefik, a Cloudflare Tunnel, nginx, etc.), `svelte-adapter-bun` needs a few env vars to recover the real client IP and scheme. Without them the per-IP rate limits on `/signup` and `/login` see the proxy as a single client, so one bad actor can lock everyone out.

For a Cloudflare Tunnel terminating at Coolify (the reference deploy):

```
ADDRESS_HEADER=cf-connecting-ip
PROTOCOL_HEADER=x-forwarded-proto
HOST_HEADER=x-forwarded-host
```

`cf-connecting-ip` is safe to trust **only because** a Tunnel origin has no public port — all traffic must transit Cloudflare, so a direct connection can't spoof the header. If you ever expose the Coolify host directly to the Internet, switch to `ADDRESS_HEADER=x-forwarded-for` and set `XFF_DEPTH` to the number of trusted proxies between you and the client (otherwise a client-supplied XFF entry wins).

### Backups

In production the database is a single SQLite file on the persistent volume; an
off-box cron takes a consistent `VACUUM INTO` snapshot and ships it to encrypted
object storage. For an ad-hoc consistent local snapshot:

```bash
# Online-safe snapshot (works while the app is running):
sqlite3 "$DATABASE_PATH" "VACUUM INTO 'diversif-$(date +%F).db'"
```

> Only run `docker compose down -v` if you intend to wipe the local-dev database — the `-v` flag deletes the named volume holding the SQLite file.

## Routes overview

- `/login`, `/signup`, `/logout`, `/join/[code]`
- `/child/new`, `/child/[id]` (dashboard)
- `/child/[id]/log` — log a food
- `/child/[id]/foods` — full history with filters (allergens, categories, stats segments)
- `/child/[id]/suggestions` — what to introduce next
- `/child/[id]/settings` — child info, members, invitations, danger zone
- `/account` — profile, password, logout everywhere

## Vie privée & RGPD

Diversif est conçu pour être conforme au RGPD lorsqu'il est exposé en tant qu'instance publique (l'éditeur agit alors comme responsable de traitement). Aucune donnée n'est partagée avec un tiers ; la base SQLite reste chez l'hébergeur de l'instance.

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
bun scripts/cleanup.ts
```

`scripts/list-stale-users.ts` liste (sans supprimer) les comptes inactifs depuis plus de `RETENTION_INACTIVE_DAYS` jours. L'inactivité est mesurée sur le maximum de `users.last_login_at` (mis à jour à la connexion **et** lors du renouvellement automatique de la session), de la dernière session encore en base (moins 30 jours) et de `users.created_at`. Aucune suppression automatique des comptes inactifs n'est effectuée en v1.

### Export / suppression manuels d'un compte

Pour répondre manuellement à une demande RGPD article 15 / 20 (par exemple si l'utilisateur ne peut pas se connecter) :

```bash
bun scripts/export-user.ts user@example.com
```

## Internationalisation

The UI is bilingual — French (default) and English under `/en/`, via paraglide. Message-key parity between `messages/fr.json` and `messages/en.json` is enforced by `bun run lint:i18n`. **Legal and marketing pages (mentions légales, politique de confidentialité, CGU, guide, sources, allergènes) are intentionally French-only _content_** — only the app chrome translates. Localise those pages only if reaching an English-speaking audience becomes a goal.

## License

Diversif is licensed under the **GNU General Public License v3.0 or later** (`GPL-3.0-or-later`) — see [`LICENSE`](./LICENSE). Editorial content (guides, allergen cards, sources) is provided for personal and informational use.

## Out of scope (for the MVP)

BLW textures, photos, quantities, recipes, growth charts, push notifications, CSV/PDF export, read-only sharing.

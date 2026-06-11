# Copilot Instructions — Diversif

## Build, test, and lint commands

### Development

```bash
npm run dev                    # Start Vite dev server (http://localhost:5173)
npm run check                  # Type-check + svelte-check (run before commit)
npm run check:watch           # Same, but watch mode
npm run lint                   # Prettier + ESLint checks
npm run format                 # Auto-fix formatting and linting
```

### Testing

```bash
npm test                       # Run unit tests (uses pg-mem, no live DB needed)
npm test:watch                 # Watch mode for unit tests
npm test:coverage             # Unit test coverage report
npm run test:e2e              # E2E tests (Playwright; resets e2e DB first)
npm run test:e2e:install      # Install Playwright deps (one-time)
```

### Building

```bash
npm run build                  # Production SvelteKit build (outputs to build/)
npm run preview               # Preview production build locally
npm run paraglide             # Regenerate i18n (run if messages change)
```

### Database

```bash
npm run db:generate          # Generate Drizzle migrations after schema changes
npm run db:push              # Push migrations to Postgres
```

**Development setup** (first time):

```bash
npm install
docker compose up -d postgres
DATABASE_URL=postgres://diversif:diversif@localhost:5432/diversif npm run dev
```

## High-level architecture

### Stack

- **Frontend**: SvelteKit 5 (TypeScript) + Svelte components
- **Backend**: SvelteKit server endpoints + Drizzle ORM
- **Database**: Postgres (dev via Docker, prod via managed host like Coolify)
- **Auth**: Argon2id password hashing + WebAuthn passkeys (server: `@simplewebauthn/server`, client: `@simplewebauthn/browser`)
- **i18n**: `@inlang/paraglide-js` 2.x (FR default, EN locale; built-in URL strategy + server middleware)
- **PWA**: `@vite-pwa/sveltekit` with offline log queue (IndexedDB) that replays on reconnect
- **CSS**: Tailwind + custom CSS (no dark-mode-first; system-driven dark theme for accessibility)
- **Testing**: Vitest (unit tests with pg-mem) + Playwright (E2E)
- **Observability**: Sentry with strict PII scrubbing (error reporting only; no analytics)

### Module structure

```
src/
├── lib/
│   ├── components/
│   │   ├── bento/        # "Joyful bento" design tiles (AllergensSnapshot, CarnetSegments, etc.)
│   │   ├── landing/      # Public landing page components
│   │   ├── ui/           # Generic UI building blocks (Button, Card, Select, Modal, etc.)
│   ├── server/
│   │   ├── db/           # Database schema, queries, migrations
│   │   ├── auth.ts       # Session/auth utilities
│   │   ├── passkeys.ts   # WebAuthn logic
│   │   ├── gdpr.ts       # Account export/deletion (RGPD article 15/20)
│   │   ├── rate-limit.ts # Per-IP rate limiting
│   │   ├── audit.ts      # Action audit trails
│   │   ├── cleanup.ts    # Session/invitation/passkey expiry cleanup
│   ├── utils/            # Client-side utilities (formatting, date helpers)
│   ├── offline/          # Offline log queue (IndexedDB)
│   ├── content/          # Static pediatric content
│   ├── sentry.ts         # Error reporting config
│   ├── i18n.ts           # i18n helpers
├── routes/               # SvelteKit file-based routing (+page.svelte, +server.ts)
│   ├── +layout.svelte    # Root layout (auth guard, theme toggle)
│   ├── (auth)/           # /login, /signup, /join/[code], /account
│   ├── (app)/            # /child/[id]/* (protected routes)
├── hooks.server.ts       # Security headers, auth middleware, Sentry
├── hooks.client.ts       # Offline queue, Sentry client
├── app.css               # Global styles + design tokens
```

### Data flow: logging a food

1. Parent taps FAB → `/child/[id]/log` sheet appears
2. Component dispatches to `src/routes/(app)/child/[id]/log/+server.ts` POST endpoint
3. Server validates user membership + guards via `checkUserAndChildAccess()`
4. Creates `foods_eaten` row in Postgres (via Drizzle)
5. Returns success → toast appears, sheet closes
6. **Offline case**: POST fails → client queues entry in IndexedDB, retries on reconnection with idempotency key

### Key database concepts

- **`users`**: Accounts (Argon2id hashed passwords, WebAuthn passkeys, session consent timestamps for RGPD)
- **`children`**: Baby profiles (belongs to primary parent + invited co-parents)
- **`foods_eaten`**: Log entries (food_id, child_id, reaction_type, timestamp, idempotency_key)
- **`memberships`**: Co-parent access (user_id, child_id, role: "owner" or "member", joined_at)
- **`invitations`**: Shareable join links (code, child_id, expires_at)
- **`passkeys`**: WebAuthn credentials (user_id, serialized challenge + attestation)
- Cleanup task runs at startup + every 6 hours (expires sessions, invitations, passkeys)

### Authentication flow

1. **Login/signup**: Username + password (Argon2id) OR passkey (WebAuthn)
2. Session stored as JWT-like cookie (`session`, httpOnly, secure in production)
3. Server-side: session lookup via `locals.user` in `hooks.server.ts`
4. Protected routes guard via `checkUserAndChildAccess()` and `locals.user` checks
5. Passkey challenge stored in Postgres, replayed on verification

## Key conventions

### French UI, no anglicisms

**CRITICAL**: The app defaults to French. PR reviewers reject anglicism regressions.

- ✅ "Enregistrer" (save a log), "Régularité" (streak), "Adresse e-mail", "Bilan" (food summary/stats)
- ❌ Never "logger", "Streak", "Email", "Stats"
- Text that appears in UI must go through `@inlang/paraglide` i18n (see `src/lib/paraglide/` messages)

### Design tokens and "joyful bento"

The app uses a pastel palette (peach, butter, mint, sky, lilac) over warm cream, never clinical or dark-by-default.

```css
/* Canvas and surfaces */
--bg: #fdfaf3; /* Cream background */
--surface: #ffffff; /* Cards */
--surface-2: #f6efdc; /* Warm-50 for elevated tiles */

/* Brand and accents */
--primary: #6b8e6b; /* Sage */
--tile-peach: #ffd9c0; /* Hero, new actions */
--tile-butter: #ffeeb0; /* Streaks, milestones */
--tile-mint: #c8e6d3; /* Success, RAS */
--tile-sky: #c5dfff; /* Info */
--tile-lilac: #e0d5ff; /* Suggestions */
--severe-coral: #ff8a6b; /* RESERVED: only for "appeler le 15" */

/* Text */
--ink: #1a1a1a; /* Primary text */
--ink-soft: #525252; /* Captions, meta */
```

See `src/app.css` for the full Tailwind config and CSS variables.

### Component patterns

- **Bento components** (`src/lib/components/bento/`): Large, tile-based UI blocks with colored backgrounds. Examples: `AllergensSnapshot`, `CarnetSegments`, `ReassuranceHero`, `StagesBentoGrid`.
- **UI components** (`src/lib/components/ui/`): Generic building blocks (buttons, cards, modals, inputs). Use `bits-ui` headless components for complex widgets (select, dialog).
- **Tests**: Colocated `.test.ts` files. Use `vitest` + `@testing-library/svelte`. No visual regression tests; focus on logic.

### Code style

- **TypeScript**: Strict mode, no `any`. Use `Zod` for runtime validation of untrusted input.
- **Svelte**: Reactive declarations (`$:`) for derived state. Use named exports for components.
- **Prettier**: Configured for `.svelte`, `.ts`, `.js`, `.css`, `.json`, `.md`. Pre-commit hook runs `prettier --write` + `eslint --fix`.
- **No `npm audit fix`**: It rewrites lockfile in a way CI's older npm rejects. For new overrides, delete `node_modules` and reinstall instead.

### Server-side patterns

- **Route guards**: `checkUserAndChildAccess(event, childId)` and `checkChildOwner(event, childId)` in `src/lib/server/guards.ts`
- **Rate limiting**: Per-IP limits on `/login`, `/signup`, `/join/[code]` via `src/lib/server/rate-limit.ts`
- **Idempotency**: `foods_eaten` rows include `idempotency_key` (UUID). Offline queue uses this to prevent duplicate logs.
- **GDPR/RGPD**: Account export (article 15) and deletion (article 20) in `src/lib/server/gdpr.ts`
- **Audit**: All sensitive actions logged to `audit_log` table (login, password change, membership change, account deletion)

### Testing conventions

- **Unit tests**: Use `pg-mem` (in-memory Postgres mock) — no live DB needed. Run `npm test` before committing.
- **E2E tests**: Playwright tests in `e2e/`. Script `reset-e2e-db.mjs` wipes and re-seeds before each run. Use `npm run test:e2e`.
- **Test isolation**: Each test gets a fresh in-memory or E2E DB. No shared state.

### Offline & PWA

- **IndexedDB queue**: `src/lib/offline/queue.ts` — parent logs food offline, stored with idempotency key, replayed on reconnect
- **Service worker**: Managed by `@vite-pwa/sveltekit`; caches static assets + API responses
- **Sync strategy**: Exponential backoff on failed POST; retries every 30s up to 5 min
- **Conflict resolution**: Idempotency key prevents double-logging; server deduplicates by key

### Internationalization

- **i18n files**: `project.inlang/` (Inlang configuration)
- **Message extraction**: `npm run paraglide` compiles messages from `messages/*.json` into `src/lib/paraglide/messages.js`
- **Usage in components**: Import `{ m }` from `$lib/paraglide/messages` and use `m.message_key()`
- **Multiple locales**: Default FR, EN variant at `/en/` (handled by paraglide-js 2.x `deLocalizeUrl` reroute + `paraglideMiddleware`)

### Security headers

Set in `src/hooks.server.ts`:

- CSP (Content-Security-Policy) — no inline scripts
- HSTS (only in production) — force HTTPS
- X-Frame-Options: DENY — prevent clickjacking
- X-Content-Type-Options: nosniff
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: disables geolocation, camera, microphone
- Cross-Origin-Opener-Policy: same-origin-allow-popups (for passkey windows)

### Error handling & Sentry

- **Sentry**: Initialized in `src/lib/sentry-init.server.ts` (server) and hooks (client)
- **PII scrubbing**: Strict rules in Sentry config — no user emails, UUIDs, or IP addresses logged
- **Client errors**: Caught and reported; user sees a toast ("Une erreur s'est produite")
- **Server errors**: Logged to Sentry; user sees 500 page with safe message

### Environment variables

- `DATABASE_URL` — Postgres connection string (required)
- `SENTRY_DSN` — Sentry error reporting endpoint (optional)
- `LEGAL_*` — GDPR compliance fields (optional; defaults to "À compléter")
- `ADDRESS_HEADER`, `PROTOCOL_HEADER`, `HOST_HEADER`, `XFF_DEPTH` — reverse proxy trust (see README for Cloudflare Tunnel example)

## graphify integration

This project has a knowledge graph at `graphify-out/`. Before answering complex architecture or codebase questions:

1. Read `graphify-out/GRAPH_REPORT.md` for god nodes and community structure
2. For cross-module relationships, use `graphify query "<question>"` or `graphify path "<A>" "<B>"` instead of grep
3. After modifying code files, run `graphify update .` to keep the graph current

## Additional resources

- **CLAUDE.md**: Context for Claude (overlaps with this file; CLAUDE.md is the source of truth for Claude-specific conventions)
- **PRODUCT.md**: Product vision, tone, brand palette, design principles, user personas
- **README.md**: Deployment, GDPR compliance, environment setup

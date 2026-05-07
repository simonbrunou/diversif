# i18n Scaffolding (FR + EN, paraglide-sveltekit) — Design

**Date:** 2026-05-07
**Status:** Approved (pending implementation plan)
**Owner:** Simon Brunou

## Goal

Wire `@inlang/paraglide-js` + `@inlang/paraglide-sveltekit` for FR + EN, and translate a representative slice of the app (auth pages, shell chrome, dashboard headings) end-to-end. FR remains the default and the source-of-truth; EN ships as an additive surface under the `/en/` URL prefix.

The goal is to **prove the i18n pattern is alive and used**, not to translate everything. Long-form expert content (`guidance.ts`, `sources.ts`) and French-law-specific legal pages stay FR-only with explicit annotation.

## Non-goals

- Translating `src/lib/content/guidance.ts` or `sources.ts` — these are expert pediatric content (HCSP, EAT, LEAP, etc.) and bibliography. Needs an EN expert pass; out of scope here.
- Translating `/mentions-legales`, `/politique-confidentialite`, `/sources`, or `/child/[id]/guide` — French-law-specific. A French lawyer's review for an EN translation is the safe default; out of scope.
- Auto-redirecting users by `Accept-Language` — manual switch only. Auto-redirect surprises users who share `/foo` links across language preferences; can be added later if usage data argues for it.
- Translating ARIA labels, form-input placeholders, or chart axis labels not in the slice. Stage two.
- Internationalising number/date formats beyond what `Intl.DateTimeFormat` already does in `src/lib/utils/dates.ts`. The existing locale-neutral formatters are fine.

## Architecture

```
┌──────── messages/ ──────────┐    ┌─── src/lib/paraglide/ ────┐
│  fr.json  ── source of truth │    │  (generated, .gitignored) │
│  en.json  ── translation     │ →  │  m.welcomeTitle()         │
│  project.inlang/settings.json│    │  setLanguageTag()         │
└──────────────────────────────┘    │  baseLocale = 'fr'        │
       ↑ vite plugin compiles       │  locales = ['fr', 'en']    │
                                    └────────────────────────────┘
                                              ↓ imported by
       ┌─── src/hooks.ts ────┐       ┌─── components/pages ───┐
       │  paraglide reroute  │       │  m.welcomeTitle()       │
       │  /en/login → /login │       │  m.dashboardGreeting({  │
       │  with locale='en'   │       │    name: child.name })  │
       └─────────────────────┘       └─────────────────────────┘
```

- `@inlang/paraglide-js` is the runtime (~1 KB).
- `@inlang/paraglide-sveltekit` is the SvelteKit adapter — exposes a `reroute` for `src/hooks.ts` and a `paraglideMiddleware` wrapper for `src/hooks.server.ts`.
- `project.inlang/settings.json` declares the locales; the `@inlang/plugin-message-format` reads `messages/*.json`.
- The vite plugin (`@inlang/paraglide-sveltekit/vite`) regenerates `src/lib/paraglide/` on dev hot-reload and prod build.
- `src/app.html` swaps hard-coded `lang="fr"` for paraglide's `%paraglide.lang%` placeholder.

**Routing:** default locale `fr` is unprefixed (existing URLs keep working). `en` is prefixed with `/en/`. Paraglide's `reroute` normalises `/en/login` → `/login` with `locale='en'` on the request.

## PII / privacy posture (unchanged)

No new third parties. Paraglide is build-time + runtime in-process; no telemetry, no remote calls. The privacy policy doesn't need updating.

## Components

| File                                                                                                         | Status | Responsibility                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                                                                                               | edit   | Add `@inlang/paraglide-js`, `@inlang/paraglide-sveltekit` (devDep).                                                                                                                                                                                   |
| `project.inlang/settings.json`                                                                               | new    | `baseLocale: 'fr'`, `locales: ['fr','en']`, message-format plugin pointing at `messages/`.                                                                                                                                                            |
| `messages/fr.json`                                                                                           | new    | French source-of-truth strings (extracted from the slice).                                                                                                                                                                                            |
| `messages/en.json`                                                                                           | new    | English translations (mirror of `fr.json` keys).                                                                                                                                                                                                      |
| `src/app.html`                                                                                               | edit   | `<html lang="fr">` → `<html lang="%paraglide.lang%">`.                                                                                                                                                                                                |
| `src/hooks.ts`                                                                                               | new    | One-line: `export const reroute = i18n.reroute()` from paraglide-sveltekit.                                                                                                                                                                           |
| `src/hooks.server.ts`                                                                                        | edit   | Wrap `handle` with `paraglideMiddleware`; preserve all existing behaviour (Sentry init, session loading, security headers, X-Robots-Tag).                                                                                                             |
| `vite.config.ts`                                                                                             | edit   | Add `paraglide({ project: 'project.inlang', outdir: 'src/lib/paraglide' })` plugin. Add `src/lib/paraglide/**` and `src/hooks.ts` to `coverage.exclude`.                                                                                              |
| `.gitignore`                                                                                                 | edit   | Add `src/lib/paraglide/` (generated).                                                                                                                                                                                                                 |
| `src/lib/components/LocaleSwitcher.svelte`                                                                   | new    | "FR / EN" pill; reads current locale from page state; renders the alternate URL via paraglide's `i18n.route()`. Progressively-enhanced anchors.                                                                                                       |
| `src/lib/components/PublicHeader.svelte`                                                                     | edit   | Replace inline FR strings with `m.X()`; mount `LocaleSwitcher`.                                                                                                                                                                                       |
| `src/lib/components/PublicFooter.svelte`                                                                     | edit   | Replace inline FR strings with `m.X()`. **No** `LocaleSwitcher` — header is enough.                                                                                                                                                                   |
| `src/lib/components/AppShell.svelte`                                                                         | edit   | Replace strings; mount `LocaleSwitcher`.                                                                                                                                                                                                              |
| `src/lib/components/BottomNav.svelte`                                                                        | edit   | Replace strings.                                                                                                                                                                                                                                      |
| `src/lib/components/WelcomeDialog.svelte`                                                                    | edit   | Replace strings.                                                                                                                                                                                                                                      |
| `src/lib/components/LegalLinks.svelte`                                                                       | edit   | Replace link labels.                                                                                                                                                                                                                                  |
| `src/routes/+error.svelte`                                                                                   | edit   | Replace strings.                                                                                                                                                                                                                                      |
| `src/routes/login/+page.svelte`, `+page.server.ts`                                                           | edit   | UI strings via `m.X()`. Server actions return `fail(400, { errorKey: '<dotted>' })` instead of literal strings; client renders via `m[errorKey]?.()`.                                                                                                 |
| `src/routes/signup/+page.svelte`, `+page.server.ts`                                                          | edit   | Same.                                                                                                                                                                                                                                                 |
| `src/routes/account/+page.svelte`, `+page.server.ts`                                                         | edit   | Same.                                                                                                                                                                                                                                                 |
| `src/routes/account/deleted/+page.svelte`                                                                    | edit   | UI strings only.                                                                                                                                                                                                                                      |
| `src/routes/cookies/+page.svelte`                                                                            | edit   | UI strings only.                                                                                                                                                                                                                                      |
| `src/routes/child/[id]/+page.svelte`                                                                         | edit   | Headings, button labels, badge labels, the welcome banner. **Not** dynamic data from `guidance.ts`/loaders.                                                                                                                                           |
| `src/routes/child/[id]/guide/+page.svelte`                                                                   | edit   | If locale === `'en'`: render an `m.guideOnlyAvailableInFrench()` banner above the existing guidance section. Wrap the guidance in `<section lang="fr">`.                                                                                              |
| `src/routes/mentions-legales/+page.svelte`, `politique-confidentialite/+page.svelte`, `sources/+page.svelte` | edit   | If locale === `'en'`: render an `m.legalOnlyAvailableInFrench()` banner. Wrap content in `<section lang="fr">`. The `Seo` component's `path` prop stays the canonical FR path; no `/en/` SEO entry.                                                   |
| `src/routes/sitemap.xml/+server.ts`                                                                          | edit   | Emit `/en/...` entries for translated routes only. Untranslated routes appear once (FR canonical). Existing `<lastmod>` logic unchanged.                                                                                                              |
| `src/lib/components/Seo.svelte`                                                                              | edit   | Add an optional `alternateLocales: string[]` prop. When set, emit `<link rel="alternate" hreflang="<locale>" href="..." />` for each, plus the FR canonical's `hreflang="fr"`. Translated pages opt in by setting the prop; untranslated pages don't. |

## Translated slice — exact list

This locks scope. Anything not on this list stays in inline French and is safe to translate later in a follow-up.

- Public chrome: `PublicHeader`, `PublicFooter`, `LegalLinks`
- App chrome: `AppShell`, `BottomNav`
- Dialogs: `WelcomeDialog`
- Generic: `+error.svelte`
- Auth: `login`, `signup`, `account`, `account/deleted`
- Static: `cookies`
- Dashboard: `child/[id]/+page.svelte` — only headings, button labels, status badges, the welcome banner. Loaders' rendered content (recent entries, allergen names from `allergens.ts`, category labels from `categories.ts`, reminder bodies from `computeReminders`) stays as-is.

Page-count check: ~12 components + ~6 routes = ~18 files. ~80–120 messages estimated.

## Data flow

**Client navigation to `/en/account`:**

1. SvelteKit's `reroute` hook (`src/hooks.ts`) — paraglide rewrites the path to `/account` and sets `locale='en'` on the request.
2. `paraglideMiddleware` in `hooks.server.ts` reads the locale and exposes it on `event.locals.locale`.
3. SvelteKit matches the route as `/account`, runs the existing load.
4. Page renders using `m.X()` calls — paraglide reads the per-request locale and returns the EN string.
5. `<html lang="%paraglide.lang%">` is replaced with `lang="en"` at SSR time.

**Form-error flow (login fails):**

1. Server `actions.default` returns `fail(400, { errorKey: 'auth.invalidCredentials' })`.
2. Page reads `form?.errorKey` and renders `{m[errorKey]()}`.
3. Tests assert on `errorKey` (stable identifier), not on the literal string.

**LocaleSwitcher click on `/account`:**

1. Component reads `$page.url.pathname` = `/account`, current locale = `fr`.
2. The "EN" anchor's `href` is `i18n.route('/account', 'en')` = `/en/account`.
3. Click → SvelteKit navigation → reroute hook fires → locale flips. No state lost.

**Reading locale inside Svelte components:** paraglide's runtime exposes `languageTag()` from `$lib/paraglide/runtime`. The `paraglideMiddleware` sets it per-request server-side and per-navigation client-side, so any Svelte component can call `languageTag()` directly without prop-drilling or accessing `$page`. This is what FR-only banner conditionals (`if (languageTag() === 'en')`) read.

## Error handling / failure modes

- **Missing translation key:** paraglide's TS types make this a compile error. Runtime fallback is the `baseLocale` string. Safe.
- **`m[errorKey]?.()` returns undefined for an unknown key:** form errors render a generic `m.errorGeneric()` instead. Belt-and-braces.
- **Build-time message corruption:** if `messages/fr.json` is malformed JSON, the vite plugin throws, build fails. Acceptable.
- **Generated `src/lib/paraglide/` drift on a teammate's machine:** they regenerate on `npm run dev` or `npm run build`. The directory is gitignored.
- **Sentry tag impact:** none. The `route` tag emitted by `handleError` is the SvelteKit pattern (`/child/[id]/log/[entryId]`), independent of locale. EN-prefixed URLs collapse to the same pattern after reroute.

## Testing

| File                                              | What it covers                                                                                                                                                                                |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/components/LocaleSwitcher.test.ts` (new) | Renders both FR/EN as anchors. Active locale gets a `data-active` attribute. EN's href is `/en/<current-path>`; FR's href is `<current-path-without-en-prefix>`. Mocked `$page.url.pathname`. |
| `src/hooks.server.test.ts` (extend)               | A request to `/en/login` ends up with `event.locals.locale === 'en'` after `paraglideMiddleware`; a request to `/login` ends up with `'fr'`.                                                  |
| `src/routes/login/page.server.test.ts` (extend)   | Existing assertions on literal error strings flip to assertions on `errorKey`. New assertion: a missing `errorKey` falls back to `errorGeneric`.                                              |
| `tests/i18n.spec.ts` (new Playwright)             | Visit `/`, click the EN switcher in the header, assert `<html lang="en">` and that the page's main heading now matches the EN message. One smoke.                                             |

**Coverage:**

- 100% threshold remains. Paraglide-generated `src/lib/paraglide/**` is excluded (regenerated on every build). `src/hooks.ts` is a one-liner re-export — excluded with the same justification as `hooks.client.ts`.
- All other touched files retain 100% via the existing test suite (the inline-string → `m.X()` swap is a 1:1 transform; existing tests assert behaviour, not literal copy).

## Operational

- **Dependabot:** paraglide-sveltekit pulls a moderate dep tree; check `npm audit` after install. If anything trips, reuse the existing `overrides` pattern in `package.json`. **Do not** run `npm audit fix` (CI uses an older npm; lockfile incompat).
- **Coolify deploy:** no env-var changes. Build runs `vite build` which triggers paraglide compilation.
- **Sitemap regeneration:** the `sitemap.xml` route emits both FR and EN URLs for translated routes. Verify in production after first deploy that Google's Search Console picks up the EN sitemap entries.

## Out of scope (followups)

- Translate `guidance.ts` (needs an EN pediatric expert pass).
- Translate legal pages (needs an EN-jurisdiction or expert review of the French legal text's translatability).
- ARIA labels, placeholders, chart axes, error-page details.
- A `useLocale()` Svelte store for client-side locale-dependent computations beyond what paraglide already exposes.
- Format-specific i18n: currency, plural rules beyond ICU's basic forms.
- A 3rd locale (es, de, etc.). The pattern is locale-agnostic; adding more is just `messages/X.json` + adding to `project.inlang/settings.json`.

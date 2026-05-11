# Phase 6 — Auth + Onboarding + Landing + Legal — Design Spec

**Date:** 2026-05-11
**Status:** approved, ready for implementation plan
**Tracks roadmap item:** Phase 6 of the bento UI/UX redesign (see `2026-05-10-ui-ux-redesign-design.md`)

## Problem

Phases 1–5 landed the bento stack for everything reachable from the bottom nav (Aujourd'hui, Carnet, Découvrir, Profil) and the new reaction-detail flow. Four surfaces remain on the legacy register:

1. **Auth** — `/signup`, `/login`. A new parent's literal first impression of the product. Currently uses generic `Card` + `Input` primitives with no bento personality.
2. **Onboarding** — `/child/new`. The first child setup form, hit immediately after signup. Currently a bare two-field form.
3. **Marketing landing** — `/`. The public homepage with SEO + JSON-LD. Brand register, not product register.
4. **Legal pages** — `/cgu`, `/mentions-legales`, `/politique-confidentialite`, `/cookies`. Informational documents.

Plus a ship-gate behavioral change: the `bentoEnabled` flag should default to ON for new signups, and existing legacy-shell users need an opt-in path that doesn't require a dev console.

## Goal

Land the four remaining surfaces in bento, flip the feature flag default-on for new signups, and surface an opt-in banner on legacy Aujourd'hui for existing users. After Phase 6, the only users on the legacy shell are ones who haven't been to the app in months — Phase 7 cleans up.

## Non-goals

- **No content changes to legal pages.** CGU, mentions-légales, politique-confidentialité, cookies stay byte-identical in copy. Restyle only.
- **No SEO/JSON-LD changes on landing.** `Seo`, `JsonLd`, FAQ JSON-LD, `webApplicationJsonLd`, `faqPageJsonLd` all stay untouched.
- **No new auth methods.** Passkey CRUD already exists; we promote the existing passkey button to primary CTA on login when the user has registered keys.
- **No multi-step onboarding wizard.** Single form + optional invite section below. The "two taps" PRODUCT.md principle wins over wizards.
- **No allow-list removal.** `BENTO_ALLOW_LIST` stays as an internal escape hatch. Phase 7 reassesses.
- **No marketing copy rewrite.** Existing landing structure (Hero / Features / Trust / Closing / FAQ) and copy stay; we restyle.
- **No A/B test infra for the opt-in banner.** Either you're on legacy (banner) or you're on bento (no banner). Dismissible.
- **No analytics, no funnel tracking.** Telemetry-free posture continues.

## Architecture

### Routes

| Path                                                                  | State                       | Phase 6 behavior                                                                                                                                                               |
| --------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/signup`                                                             | restyle + action            | Body wraps `BentoAuthLayout`. The `signup` action sets `bento=1` cookie on successful account creation. Invite-code path (existing) behavior unchanged.                        |
| `/login`                                                              | restyle                     | Body wraps `BentoAuthLayout`. When the user has registered passkeys, the passkey button is promoted to the primary CTA.                                                        |
| `/child/new`                                                          | restyle + action            | Single form gains an optional `coparentEmail` field. When provided + valid, the action creates the child AND generates an invitation via the existing helper.                  |
| `/` (landing)                                                         | restyle                     | LandingHero/Features/Trust/Closing replaced with bento variants using the **Committed** palette (peach-led hero). SEO + JSON-LD + FAQ untouched.                               |
| `/cgu`, `/mentions-legales`, `/politique-confidentialite`, `/cookies` | restyle                     | Cream canvas, Fraunces section headings, sage in-content links, tighter typography rhythm. Copy unchanged.                                                                     |
| `/child/[id]` (legacy branch)                                         | conditional banner + action | When `bentoEnabled` is false, render `BentoOptInBanner` near the top. Banner CTA submits to a new `?/optInBento` action that sets the `bento=1` cookie and 303-redirects back. |

### Feature flag posture

`bentoEnabled` in `$lib/feature-flags.ts` stays unchanged. The behavior shift is at the boundary:

- **New signups** — `/signup` action sets `cookies.set('bento', '1', { path: '/', sameSite: 'lax', secure: prod, maxAge: 365 days })` after the user record is inserted.
- **Existing legacy users** — `BentoOptInBanner` on Aujourd'hui legacy branch sets the same cookie when dismissed via "Essayer le nouveau design ✨".
- **Allow-list (`BENTO_ALLOW_LIST`)** — kept as the internal escape hatch (owner email). Phase 7 may remove.

### Database migration

**None.** All changes are UI components, flag wiring, and form-action extensions on existing tables.

### Components added (~6)

- `BentoAuthLayout.svelte` — gradient backdrop + bento mark + centered card. Wraps `/signup` and `/login`.
- `BentoMark.svelte` — 44×44 rounded-square bento mark (sage/peach split). Reused in the auth layout AND the landing hero.
- `BentoOptInBanner.svelte` — butter banner shown on legacy Aujourd'hui. Dismissible.
- `LandingHeroBento.svelte` — replaces `LandingHero.svelte` body. Committed palette: peach carries the hero.
- `LandingFeaturesBento.svelte` — replaces `LandingFeatures.svelte` body. 4-tile cluster (mint / butter / sky / lilac).
- `LandingTrustBento.svelte` — replaces `LandingTrust.svelte` body. 3 trust pillars on sky tile.
- `LandingClosingCtaBento.svelte` — replaces `LandingClosingCta.svelte` body. Sage filled tile.
- `OnboardingForm.svelte` — extracted from `/child/new` body, adds optional `coparentEmail` field.

Legal pages don't get extracted components — each is 50–180 lines, the restyle is inline.

### Onboarding form action

Current `/child/new` action: validate prénom + birthDate, insert into `children`, insert membership (owner), 303 redirect to `/child/<id>`.

Phase 6 addition: read optional `coparentEmail`. If present and matches the email zod schema, after child + membership creation, call the existing `createInvitation({ childId, email, invitedBy })` helper (same one used at `/child/[id]/settings#invite`). On invitation success, redirect to `/child/<id>?invited=1` so Aujourd'hui can surface a one-time toast. On invitation rate-limit or other failure, the child still exists — surface a non-fatal toast instead.

### Opt-in form action

New action on the legacy `/child/[id]/+page.server.ts`:

```ts
optInBento: async ({ cookies, params, locals }) => {
  requireMembership(locals, Number(params.id));
  cookies.set('bento', '1', {
    path: '/',
    sameSite: 'lax',
    secure: !dev,
    maxAge: 60 * 60 * 24 * 365
  });
  throw redirect(303, `/child/${params.id}`);
};
```

Banner dismiss is purely client-side: a `bento-opt-in-dismissed=1` cookie set via document.cookie, no server roundtrip.

## Key screens

### `/signup` (wrapped in `BentoAuthLayout`)

Layout: full-viewport peach→butter→cream gradient backdrop, centered white card (`max-w-md`, `rounded-hero`, `shadow-lifted`), 44×44 bento mark at the top of the card.

Card body:

1. Fraunces italic title — "Bienvenue" (or invite-aware "Vous êtes invité")
2. Sub — "Diversifiez en confiance, à votre rythme." (or invite variant)
3. Display name + email + password inputs (pill-rounded, cream background)
4. Existing CGU / politique de confidentialité / age-confirmation checkboxes — copy unchanged for legal compliance
5. Sage **Créer mon compte** full-width CTA
6. "ou" divider
7. Dashed sage outline **🔑 Continuer avec une passkey** → existing `/passkeys/registration/options` flow
8. Footer link — "J'ai déjà un compte · Se connecter"

The form action receives the same fields as today, plus sets the `bento=1` cookie before redirecting to `/child/new`.

### `/login` (wrapped in `BentoAuthLayout`)

Same shell as signup. Card body has two layouts driven by `data.passkeyDiscoveryAvailable` (the existing flag from the loader):

**Passkey-first (user has registered keys):**

1. Title — "Bienvenue de retour"
2. Sage **🔑 Continuer avec une passkey** primary CTA (full-width)
3. Disclosure "Ou avec mot de passe" → reveals email+password collapsed by default

**Password-first (no registered keys):**

1. Title — "Bienvenue de retour"
2. Email + password inputs
3. Sage **Se connecter** primary CTA
4. Secondary dashed outline **🔑 Avec une passkey** (still allows discoverable credential flow)

In both branches, footer link — "Pas encore de compte · S'inscrire".

### `/child/new` (`OnboardingForm`)

Single white card on cream canvas (no gradient — user is signed in, no marketing surface).

1. Fraunces italic title — "Bébé."
2. Sub — "Quelques infos pour commencer le carnet."
3. `Prénom` input (required)
4. `Date de naissance` input — pinned to today as max, 18 months ago as practical min hint (no hard min)
5. Visual hairline divider
6. Section header — "Co-parent (optionnel)"
7. `coparentEmail` input with caption: "On lui enverra un lien d'invitation. Vous pourrez aussi le faire plus tard depuis Profil."
8. Sage **Commencer** full-width CTA

If `coparentEmail` is empty after trim → action skips the invitation step. If invalid email → zod surfaces a validation error inline. If rate-limited → child is created, redirect carries a `?invite=ratelimited` flag for the toast on Aujourd'hui.

### `/` (landing) — bento restyle

Composes new bento variants while preserving the SEO/JSON-LD/FAQ wrapper:

```svelte
<Seo {...} />
<JsonLd ... webApplication />
<JsonLd ... faqPage />
<LandingHeroBento {childOrNull} />
<LandingFeaturesBento />
<LandingTrustBento />
<LandingClosingCtaBento />
<section id="faq"> existing FAQ markup, restyled inline </section>
```

**LandingHeroBento (Committed palette — peach carries the hero):**

- Full-bleed `bg-tile-peach` section (~60dvh on mobile, contained on desktop)
- Bento mark top-left (44×44)
- Fraunces italic display headline (existing FR copy)
- Sub paragraph (existing copy)
- For signed-out visitors: sage **Créer mon compte** + ghost **Se connecter** CTAs side-by-side
- For signed-in visitors with at least one child: existing "Continuer avec {childName}" CTA (logic preserved from `LandingHero.svelte`)

**LandingFeaturesBento:** 4-tile cluster on tablet+, stacked on phone. Each tile uses a different bento color (mint / butter / sky / lilac) with an icon, 2-line title, 1-sentence body. Reuses existing feature copy.

**LandingTrustBento:** 3 trust pillars rendered on a sky-tile band: "Sans télémétrie", "Sources scientifiques citées", "Vos données vous appartiennent". Existing copy reused.

**LandingClosingCtaBento:** Sage filled section with closing CTA (full-width on mobile, centered card on tablet+).

**FAQ:** Existing FAQ markup gets a light restyle inline — each `<details>` becomes a bordered card with bento padding. Content unchanged. JSON-LD untouched.

### Legal pages

Same restyle pattern applied to all four:

- Cream canvas (`bg-canvas`)
- Max-width container (existing layout)
- Page heading (`<h1>`): Fraunces italic, kept at existing size
- Section headings: Inter bold uppercase tracking-wide, ink-soft color
- Body: Inter 14/22, paragraph leading-relaxed
- Lists: tighter rhythm, sage bullet markers (or kept default)
- In-content links: sage underlined
- No bento tiles — these are documents, not bento screens

No content changes. No JSON-LD changes.

### Legacy Aujourd'hui — `BentoOptInBanner`

Rendered at the top of the legacy `/child/[id]/+page.svelte` body when `bentoEnabled` is false. Hidden when the `bento-opt-in-dismissed=1` cookie is set.

- Butter background, rounded
- Body text: "Le nouveau design est prêt."
- Sub: "Voulez-vous l'essayer ?"
- Primary CTA: "Essayer le nouveau design ✨" → form POST to `?/optInBento`
- Dismiss: small `<button aria-label="Fermer">` (×) — sets the dismissed cookie client-side via `document.cookie`, hides the banner without a roundtrip

## Information architecture

- Top-level public routes (`/`, `/signup`, `/login`, `/cgu`, `/mentions-legales`, `/politique-confidentialite`, `/cookies`) get the public layout, which is locale-aware (FR default, `/en/...` variant exists).
- `/child/new` and `/child/[id]` are signed-in routes; the public layout differs.
- The bento mark is a visual anchor across auth pages and the landing hero — but NOT in the app shell (which has its own header pill from Phase 3).

## Data flow

**Signup action:**

```
validate form → create user (existing) → set bento=1 cookie → audit signup → 303 to /child/new
```

**Onboarding action:**

```
validate prénom + birthDate (existing)
+ if coparentEmail present and valid:
    insert child + membership (existing)
    try createInvitation({ childId, email, invitedBy: user.id })
    on success: 303 to /child/<id>?invited=1
    on rate-limit: 303 to /child/<id>?invite=ratelimited
+ else:
    insert child + membership (existing) → 303 to /child/<id>
```

**Opt-in action:**

```
requireMembership(locals, childId) → cookies.set('bento', '1', ...) → 303 to /child/<id>
```

## Privacy / PII posture

Unchanged:

- No new third parties, no telemetry, no analytics.
- Cookies: `bento=1` (existing), `bento-opt-in-dismissed=1` (new, client-side, dismissal only). Both are first-party, no PII, max-age 365 days. The privacy policy already mentions "préférences d'affichage" cookies — no policy update needed.
- Auth gradient is pure CSS; bento mark is local SVG/inline; no external fonts beyond the existing Fraunces/Inter `@fontsource-variable`.

## Migration / sequencing

The PR ships in this order so every commit is shippable. Auth shell components land first (cheaper to test, no behavior dependency); each surface is then a per-route restyle.

1. `BentoMark` component (+ tests)
2. `BentoAuthLayout` component (+ tests)
3. `BentoOptInBanner` component (+ tests)
4. `OnboardingForm` component (+ tests)
5. `LandingHeroBento` component (+ tests)
6. `LandingFeaturesBento` component (+ tests)
7. `LandingTrustBento` component (+ tests)
8. `LandingClosingCtaBento` component (+ tests)
9. Wire `BentoAuthLayout` into `/signup` (+ existing test updates)
10. Extend `/signup` action to set `bento=1` cookie (+ server test)
11. Wire `BentoAuthLayout` into `/login` + passkey-first promotion (+ test updates)
12. Wire `OnboardingForm` into `/child/new` (+ test updates)
13. Extend `/child/new` action to create invitation when `coparentEmail` provided (+ server test)
14. Wire bento landing components into `/+page.svelte` (+ test updates for SEO presence)
15. Restyle `/cgu` (+ snapshot test if any)
16. Restyle `/mentions-legales`
17. Restyle `/politique-confidentialite`
18. Restyle `/cookies`
19. Wire `BentoOptInBanner` into legacy `/child/[id]/+page.svelte` + add `?/optInBento` action (+ server test)
20. E2E spec — signup flow sets bento cookie and lands on bento Aujourd'hui
21. E2E spec — onboarding-with-coparent-email creates invitation
22. E2E spec — legacy user clicks opt-in banner, switches to bento

## Testing & accessibility

### Unit/component (vitest, 100% coverage gate enforced)

- Every new component: render + key prop variants + dismiss callback for the banner.
- `BentoAuthLayout`: renders gradient backdrop, bento mark, title slot, body slot.
- `OnboardingForm`: optional `coparentEmail` field rendered, submits to the route action.
- `LandingHeroBento`: shows signed-out CTAs OR signed-in continue CTA based on `child` prop.

### Server tests

- `/signup` action: cookie is set after successful account creation.
- `/child/new` action: with `coparentEmail`, calls `createInvitation`; without, skips it; with invalid email, surfaces validation error; with rate-limit, child still created.
- `/child/[id]?/optInBento` action: requires membership, sets cookie, 303 redirects.

### E2E (Playwright, mobile viewport pinned 414×896)

- Signup → onboarding → Aujourd'hui — bento chrome is visible (FAB, BottomNavBento). Verifies the cookie path works end-to-end.
- Onboarding with coparent email — child created AND invitation row exists in DB. Toast on Aujourd'hui.
- Legacy user → opt-in banner → bento — set `bento=0` cookie explicitly, sign in, see banner, click CTA, see bento chrome.

### Accessibility

- `BentoAuthLayout`: focus trapped inside the auth card (or, since there's no overlay, just ensure tab order is sensible).
- Passkey button is keyboard-reachable; on login when promoted, it's the first focusable in the form.
- `BentoOptInBanner` dismiss button has a real `<button aria-label="Fermer le panneau">`.
- Landing hero has `<h1>` (one per page), JSON-LD structured data preserved verbatim.
- Legal pages: keyboard-reachable nav, semantic heading order.
- Reduced motion: no new motion introduced beyond the existing bento tokens.

### Visual regression

New baselines at 375px phone + 768px tablet, light + dark mode:

- `/` (landing, signed-out)
- `/signup` (empty state)
- `/login` (passkey-first variant)
- `/child/new` (empty state)
- `/cgu` (smoke test for restyle)

### Existing tests

The 200+ unit/component tests stay green. Signup, login, and account tests need minor updates because the form layout changes — but server actions, zod schemas, and DB behavior are unchanged.

## Open questions

All resolved during brainstorming:

1. **Allow-list deprecation?** Kept as internal escape hatch. Phase 7 reassesses.
2. **`bento=0` cookie set manually?** `bentoEnabled` already returns false; user stays on legacy until they remove it or hit the opt-in banner.
3. **Invitation rate limit during onboarding?** Non-fatal — child is still created, toast surfaced via `?invite=ratelimited`.
4. **Dismiss persistence for opt-in banner?** Client-side cookie, 365-day max-age. No server tracking.
5. **Landing for signed-in users?** Existing "Continuer avec {childName}" logic preserved.

No remaining ambiguity. Ready for implementation plan.

# Bento UI/UX Redesign ("Joyful Bento") — Design

**Date:** 2026-05-10
**Status:** Approved (pending implementation plan)
**Owner:** Simon Brunou

## Goal

Replace the current visual system and information architecture with a coherent, joyful, mobile-first design built on the **bento** metaphor: a celebratory pastel palette (peach / butter / mint / sky / lilac) over a warm cream canvas, with sage as the brand primary. The existing custom-styled bits-ui primitives are replaced by official **shadcn-svelte** components, restyled with the new tokens. Information architecture collapses from 9 per-child screens into a 4-tab shell (`Aujourd'hui · Carnet · Découvrir · Profil`) with a center floating-action button (FAB) that opens a bottom Sheet for logging from anywhere.

The redesign is shipped in seven phases behind a per-user feature flag so the app stays usable on every commit. Loaders, server actions, schema, i18n keys, SEO/JSON-LD, observability, RGPD flows, and the offline log queue are not in scope and do not change.

The design language is **cheer everywhere**: the same bento palette and typography apply to celebratory contexts ("47 aliments · streak 12 j") and tense contexts (reaction logging, allergen warnings, RGPD pages). Reassurance flows through warmth, not through clinical austerity. A coral accent (`#ff8a6b`) is reserved exclusively for the genuine "appeler le 15" rail on severe-reaction screens.

## Non-goals

- **Database schema changes.** No new tables, no column renames, no migrations. The redesign is presentational + IA.
- **Server actions or load functions.** All `+page.server.ts` and `+server.ts` files keep their current contracts. Existing tests in `src/routes/**/*.test.ts` stay green.
- **Drizzle / better-sqlite3 / pg / argon2id / WebAuthn pipeline.** Untouched.
- **PWA offline log queue (IndexedDB) or its replay flow.** No changes to `concept_offline_queue_idb`, `with_idempotency_key`, or `log_action_transaction`.
- **Sentry / observability / PII scrub pipeline.** Untouched.
- **i18n message keys or paraglide setup.** New strings get added under `chrome.*` and existing screen-specific namespaces; no rename of existing keys.
- **Legal copy.** `cgu`, `mentions-legales`, `politique-confidentialite`, `cookies` keep their text verbatim. Only the surrounding shell and typography change.
- **`src/lib/content/guidance.ts`, `src/lib/content/sources.ts`, allergens vocabulary, reactions vocabulary.** Pediatric expert content is reused as-is.
- **SEO / JSON-LD generators.** Untouched. New OG image is regenerated from the new brand mark; everything else stays.
- **Analytics, GA, telemetry.** None added. The app remains telemetry-free aside from Sentry's scrubbed error reporting.
- **A custom design-system package.** shadcn-svelte's "your code, you own it" model is sufficient — primitives live in `src/lib/components/ui/` as today.

## Brand & visual identity

### Palette

| Token role              | Hex       | Use                                                                             |
| ----------------------- | --------- | ------------------------------------------------------------------------------- |
| **Primary · sage**      | `#6b8e6b` | FAB, primary CTAs, brand mark, focus ring. **Carried over** from current brand. |
| **Canvas · cream**      | `#fdfaf3` | App background.                                                                 |
| **Surface**             | `#ffffff` | Cards, sheets.                                                                  |
| **Surface-2 · warm-50** | `#f6efdc` | Elevated tiles, segmented-control track.                                        |
| **Ink**                 | `#1a1a1a` | Primary text.                                                                   |
| **Ink-soft**            | `#525252` | Captions, meta.                                                                 |
| **Border · warm-200**   | `#ece5d4` | Hairlines.                                                                      |
| **Tile · peach-200**    | `#ffd9c0` | "Essayer / new food", today's prompt, signup gradient.                          |
| **Tile · butter-200**   | `#ffeeb0` | Streaks, milestones, the warmer reminder strip.                                 |
| **Tile · mint-200**     | `#c8e6d3` | Success, "RAS" reaction, foods-tried count.                                     |
| **Tile · sky-200**      | `#c5dfff` | Info, allergens snapshot.                                                       |
| **Tile · lilac-200**    | `#e0d5ff` | Discover/suggestions.                                                           |
| **Severe · coral**      | `#ff8a6b` | Reserved exclusively for "appeler le 15" severe-reaction rail.                  |

Each `--tile-*` has a paired `--tile-*-fg` for matching text on that tile, sized for WCAG AA at 14px+.

The reaction scale stays inside the warm palette — there is no alarm-bell red on routine reactions:

- `RAS` → mint (`#c8e6d3` / fg `#1f4a2e`)
- `inconfort` → butter (`#ffeeb0` / fg `#6b4a0a`)
- `réaction` → soft peach (`#ffcfb8` / fg `#6b2e0a`)
- **severe** → coral (`#ff8a6b` / fg white) — only when the user explicitly escalates

### Typography

Both font families are already shipped via `@fontsource-variable/inter` and `@fontsource-variable/fraunces` — no new font dependencies.

| Style       | Family                    | Size / weight / tracking                            | Use                                                                                 |
| ----------- | ------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------- |
| **Display** | Fraunces Variable, italic | 32 / 38, weight 500, `letter-spacing: -0.02em`      | Hero prompts ("Et si on goûtait la _poire_ ?"), screen titles on emotional moments. |
| **Heading** | Inter Variable            | 22 / 28, weight 700, `letter-spacing: -0.015em`     | Section headings ("Cette semaine").                                                 |
| **Body**    | Inter Variable            | 14 / 21, weight 400                                 | Default body.                                                                       |
| **Numeric** | Inter Variable            | 26–28, weight 800, `font-feature-settings: 'tnum'`  | Stats ("47", "12 j"), counters. Tabular nums prevent jitter.                        |
| **Caption** | Inter Variable            | 11, weight 600, `letter-spacing: 0.08em`, uppercase | Labels above tiles, section captions.                                               |

Italic Fraunces is the brand's emotional register; outside hero prompts, prefer regular Fraunces or fall back to Inter.

### Brand mark

Direction: **abstract bento mark** — a square with rounded corners, split diagonally into sage and peach halves. No food metaphor; no leaf. Used as:

- Favicon (SVG → 16/32/48 PNG fallback)
- PWA icon 192/512 (peach gradient background, mark centered)
- OG image (kept square for embeds; current OG is regenerated to use the new mark and palette)
- App-shell brand pill (mark + "diversif" wordmark in Fraunces 16/500)

Existing brand assets in `static/` (`favicon.svg`, `icon-192.png`, `icon-512.png`, `og-image.svg`) are regenerated. The current sage `#6b8e6b` carries over so the brand stays recognisable to existing users.

## Design tokens

All tokens live in `src/app.css` as CSS variables and are referenced by Tailwind classes through `tailwind.config.ts`. Components never reference hex.

### Color tokens (light)

```css
:root {
  --canvas: 39 67% 97%; /* #fdfaf3 */
  --surface: 0 0% 100%;
  --surface-2: 39 50% 91%; /* warm-50 */
  --ink: 0 0% 10%;
  --ink-soft: 0 0% 32%;
  --border: 39 36% 88%; /* warm-200 */

  --primary: 120 14% 49%; /* sage #6b8e6b */
  --primary-fg: 0 0% 100%;

  --tile-peach: 27 100% 87%; /* #ffd9c0 */
  --tile-peach-fg: 23 88% 22%;
  --tile-butter: 47 100% 84%;
  --tile-butter-fg: 38 88% 23%;
  --tile-mint: 142 35% 84%;
  --tile-mint-fg: 142 41% 21%;
  --tile-sky: 213 100% 89%;
  --tile-sky-fg: 218 62% 26%;
  --tile-lilac: 257 100% 92%;
  --tile-lilac-fg: 261 56% 27%;

  --severe: 14 100% 71%; /* coral */
  --severe-fg: 0 0% 100%;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-tile: 18px;
  --radius-hero: 24px;

  --space-tile: 0.75rem; /* 12px — canonical bento gutter */

  --shadow-sm: 0 1px 2px hsl(28 30% 20% / 0.06);
  --shadow-card: 0 6px 14px -2px hsl(28 30% 20% / 0.1), 0 2px 4px -1px hsl(28 30% 20% / 0.05);
  --shadow-soft: 0 8px 24px -8px hsl(28 50% 30% / 0.18);
  --shadow-lifted: 0 18px 36px -10px hsl(28 50% 30% / 0.22);
  --shadow-glow: 0 0 0 4px hsl(47 100% 84%), 0 8px 20px -4px hsl(40 90% 50% / 0.4);

  --ease-soft: cubic-bezier(0.32, 0.72, 0, 1);
  --ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1);
  --ease-celebrate: cubic-bezier(0.16, 1.6, 0.3, 1);
  --dur-fast: 120ms;
  --dur-base: 200ms;
  --dur-slow: 360ms;
  --dur-celebrate: 720ms;
}
```

### Color tokens (dark)

`.dark` flips each `tile-200 → tile-900` and the matching `-fg` from `900 → 200`. Component code is unchanged.

```css
.dark {
  --canvas: 38 13% 8%; /* #15130f */
  --surface: 38 12% 11%;
  --surface-2: 38 13% 14%;
  --ink: 39 67% 91%; /* warm cream */
  --ink-soft: 39 20% 65%;
  --border: 38 10% 18%;

  --primary: 120 14% 49%; /* sage stays */
  --primary-fg: 0 0% 100%;

  --tile-peach: 23 60% 18%;
  --tile-peach-fg: 27 100% 87%;
  --tile-butter: 38 70% 19%;
  --tile-butter-fg: 47 100% 84%;
  --tile-mint: 142 31% 17%;
  --tile-mint-fg: 142 35% 84%;
  --tile-sky: 218 50% 20%;
  --tile-sky-fg: 213 100% 89%;
  --tile-lilac: 261 40% 22%;
  --tile-lilac-fg: 257 100% 92%;

  --severe: 14 100% 71%;
  --severe-fg: 0 0% 100%;
}
```

### Glow shadow

`--shadow-glow` is reserved for **celebratory moments only** (milestone unlock, 100ᵉ aliment, "all 14 priority allergens cleared"). Not used on routine state changes.

`shadow-glow` and `dur-celebrate` always trigger together.

### Motion

- `--ease-soft` is the default UI motion (focus ring, button press, hover).
- `--ease-spring` is for tile hovers, sheet openings, and FAB press. Adds the bento's playful overshoot.
- `--ease-celebrate` is rare; only milestone moments paired with `--shadow-glow` and `--dur-celebrate`.
- All motion respects `prefers-reduced-motion`. The reduced variant collapses each duration to `1ms` and replaces eases with `linear`. Implemented in a single `@media (prefers-reduced-motion: reduce)` block in `app.css`.

## Component primitives (shadcn-svelte)

`shadcn-svelte` is adopted via its CLI. Generated components live in `src/lib/components/ui/` (matching the current path) and are committed to the repo per shadcn convention. They are bits-ui under the hood, so existing dialog/select tests stay valid after token rename.

### Replace (regenerate from CLI, restyled with bento tokens)

`Button`, `Card`, `Badge`, `Input`, `Label`, `Dialog`, `Select`, `Textarea`.

### Add (new primitives)

`Sheet`, `Drawer` (mobile), `Tabs`, `Toast` (Sonner), `Tooltip`, `Popover`, `Switch`, `Checkbox`, `Progress`, `Avatar`, `Separator`, `Skeleton`, `ScrollArea`, `Command` (food search palette).

### Keep (bespoke domain components)

These already encode app-specific logic and stay in `src/lib/components/`, restyled to the new tokens:

- `FoodCombobox` — refactored to wrap the new `Command` primitive but keep its current data-loading shape.
- `ReactionPicker`, `ReactionBadge` — restyled, same API.
- `StageBadge`, `CategoryTag`, `AllergenProgress`, `DiversityCard`, `TipCard`, `EmptyState`, `QueueBadge`, `WelcomeDialog`, `InstallPrompt`, `LocaleSwitcher`, `ThemeToggle`, `LegalLinks`, `JsonLd`, `Seo`, `SourceCitation`, `GuideStaticSections`, `ReminderBanner`, `AllergenInfoDialog`.

### Replace with new shell

- `AppShell` → rewritten as the 4-tab + FAB shell with desktop left-rail variant.
- `BottomNav` → rewritten as the new tabbar with FAB cutout. Old version deleted in phase 7.
- `PublicHeader`, `PublicFooter` → restyled as the bento-friendly auth/legal shell.

## Information architecture

### 4-tab shell

The per-child app collapses from 9 routes to 4 tabs. Existing routes are retained for deep-linking and SEO; the new tabs reorganise them:

```
Tab 1 · Aujourd'hui  (peach neighbourhood)
  /child/[id]                         — overview / today
  Lives inside: greeting, today's prompt, stat tiles, allergens snapshot,
                recent feed, reaction follow-up reminders.

Tab 2 · Carnet       (mint neighbourhood)
  /child/[id]/foods                   — segmented: Tous · Catégories · Allergènes · Stats
  /child/[id]/allergens               — folded under "Allergènes" segment
  /child/[id]/analytics               — folded under "Stats" segment

Tab 3 · Découvrir    (lilac neighbourhood)
  /child/[id]/guide                   — stages bento (4 tiles: 4–6m / 6–9m / 9–12m / 12m+)
  /child/[id]/suggestions             — lilac suggestion feed
  /sources                            — sources cluster (existing renderer reused)
  Tip cards rotate on this tab.

Tab 4 · Profil       (sky neighbourhood)
  /account                            — child(ren), passkeys, theme, language, reminders
  /account/export, /account/deleted   — RGPD rows with peach/butter highlight
  /passkeys/*                         — keys management
  /cgu, /mentions-legales,
  /politique-confidentialite,
  /cookies                            — legal links footer
```

The deprecated direct routes (`/child/[id]/foods`, `/allergens`, etc.) are kept as URLs and redirect via SvelteKit's `+page.server.ts` `redirect(303, …)` to the corresponding tab. Existing canonical URLs in sitemap.xml stay valid.

### Center FAB

A 60×60 sage circle sits over the tab bar. Tap from any tab opens a `Sheet` containing the log flow (see "Log sheet" below). The FAB has a 4px cream halo so it visually punches through the tab bar.

### Multi-child header

Above every tab's content, a child-pill row:

```
[ avatar ] Léo                    changer ▾
           6 mois · J+184 · depuis 3 mois
```

Tap → opens a `Drawer` listing all the user's children plus an "Ajouter un enfant" entry. For families with one child, this reads as a header decoration; for families with two or more, it's a fast switcher. Selected child persists in a session cookie (existing `currentChildId` mechanism is reused).

### Desktop variant (≥ 1024px)

The bottom tab bar is replaced by a 220-px left rail (brand pill on top, four nav rows, child pill at bottom). The FAB becomes a sage `+ Logger` pill in the top-right of the stage. Same primitives, different composition.

### Wide desktop variant (≥ 1440px)

Carnet and Découvrir get an optional right pane (food/suggestion detail) so list and detail show together. List items become selectable; the right pane slides in. Phone behaviour is unchanged.

## Key screens

### Aujourd'hui (home)

The screen ~80% of opens land on. Layout (top to bottom on phone):

1. **Multi-child header pill** (avatar + name + age, "changer ▾").
2. **Reminder strip** — shown only when a recent food is in the 48-hour observation window. Butter background, dot indicator, link to reaction log.
3. **Hero tile** — peach, full-width, 16:9-ish. Today's prompt: "Et si on goûtait la poire ?" + stage hint + glyph. Tap → log sheet pre-filled with the suggested food.
4. **Stat tiles row** — `Aliments` (mint, count + delta) and `Streak` (butter, days + record indicator).
5. **Allergens snapshot tile** — sky, full-width. Pills for each priority allergen with `ok` / `à essayer` state. Tap → Carnet/Allergènes segment.
6. **Recent feed** — last 3-5 logs as white feed-item cards inside a section labeled "Cette semaine". Each row: category icon (coloured background), food name + meta, `RAS` pill.

Empty state (new account): hero tile becomes "Bienvenue Simon. Commencez par enregistrer un premier aliment." with sage `+ Logger` CTA. No fake stats.

### Log sheet (FAB)

Bottom Sheet, ~80% screen height, white surface on a cream→ink gradient backdrop. Layout:

1. Drag grabber.
2. Title `Que mange Léo ?` (Fraunces italic).
3. Search input — wraps `Command` primitive. Pre-fills with today's suggested food when opened from the hero tile.
4. Category chip row — `tout` (active) / `fruits` / `légumes` / `protéines` / `féculents` / `produits laitiers`. Active chip uses peach.
5. **Récents** label + 2×2 quick-card grid — recently logged or "à essayer" foods with their last-eaten meta or status badge.
6. **Réaction** label + 3-button row — `RAS` (mint, pre-selected) / `inconfort` / `réaction`. Caption: "Pré-rempli sur RAS — modifiez si nécessaire."
7. Sticky sage CTA at bottom: "Enregistrer · {food} · {reaction}". Disabled until a food is selected.

Happy path is two taps: pick food → save. The existing `+page.server.ts` log action under `/child/[id]/log` is reused unchanged; the form just submits from the Sheet instead of a dedicated route. Offline queue (`offline-log-queue`) wraps the submit identically.

### Carnet

Top: page title + "47 aliments · 12 catégories" sub. Then a segmented control with four segments:

- **Tous** — category-pill filter row + 2-column food-card grid. Each food-card: glyph, name, meta ("vapeur · 6× · RAS"), corner status badge ("RAS" / "à essayer" / "priorité"). Untried foods are dashed for invitation.
- **Catégories** — accordion of categories, each expanding into a horizontal scroll of food-cards.
- **Allergènes** — the priority-14 allergens dashboard. One card per allergen: status (cleared / à essayer / réaction observée), times tried, last tried, link to the LEAP/EAT guidance for that allergen. The existing `AllergenProgress` component is the basis.
- **Stats** — the existing `DiversityCard` content restyled into bento tiles (diversity score, by-category bar, weekly cadence chart).

### Découvrir

Three sections, no segmented control (scroll-only, tip-card rotates):

1. **Stages bento** — 2×2 of 4–6m / 6–9m / 9–12m / 12m+. Active stage based on child age has a sage glow. Tap → existing `/child/[id]/guide` content rendered inside a Sheet.
2. **Suggestions du jour** — vertical lilac feed. Each card: food + reason ("priorité allergène", "diversifie ta journée", "pas essayé depuis 2 semaines"). Tap → log sheet pre-filled.
3. **Tips rotatifs** — one butter `TipCard` per day, dismissible. Existing `tip_dismissals` table powers it.
4. **Sources scientifiques** — sky tile cluster with LEAP / EAT / ESPGHAN / ANSES / HCSP entries. Tap → existing `/sources` page renderer (kept verbatim, restyled wrapper).

### Profil

Top: page title. Then:

1. **Child cards** — one row per child with avatar, name, age. Tap → child settings drawer. Plus a dashed "+ Ajouter un enfant" row.
2. **Co-parents** section — list of co-parents + "Inviter un co-parent" row that opens the existing invitation flow.
3. **Compte** section — Passkeys (with device count), Langue (FR/EN), Thème (auto/light/dark), Rappels (notifications, reminder cadence).
4. **Vos données (RGPD)** section — peach-highlighted "Exporter mes données" row + butter-highlighted "Supprimer mon compte" row. Both are visible, not hidden, per the cheer-everywhere posture.
5. **Légal** footer links — CGU, Mentions légales, Politique de confidentialité, Cookies. Sage text links.

### Reaction detail (cheer-everywhere stress test)

Opened from a food-card with a non-RAS reaction or from a 48-hour follow-up reminder.

1. Back link → Carnet.
2. Title: "Réaction · {food}". Sub: "{date} · {time} · {nth} exposition".
3. **Reassurance hero** (peach, italic Fraunces): "On vous accompagne. Notez ce que vous observez — vous pourrez tout exporter pour le pédiatre."
4. **Symptômes observés** — chronological list of symptom rows. Default neutral white; severity-tagged ones are butter (warn) or coral (severe). "+ ajouter un symptôme" row.
5. **Stay-cool card** (mint): "Respirez. Une réaction localisée se résout souvent seule. Surveillez 30 min." + link "Voir le guide réactions →".
6. **Severe rail** (coral, white text): "Difficulté à respirer / lèvres bleues ? Appelez le 15 immédiatement." Always rendered, always visible, always last in the symptom group.
7. **Primary CTA** (sage): "Suivre 30 min · activer un timer".
8. **Secondary CTA** (white outlined): "Exporter pour le pédiatre" — generates a printable PDF/HTML of the symptom log.

### Auth — signup (first impression)

A new visitor's first screen. Warm peach→butter→cream gradient covers the full viewport. White auth card centered, with:

1. Bento mark (44×44 rounded square, sage/peach split).
2. Fraunces title: "Bienvenue".
3. Sub: "Diversifiez en confiance, à votre rythme."
4. Email input + password input (both pill-rounded, cream background).
5. Sage `Créer mon compte` CTA.
6. "ou" divider.
7. Dashed sage outline `🔑 Continuer avec une passkey` button — passkey-first because it's faster, safer, and aligns with brand calm.
8. "J'ai déjà un compte · Se connecter" link.

The `/login` screen mirrors this with the email/password order kept and the passkey option as the primary recommended action when the user has registered keys (existing `passkey-discovery` flow is reused).

## Responsive strategy

| Breakpoint           | Layout                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `< 768px` (phone)    | Bottom tab bar (4 tabs + center FAB cutout). Bento 2 columns. Sheets full-width.                                   |
| `≥ 768px` (tablet)   | Same shell as phone. Bento 3 columns. Sheets max 520px centered. Container padding bumps to 24px.                  |
| `≥ 1024px` (desktop) | 220-px left rail replaces tab bar. FAB becomes top-right `+ Logger` pill. Stage max-width 1100px, bento 3-up grid. |
| `≥ 1440px` (wide)    | Carnet/Découvrir gain an optional right detail pane (450px). List items become selectable; detail slides in.       |

The transitions between layouts are CSS-only — same components, same routes, no JS branching.

## Dark mode strategy

`prefers-color-scheme: dark` triggers the `.dark` class on `<html>` via the existing `theme-init.js` and `ThemeToggle` (kept). Token values flip per the table above; component code is unchanged.

Tile pastels become deep tints: `tile-peach-200 → tile-peach-900` (≈ `#4a2814`), with `-fg` flipping the other way. The bento personality holds at night without becoming alarming.

The current dark-mode tests pass after token rename. New screen-level visual-regression baselines are captured in dark mode in phase 4.

## PII / privacy posture (unchanged)

- No new third parties, no telemetry, no remote font CDNs (fonts ship via `@fontsource-variable/*`).
- shadcn-svelte components are local code — no runtime dependencies beyond `bits-ui` (already installed).
- The privacy policy doesn't need updating. The existing `tip_dismissals` and `currentChildId` cookie mechanisms continue unchanged.
- OG image and favicon are static assets served from `static/` — no embedded user data.

## Components — impact table

| File                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Status     | Responsibility                                                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app.css`                                                                                                                                                                                                                                                                                                                                                                                                                                                 | edit       | Rewrite all CSS variables for new tokens (light + dark).                                                                                                                                                                                                                                                                                                                                |
| `tailwind.config.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                          | edit       | Add tile color tokens, radius scale (`tile`, `hero`), shadow scale (`soft`, `lifted`, `glow`), motion easings/durations.                                                                                                                                                                                                                                                                |
| `static/favicon.svg`                                                                                                                                                                                                                                                                                                                                                                                                                                          | replace    | New bento mark (sage/peach split).                                                                                                                                                                                                                                                                                                                                                      |
| `static/icon-192.png`, `icon-512.png`                                                                                                                                                                                                                                                                                                                                                                                                                         | replace    | Regenerated PWA icons with new mark on peach gradient.                                                                                                                                                                                                                                                                                                                                  |
| `static/og-image.svg`                                                                                                                                                                                                                                                                                                                                                                                                                                         | replace    | Hero "Diversifiez en confiance" restyled in new palette.                                                                                                                                                                                                                                                                                                                                |
| `src/app.html`                                                                                                                                                                                                                                                                                                                                                                                                                                                | edit       | PWA `theme_color` meta updated to new sage/cream values.                                                                                                                                                                                                                                                                                                                                |
| `src/lib/components/ui/Button.svelte` ... `Textarea.svelte`                                                                                                                                                                                                                                                                                                                                                                                                   | regenerate | shadcn-svelte CLI regenerate; restyle with new tokens.                                                                                                                                                                                                                                                                                                                                  |
| `src/lib/components/ui/Sheet.svelte`, `Drawer.svelte`, `Tabs.svelte`, `Toast.svelte`, `Tooltip.svelte`, `Popover.svelte`, `Switch.svelte`, `Checkbox.svelte`, `Progress.svelte`, `Avatar.svelte`, `Separator.svelte`, `Skeleton.svelte`, `ScrollArea.svelte`, `Command.svelte`                                                                                                                                                                                | new        | Added via shadcn-svelte CLI.                                                                                                                                                                                                                                                                                                                                                            |
| `src/lib/components/AppShell.svelte`                                                                                                                                                                                                                                                                                                                                                                                                                          | rewrite    | New 4-tab + FAB + multi-child header shell with desktop left-rail variant.                                                                                                                                                                                                                                                                                                              |
| `src/lib/components/BottomNav.svelte`                                                                                                                                                                                                                                                                                                                                                                                                                         | rewrite    | New tab bar with FAB cutout. Removed in phase 7.                                                                                                                                                                                                                                                                                                                                        |
| `src/lib/components/PublicHeader.svelte`, `PublicFooter.svelte`                                                                                                                                                                                                                                                                                                                                                                                               | restyle    | Bento-friendly auth/legal shell.                                                                                                                                                                                                                                                                                                                                                        |
| `src/lib/components/FoodCombobox.svelte`                                                                                                                                                                                                                                                                                                                                                                                                                      | refactor   | Wrap new `Command` primitive; keep current data-loading shape and tests.                                                                                                                                                                                                                                                                                                                |
| `src/lib/components/ReactionPicker.svelte`, `ReactionBadge.svelte`, `StageBadge.svelte`, `CategoryTag.svelte`, `AllergenProgress.svelte`, `DiversityCard.svelte`, `TipCard.svelte`, `EmptyState.svelte`, `QueueBadge.svelte`, `WelcomeDialog.svelte`, `InstallPrompt.svelte`, `LocaleSwitcher.svelte`, `ThemeToggle.svelte`, `LegalLinks.svelte`, `ReminderBanner.svelte`, `AllergenInfoDialog.svelte`, `SourceCitation.svelte`, `GuideStaticSections.svelte` | restyle    | Tokens updated; APIs unchanged; existing tests stay green.                                                                                                                                                                                                                                                                                                                              |
| `src/lib/components/JsonLd.svelte`, `Seo.svelte`                                                                                                                                                                                                                                                                                                                                                                                                              | unchanged  | SEO/JSON-LD untouched.                                                                                                                                                                                                                                                                                                                                                                  |
| `src/lib/components/landing/*`                                                                                                                                                                                                                                                                                                                                                                                                                                | rewrite    | Marketing page hero rebuilt around the bento mark + warm gradient.                                                                                                                                                                                                                                                                                                                      |
| `src/routes/+layout.svelte`                                                                                                                                                                                                                                                                                                                                                                                                                                   | edit       | Mount new `AppShell` and `Toaster` provider.                                                                                                                                                                                                                                                                                                                                            |
| `src/routes/child/[id]/+page.svelte`                                                                                                                                                                                                                                                                                                                                                                                                                          | rewrite    | New Aujourd'hui screen.                                                                                                                                                                                                                                                                                                                                                                 |
| `src/routes/child/[id]/foods/+page.svelte`                                                                                                                                                                                                                                                                                                                                                                                                                    | rewrite    | New Carnet screen with 4-segment control; folds in allergens + analytics segments.                                                                                                                                                                                                                                                                                                      |
| `src/routes/child/[id]/allergens/+page.svelte`                                                                                                                                                                                                                                                                                                                                                                                                                | redirect   | `redirect(303, '/child/[id]/foods?segment=allergens')`.                                                                                                                                                                                                                                                                                                                                 |
| `src/routes/child/[id]/analytics/+page.svelte`                                                                                                                                                                                                                                                                                                                                                                                                                | redirect   | `redirect(303, '/child/[id]/foods?segment=stats')`.                                                                                                                                                                                                                                                                                                                                     |
| `src/routes/child/[id]/guide/+page.svelte`, `suggestions/+page.svelte`                                                                                                                                                                                                                                                                                                                                                                                        | rewrite    | New Découvrir screen with stage bento + suggestion feed.                                                                                                                                                                                                                                                                                                                                |
| `src/routes/child/[id]/log/+page.svelte`                                                                                                                                                                                                                                                                                                                                                                                                                      | rewrite    | Logging UI moves to FAB Sheet. The page becomes a redirect to `?log=open` on Aujourd'hui. The form action stays at `/child/[id]/log` and is reused by the Sheet.                                                                                                                                                                                                                        |
| `src/routes/child/[id]/report/+page.svelte`                                                                                                                                                                                                                                                                                                                                                                                                                   | rewrite    | New Reaction-detail screen with peach hero, chronological log, mint stay-cool, coral severe rail.                                                                                                                                                                                                                                                                                       |
| `src/routes/child/[id]/settings/+page.svelte`                                                                                                                                                                                                                                                                                                                                                                                                                 | rewrite    | Folded into Profil. Redirect to `/account?child=[id]`.                                                                                                                                                                                                                                                                                                                                  |
| `src/routes/account/+page.svelte`, `account/export/+page.svelte`, `account/deleted/+page.svelte`                                                                                                                                                                                                                                                                                                                                                              | rewrite    | New Profil screen with child cards + grouped row sections (Co-parents / Compte / RGPD / Légal).                                                                                                                                                                                                                                                                                         |
| `src/routes/login/+page.svelte`, `signup/+page.svelte`                                                                                                                                                                                                                                                                                                                                                                                                        | rewrite    | New auth screens with warm gradient + bento mark + passkey-first flow.                                                                                                                                                                                                                                                                                                                  |
| `src/routes/+page.svelte` (marketing)                                                                                                                                                                                                                                                                                                                                                                                                                         | rewrite    | Marketing landing rebuilt around bento mark + warm gradient + four-feature bento + clear CTA.                                                                                                                                                                                                                                                                                           |
| `src/routes/cgu/+page.svelte`, `mentions-legales/+page.svelte`, `politique-confidentialite/+page.svelte`, `cookies/+page.svelte`                                                                                                                                                                                                                                                                                                                              | restyle    | Bento-friendly typography. Copy unchanged. FR-only banner kept.                                                                                                                                                                                                                                                                                                                         |
| `src/routes/sources/+page.svelte`                                                                                                                                                                                                                                                                                                                                                                                                                             | restyle    | Wrapper restyled into sky tile cluster; existing source-citation rendering kept.                                                                                                                                                                                                                                                                                                        |
| `src/routes/passkeys/*`                                                                                                                                                                                                                                                                                                                                                                                                                                       | restyle    | Tokens updated; existing passkey flows unchanged.                                                                                                                                                                                                                                                                                                                                       |
| `messages/fr.json`, `messages/en.json`                                                                                                                                                                                                                                                                                                                                                                                                                        | edit       | Add `chrome.tabs.aujourdhui`, `chrome.tabs.carnet`, `chrome.tabs.decouvrir`, `chrome.tabs.profil`, `chrome.fab.log`, `aujourdhui.greeting`, `aujourdhui.followup`, `aujourdhui.hero.{prompt,suggested}`, `carnet.segment.{tous,categories,allergenes,stats}`, `react.hero.support`, `react.staycool`, `react.severe.title`, `signup.welcome.{title,sub}`, etc. Existing keys unchanged. |
| `src/lib/feature-flags.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                    | new        | Tiny flag table that controls `bento_redesign_enabled` per user. Defaults: off for existing users until phase 6 flip; on for new signups from phase 6.                                                                                                                                                                                                                                  |
| `e2e/*.spec.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                               | edit       | Update navigation selectors to the new tab bar. Most flows (signup, log, reaction, account export) exercise unchanged form actions.                                                                                                                                                                                                                                                     |

## Migration plan (seven phases, every commit shippable)

Each phase ends with green CI, a refreshed visual-regression baseline (Playwright `expect.toHaveScreenshot()` on key routes), and an axe-core a11y check.

### Phase 1 — Foundation: tokens, fonts, gitignored brand assets (~½ day)

Rewrite `src/app.css` CSS variables (light + dark). Update `tailwind.config.ts` with tile colors, radius scale, shadow scale, motion tokens. Re-export favicon, OG image, PWA icons from the new bento mark. Update PWA `theme_color` and `app.html` meta.

No screen visually changes yet — every component still uses old class names, but the new tokens pre-load.

**Ship gate:** visual-diff ≈ zero (tokens read same on existing components). Lint + tests green.

### Phase 2 — Primitive layer (~1 day)

Run shadcn-svelte CLI to regenerate the 8 existing primitives. Add the 14 new ones. Wire bento tokens into each.

Existing `Button.test.ts`, `Card.test.ts`, etc. stay green (selectors unchanged). New primitive tests added for Sheet / Tabs / Toast.

**Ship gate:** Components look slightly fresher (tile colors, new radius); behaviour identical. RTL tests pass.

### Phase 3 — App shell + log Sheet (~2–3 days)

Rewrite `AppShell.svelte` and `BottomNav.svelte` for the 4-tab + FAB pattern with multi-child header pill and desktop left-rail variant. Build the log Sheet that the FAB opens (uses `Command` + existing `ReactionPicker`). Wire legacy routes to redirect.

Add `feature-flags.ts` with `bento_redesign_enabled`. Toggle the AppShell variant on this flag — old shell stays for everyone else.

**Ship gate:** Behind feature flag for the owner only. Visual-regression baseline captured for the new shell.

### Phase 4 — Aujourd'hui + Carnet (~2–3 days)

Build bento Aujourd'hui screen wired to existing `+page.server.ts` loader (greeting, suggestion, streak, foods count, allergens snapshot, recent feed, reminders). Build Carnet with 4-segment control and food-card grid. `AllergenProgress` and `DiversityCard` restyled. Folded routes redirect.

**Ship gate:** Behind feature flag, opened to a small group of trusted co-parents. Visual-regression baselines for both screens (light + dark).

### Phase 5 — Découvrir + Profil + Reaction detail (~2 days)

Découvrir tabs (stages bento + suggestion feed + tips + sources). Profil (children + co-parents + account + RGPD + légal). Reaction-detail with calm hero + symptom log + coral severe rail + sage CTAs.

**Ship gate:** Behind feature flag for trusted group. Reaction-detail screen reviewed by the owner against past audit findings (allergens vocabulary, severity copy).

### Phase 6 — Auth + onboarding + landing + legal pages (~1–2 days)

New signup/login with warm gradient + bento mark + passkey-first. Onboarding flow (first-child setup, age, optional co-parent invite). Marketing landing page. Legal pages restyled (copy unchanged). FR-only banners kept. SEO/JSON-LD untouched.

**Ship gate:** Feature flag flipped to default-on for new signups. Existing users see an opt-in banner ("Essayer le nouveau design ✨") on Aujourd'hui.

### Phase 7 — Cleanup & flag removal (~½ day)

After ~2 weeks of dual-mode in production:

- Flip flag default-on for everyone.
- Remove legacy `BottomNav` v1, legacy `AppShell` v1, legacy route bodies that redirected.
- Delete `feature-flags.ts` (or scope it down to non-redesign flags only).
- Run `graphify update .` to refresh the codebase map.
- Update README screenshots.
- Final visual-regression sweep + a11y audit (axe-core) + Lighthouse mobile.

**Ship gate:** Tag release `v1.0` — "the redesign".

**Total: ~9–12 days of focused work, shippable at every phase.**

## Testing & accessibility

### Visual regression

Playwright + `expect.toHaveScreenshot()` on the eight key routes (`/`, `/child/[id]`, `/child/[id]/foods`, `/child/[id]/foods?segment=allergens`, `/child/[id]/guide`, `/account`, `/login`, `/signup`) at three breakpoints (`375px` phone, `768px` tablet, `1280px` desktop) in both light and dark mode. Baseline updated screen-by-screen as each phase lands.

### A11y

- axe-core run via Playwright on every key route. Target: zero serious or critical violations.
- Manual focus-trap audit on Sheet, Drawer, Dialog, Tabs.
- Tap targets ≥ 44×44 on phone (FAB is 60×60; tab bar items ≥ 56×56).
- Reaction-detail "appeler le 15" rail must be reachable by keyboard within 3 tabs from page load (it's announced as `role="alert"` for severe escalations).
- Color contrast: every `--tile-*` / `--tile-*-fg` pair verified for WCAG AA at 14px+.
- `prefers-reduced-motion` honored: all eases collapse to `linear`, all durations to `1ms`, including FAB/sheet/celebrate animations.

### Existing tests

The ~200+ existing unit + integration tests stay green throughout. Phase 1 changes only token names; phases 2–5 keep public APIs of primitives and components stable. Test fixtures (`resetTestDb`, `seedChild`, etc.) and Drizzle schema are not touched.

E2E spec selectors are updated in each relevant phase to match the new shell (`role="navigation"` on the tab bar, `data-testid="fab-log"` on the FAB).

### Performance

Lighthouse mobile target after phase 7: ≥ 90 on Performance, ≥ 95 on Accessibility, ≥ 95 on Best Practices, ≥ 95 on SEO. The new fonts (Fraunces variable in addition to Inter variable) add ~50 KB compressed; both are subset to Latin + Latin-Extended-A so French diacritics ship without the full file.

## Open questions

None remaining as of approval — all four design sections were approved without amendments. Sub-decisions captured during implementation (e.g. exact wording of "Suivre 30 min · activer un timer", precise per-stage image illustrations, animation details on milestone celebrations) are deferred to the implementation plan.

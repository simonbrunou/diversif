# PRODUCT.md — Diversif

<!-- impeccable:product-schema 1 -->

**Register:** `product`

> The interface SERVES the product (an app UI, not a marketing surface). Design quality is in service of helping parents do a recurring, sometimes-anxious task with confidence.

---

## What this is

Diversif is a self-hosted web app for tracking a baby's food diversification (introducing solids between ~4–12 months), with co-parent sharing. Single-Docker, French-default UI with an `/en/` locale variant. Offline-first PWA — the log queue replays when the parent comes back online.

Built by Simon Brunou as a personal-but-public side project, deployable in one container, telemetry-free aside from strict-PII-scrubbed Sentry error reporting. No analytics. No tracking. Pediatric expert content (LEAP, EAT, ESPGHAN, ANSES, HCSP) is reused as-is from peer-reviewed sources; the app does not author medical opinions.

---

## Platform

web

---

## Positioning

**Curated and source-cited, never generated.** Every age window, allergen instruction and reassurance line on screen traces to a named peer-reviewed source and is reused as-is. `src/lib/content/sources.ts` holds 16 of them — `leap-2015`, `eat-2016`, `espghan-2017`, `hcsp-2020`, `eaaci-2020`, `anses-nourrisson`, `spf-pnns-guide`, `ascia-2026` and the rest — and every piece of guidance the user sees can be traced back to one via its `SourceId`.

A neighbouring tracker can bolt on a chatbot in a sprint. It cannot truthfully claim that nothing on the screen was generated, so nothing can drift, hallucinate, or quietly change between releases. That is the claim to protect.

The 2026-07 meal-idea carve-out holds to the same rule and is not an exception to it: deterministic, composed only from the curated catalog, framed as _repères_ rather than prescriptions, LLM-free.

---

## Operating Context

- **The logging scene.** One-handed on a phone, baby in the other arm, several times a day. The FAB is centred in the bottom nav for thumb reach; reaction defaults to RAS because that is the overwhelmingly common case.
- **The review scene.** A calm moment a few times a week, often on a larger screen — "did we introduce enough variety?", "have we tried the priority allergens?".
- **The 11pm scene.** Low ambient light, a non-RAS reaction in the feed, a parent who needs reassurance before information. The system-driven dark theme exists for this, not for aesthetics.
- **The cold-open scene.** A co-parent invited by link (`memberships`) opens the app having never seen it, on a child that already has data — so the onboarding dialog never fires for them and the screen has to explain itself.
- **The handoff.** `/child/<id>/report` and the print route exist to be handed to or printed for a pediatrician; they are documents, not dashboards.
- **Deployment.** One Docker container, SQLite on a mounted volume, behind a reverse proxy / Cloudflare Tunnel. The operator is usually also the user.

---

## Capabilities and Constraints

- Food log with reaction (`ras` / `inconfort` / `reaction`), texture, notes, and multi-ingredient meals grouped by a shared `mealId`.
- 12 tracked allergens with derived state (`cleared` / `todo` / `fading` / `inconfort` / `reaction`); priority-introduction set follows LEAP/EAT/ESPGHAN, not EU labelling.
- Deterministic reminder engine (`src/lib/server/guidance/reminders.ts`): pure derivation from the child's data plus dismissals, sorted by severity and capped at 4.
- Offline-first PWA: writes queue in IndexedDB and replay with idempotency keys.
- Auth: WebAuthn passkeys plus `Bun.password` Argon2id. Co-parent sharing by single-use invite code, 7-day expiry.
- RGPD: account deletion and export are both one form away and actually delete the row plus related entries.
- **Terminology is load-bearing.** `aliment` is the catalog item; `repas` is the logged event. The action verb is always _enregistrer_. `Régularité`, never "streak"; `Bilan`, never "stats"; `Adresse e-mail`, never "email".
- Telemetry-free by constraint: no analytics, no third-party fonts, no tracking pixels. Only outbound traffic is Sentry with strict PII scrubbing.
- The app authors no medical opinion. Curation only.

---

## Users

### Primary — the parent of a baby aged 4–12 months

- Often using one-handed on mobile while holding the baby in the other arm.
- Logs a food in ~10 seconds, several times a day.
- Reviews progress at calm moments (a few times a week) to feel reassured: "did we introduce enough variety?", "have we tried priority allergens?".
- May be doing this for their first child (uncertain, anxious) or their third (efficient, low patience for friction).
- Predominantly French — France-based diversification practice differs subtly from US/UK guidelines, so French content is more accurate. EN locale is a courtesy for non-FR-speaking partners or expats.
- Not a developer. Doesn't read anglicisms like "logger" or "streak" as natural French.

### Secondary — the co-parent

- The second parent, a grandparent, a daycare provider — anyone the primary parent explicitly invited (`memberships` table).
- Same UI; differs only in not being able to delete the child or invite others.
- Often less frequent users; needs the app to be self-explanatory from a cold open.

### Anti-user — the developer who wants a "feature-rich tracker"

The app is deliberately small. We don't ship dashboards, gamification mechanics, social feeds, or AI-generated meal plans. If a parent's question is "is this normal?" the answer is a calm copy of the relevant pediatric guidance, not a chatbot.

> **Carve-out (2026-07):** A _deterministic, source-cited daily meal-idea surface_ —
> composed only from the curated catalog, framed as _repères_ not prescriptions, LLM-free and
> telemetry-free — is an accepted extension of `/suggestions`, distinct from the rejected
> "AI-generated meal plans" (which meant non-deterministic, cloud, authored-content plans).

---

## Tone & voice

- **Warm, calm, plain-spoken French.** Never clinical, never alarming. The same voice covers celebratory contexts (a new food, a streak) and tense ones (a non-RAS reaction, the RGPD account deletion flow).
- **Reassurance over urgency.** Even in tense flows, the first message is "we'll walk you through it" before "this is serious".
- **No anglicisms in FR.** "Enregistrer" (not "logger"), "Régularité" (not "Streak"), "Adresse e-mail" (not "Email"), "Bilan" (not "Stats"). The codebase enforces this; PR reviewers reject anglicism regressions.
- **Honest, not breezy.** We don't say "amazing!" or "you're crushing it!". A streak is just a number; the user decides what it means.
- **One sentence at a time.** No multi-paragraph captions, no helpful-bot explanations.

---

## Brand & visual identity

### Visual register: "joyful bento"

A celebratory pastel palette (peach / butter / mint / sky / lilac) over a warm cream canvas. **Sage** (`#6b8e6b`) is the brand primary — carried over from the previous brand so existing users recognise it. The design avoids the two reflexive answers a tracker-of-a-medical-thing usually gets:

1. **NOT clinical / hospital portal.** No navy + white + teal, no Helvetica, no "professional and clinical" — that visual register is for institutional medical software, and a parent at 11pm doesn't want to feel like they're in a hospital.
2. **NOT SaaS-cream productivity.** No Notion/Linear/Stripe palette (warm gray + indigo + screenshot-perfect alignment grids). That's a productivity-tool register; this is a baby-care register.

The bento metaphor: each screen is a tray of small colored compartments. The compartments are warm and inviting; the data inside them is honest.

### Palette tokens

| Role                    | Hex       | Used for                                   |
| ----------------------- | --------- | ------------------------------------------ |
| **Primary · sage**      | `#6b8e6b` | FAB, primary CTAs, brand mark, focus ring  |
| **Canvas · cream**      | `#fdfaf3` | App background                             |
| **Surface**             | `#ffffff` | Cards, sheets                              |
| **Surface-2 · warm-50** | `#f6efdc` | Elevated tiles, segmented-control track    |
| **Ink**                 | `#1a1a1a` | Primary text                               |
| **Ink-soft**            | `#525252` | Captions, meta                             |
| **Border · warm-200**   | `#ece5d4` | Hairlines                                  |
| **Tile · peach-200**    | `#ffd9c0` | New / hero / signup gradient               |
| **Tile · butter-200**   | `#ffeeb0` | Streaks, milestones, reminders             |
| **Tile · mint-200**     | `#c8e6d3` | Success, "RAS" reaction, foods-tried count |
| **Tile · sky-200**      | `#c5dfff` | Info, allergens snapshot                   |
| **Tile · lilac-200**    | `#e0d5ff` | Discover / suggestions                     |
| **Severe · coral**      | `#ff8a6b` | RESERVED — "appeler le 15" rail only       |

Each tile token has a paired `--tile-*-fg` sized for WCAG AA at 14px+.

### Typography

Fraunces Variable (italic) for the emotional / hero register. Inter Variable for everything else. Tabular nums (`'tnum'`) on stat displays so the numbers don't jitter on update.

| Style   | Family          | Size / weight                                    |
| ------- | --------------- | ------------------------------------------------ |
| Display | Fraunces italic | 32 / 38, weight 500, letter-spacing -0.02em      |
| Heading | Inter           | 22 / 28, weight 700, letter-spacing -0.015em     |
| Body    | Inter           | 14 / 21, weight 400                              |
| Numeric | Inter           | 26–28, weight 800, `'tnum'`                      |
| Caption | Inter           | 11, weight 600, letter-spacing 0.08em, uppercase |

---

## Strategic principles

1. **Cheer everywhere.** The bento palette + typography apply uniformly to celebratory and tense contexts. Reassurance flows through warmth, not clinical austerity. No alarm-bell red on routine reactions — `réaction` is a soft peach, not a screaming red. Coral is reserved for the literal "appeler le 15" (France's medical emergency line) rail.
2. **Mobile-first, one-handed.** Every primary tap target is reachable with a parent's thumb. The FAB is centered in the bottom nav for that reason.
3. **Two taps to log.** From any screen, FAB → pick food → done. Reaction defaults to RAS (the overwhelmingly most common case) so the parent doesn't have to think about it.
4. **Offline-first.** A log written offline is queued in IndexedDB and replayed on reconnection with idempotency keys. The UI never punishes a parent for a flaky connection.
5. **Honest empty states.** Fresh accounts see "Bienvenue Léo. Commencez par enregistrer un premier aliment." — not fake stats, not pretend streaks. The data starts when the data starts.
6. **Telemetry-free.** No analytics, no GA, no tracking pixels, no third-party fonts. The only outbound traffic is Sentry error reporting with strict PII scrubbing.
7. **Self-hosted = the user owns their data.** Account deletion (RGPD) is one form away and actually deletes the row + all related entries. Export is a button on the same screen.
8. **Pediatric content is not authored by us.** All allergen guidance, age windows, and clinical-style text comes from cited peer-reviewed sources (LEAP, EAT, ESPGHAN, ANSES, HCSP). We curate; we don't opine.

---

## Evidence on Hand

**Real, citable:** the 16 peer-reviewed sources in `src/lib/content/sources.ts`, surfaced through `SourceCitation` and `/sources`. Every clinical-sounding string in the product is traceable to one of them. The curated food catalog (103 rows seeded, with `suggested_age_months` and `allergen_type`) is likewise real product data.

**Nothing else exists, and future work must not invent it.** There are no user counts, no testimonials, no case studies, no press, no ratings, no "trusted by N parents", no benchmarks. This is not modesty — it is a constraint: the product is telemetry-free by design, so there is no analytics anywhere that could confirm or contradict such a claim. A fabricated number here could never be checked, which is exactly why it must never be written.

Copy may cite guidance. It may not cite popularity.

---

## Accessibility & Inclusion

**WCAG 2.1 AA is binding, not aspirational.** It is enforced in CI, not just intended: `e2e/a11y-axe.spec.ts` runs axe-core with `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa`/`best-practice` across the signed-in surface — empty _and_ populated states — and hard-fails on any violation. `scripts/lint-contrast.ts` computes real WCAG ratios for token pairs in both themes. A change that drops below AA is a defect, not a tradeoff.

**Plus a physical constraint the standard does not cover: one-handed reach.** The primary user is holding a baby. Primary actions stay in the thumb arc, `min-h-11` (44px) is the target floor for anything a parent taps while feeding, and adjacent targets keep real separation. Where a secondary inline chip cannot afford 44px, the floor is WCAG 2.5.8's 24px with ≥8px separation — a deliberate, documented deviation, never an accident.

Dark theme is part of this: it exists because parents feed babies at 3am in low-light rooms. The decision is physical, not aesthetic.

---

## Anti-references

Match-and-refuse. If the design starts to look like any of these, rework.

- **Hospital / clinical portal.** Doctolib-style navy + white + teal. Helvetica. "Please confirm your appointment." That visual register implies the parent should be afraid; we want them confident.
- **SaaS productivity dashboard.** Notion / Linear / Stripe warm-gray + accent-purple + everything-card-grid. That's a tool for office workers; this is a tool for parents at 3am.
- **Alarm-bell medical UI.** Big red banners, exclamation-mark icons on routine reactions, modals that demand acknowledgement. We have ONE coral rail for ONE actual emergency.
- **Gamified "streak shame".** Duolingo streaks lit on fire. We show "régularité" as a fact, never as a guilt trip.
- **AI-generated SaaS template.** Hero metric + supporting stats + gradient accent + identical card grid. The first thing an LLM would produce for a "baby tracker". Reject on sight.
- **Dark mode "because tools look cool dark".** We support a system-driven dark theme because parents do feed babies at 3am in low-light rooms, but the design isn't dark-by-default. The decision is physical (ambient light, time of day), not aesthetic.
- **Gradient text.** `background-clip: text` decorative gradient on titles. Cliché.
- **Glassmorphism as default.** Blurred cards used decoratively. Rare and purposeful, or nothing.

---

## What "good" looks like for this codebase

- A parent opens `/child/<id>` while feeding the baby with one hand. They tap the FAB, type `poire`, tap Poire, tap Enregistrer. The toast appears. They smile and finish the bite. Total: 4 taps, 6 seconds.
- A parent at 11pm sees a non-RAS reaction in the feed. The reaction card is soft peach — not red. The reassurance card next to it says "Surveillez 30 min" calmly. Nothing on the screen makes their pulse spike.
- A first-time co-parent invited via a link opens the app cold and immediately knows where they are. The Aujourd'hui screen is self-explanatory; the Carnet segments make sense without a tutorial.
- The design feels coherent across the welcome dialog, the FAB log sheet, the allergens segment, and the RGPD account-deletion form. Same tokens, same voice, same warmth — even when the topic is "delete my account".

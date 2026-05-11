# PRODUCT.md — Diversif

**Register:** `product`

> The interface SERVES the product (an app UI, not a marketing surface). Design quality is in service of helping parents do a recurring, sometimes-anxious task with confidence.

---

## What this is

Diversif is a self-hosted web app for tracking a baby's food diversification (introducing solids between ~4–12 months), with co-parent sharing. Single-Docker, French-default UI with an `/en/` locale variant. Offline-first PWA — the log queue replays when the parent comes back online.

Built by Simon Brunou as a personal-but-public side project, deployable in one container, telemetry-free aside from strict-PII-scrubbed Sentry error reporting. No analytics. No tracking. Pediatric expert content (LEAP, EAT, ESPGHAN, ANSES, HCSP) is reused as-is from peer-reviewed sources; the app does not author medical opinions.

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

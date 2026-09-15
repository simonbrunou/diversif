---
target: src/routes/child/[id]/+page.svelte
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:/home/sbrn/Projects/diversif/src/routes/child/[id]/+page.svelte"
target_fingerprint: "sha256:25d3eef7b5c33cf087821441797daa93f07e6229a1d29e31c3c26194ff6efc37"
target_path: /home/sbrn/Projects/diversif/src/routes/child/[id]/+page.svelte
timestamp: 2026-09-14T14-29-48Z
slug: src-routes-child-id-page-svelte
---
# Critique — /child/[id] (Aujourd'hui)

Method: dual-agent (A: DesignReviewA `reviewer` · B: EvidenceB `scout`).
B's evidence channel FAILED VERIFICATION (no browser opened, screenshots deferred,
dark/zoom reported as "Prediction", fabricated e2e axe run, FAB mis-stated 56px vs
hardcoded 60px). Evidence channel re-run in-parent: axe-core injection, computed-style
contrast over all text nodes, geometry over all interactive elements, 20-step Tab walk,
4-width sweep, 5 screenshots @2x.

Surface mode: Operate. Seeded live target: child "Léo" 7mo, 33 entries / 32 distinct
foods / 5 weeks / 1 inconfort / 1 reaction. Empty-state child "Alice" 5mo, 0 entries.

## Design Health Score — 23/40 (Acceptable)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Both hero captions false. `+8 cette semaine` = count(*) entries (+page.server.ts:147) under count(distinct food_id) (:137). `meilleur score` unconditional. 4/7 allergen states off-screen, no affordance. |
| 2 | Match System / Real World | 2 | `Cette semaine` heads an unfiltered last-5 list (RecentFeed.svelte:22). `Bébé a 6 mois` sits under a pill reading `7 mois`. |
| 3 | User Control and Freedom | 2 | 148px peach banner is `dismissable: true` (reminders.ts:149) with no dismiss control. Window `>=6 && <8` months (:140) = 60 days unremovable. |
| 4 | Consistency and Standards | 2 | Five names for one action; `OK` vs `Tout va bien`; three caption sizes for one role; identical feed rows route to two destinations. |
| 5 | Error Prevention | 3 | RAS pre-checked, idempotency keys, offline replay. Gap: horizontal drag inside an `<a>`. |
| 6 | Recognition Rather Than Recall | 2 | After 48h the sesame reaction is memory-only: absent from the 5-row feed, pill links to a segment index not the entry. |
| 7 | Flexibility and Efficiency | 2 | computeReminders returns up to 4 (reminders.ts:88); ReminderStrip.svelte:8 renders reminders[0]. `important` sorts first, so the permanent banner outranks deep-linking repeat-exposure reminders forever. |
| 8 | Aesthetic and Minimalist Design | 3 | Real palette restraint, no decoration. But largest/first element is editorial guidance; desktop tiles ~75% dead space. |
| 9 | Error Recovery | 2 | /foods/<id> recovery page excellent but unreachable from dashboard after 48h. +page.svelte never destructures `form` → failed ?/dismissReminder is silent. |
| 10 | Help and Documentation | 3 | 3-step welcome, guide CTAs, cited sources. Dialog names "Carnet des allergènes", "Suggestions", "Rappels", "menu Guide" — none is a nav label. |
| **Total** | | **23/40** | **Acceptable** |

All 10 heuristics applicable (Operate surface); none scored n/a. max_score = 40.

## Design Specificity Verdict

PARTIALLY AUTHORED — this product's vocabulary on a category-interchangeable frame.

Authored: named allergens with real states (`Sésame · réaction`, `Gluten · introduit`),
texture suffixes (`Épinard · MOULINÉE`), `Bilan pour le pédiatre` hand-off, cited
HCSP/ESPGHAN guidance, `changer` child pill.

Not authored: AujourdhuiBento.svelte:87-126 is banner → 2 KPI tiles → chip strip →
5-row feed → 2 chevron rows. Relabel Aliments/Régularité to Habits/Streak and it ships
as a habit app. = PRODUCT.md anti-reference "AI-generated SaaS template" minus the
gradient. `RÉGULARITÉ · 6 jours · meilleur score` + animate-record-pop = "Gamified
streak shame" anti-reference; PRODUCT.md says a streak is just a number.

Sharpest symptom: the tab is `Aujourd'hui` and nothing on screen is about today. Feed
header `Cette semaine`, both tiles all-time, banner a 2-month stage rule. The one
genuinely-today object (`Menu du jour`) sits 231px below the fold on 390x844
(container 731px, content 962px).

Deterministic scan: `impeccable detect` over src/routes/child/[id],
src/lib/components/bento, TipCard, WelcomeDialog, AppShellBento, BottomNavBento,
FabLog = exit 0, 0 findings. Only src-wide hits: app.css:264-265 bounce-easing
(--ease-spring 1.4, --ease-celebrate 1.6). --ease-celebrate judged FALSE POSITIVE
(scoped milestone celebration, neutralised to linear under reduced-motion at
app.css:348-350). --ease-spring is arguable: it drives every modal + FAB hover, where
overshoot is ambient not celebratory.

No user-visible overlay: detector clean on this tree, so nothing to draw. Fallback
signal = direct in-page instrumentation.

## Measured evidence

- axe-core 4.x: 1 SERIOUS violation — `scrollable-region-focusable` on `.-mb-1`
  (AllergensSnapshot.svelte:41 pill `<ul>`). Chrome 127+ auto-focuses scrollers;
  Safari/Firefox do not — and the primary user is on iPhone/WebKit.
- Contrast light: 48 text nodes in <main>, 0 failures, floor 5.39:1
  (`Voir le guide` #436043 on #ffdbbd).
- Contrast dark: 1 failure — `meilleur score` #8ba78b on #52390f = 4.10:1 @12px/600
  (needs 4.5:1). StatTiles.svelte:47 uses text-primary-strong on a tile-butter
  surface instead of the paired text-tile-butter-foreground.
  scripts/lint-contrast.ts CANNOT catch it: it is a regex over forbidden token names
  with no notion of background pairing. `bun run lint:contrast` prints "contrast tokens OK".
- Dark theme activates correctly from prefers-color-scheme (canvas #171512) via the
  inlined app.html head script.
- Tap targets: 17 measured. Sub-44px: skip link 133x36, wordmark 96x28 (both clear
  WCAG 2.5.8's 24px floor). FAB 60x60 at x=165,y=784. Nav spacer 64px wide at
  163-227 → only 2px between the FAB and the `Carnet` tab.
- Tab order: 18 stops. Primary action is stop 17 on mobile (after all 4 nav tabs),
  last on desktop. FAB focus ring verified as a designed 4px sage ring with 2px cream
  offset: rgb(107,142,107) 0 0 0 4px. All other stops use the 1px UA outline.
- Widths 390/768/1024/1440: no horizontal overflow at any. Content column 390 → 448 →
  768 → 768. At 1440 the column sits at x=446 with ~452px dead cream after the 220px rail.
  Stat tiles at >=1024: 366x108 = 3.39:1 letterbox.
- Zoom 195x422 (200% equiv): 9 clipped nodes. Streak tile caption scrollWidth 80 in
  clientWidth 46; value scrollWidth 72 in 46; .grid.grid-cols-2 189 in 171. WCAG 1.4.4.
- Fold on 390x844: ReminderStrip y135-283 (148px, 33% of first viewport).
  Menu du jour y855 and Bilan y929 are below the fold.
- Allergen scroller: 911px of content in a 334px box, no fade/scrollbar/dots/chevron.
  Renders as `Arachide · à rep|` clipped mid-word.
- e2e/a11y-axe.spec.ts:87 uses signUpAndCreateChild = a ZERO-ENTRY child.
  AujourdhuiBento.svelte:63 returns [] with no entries, so the scroll container never
  renders in the fixture. The a11y gate has never tested a populated dashboard.

## What's Working

1. The reaction colour language never lies and coral is genuinely sacred.
   RecentFeed.svelte:30-34 and AllergensSnapshot.svelte:4-11 agree (mint OK / butter
   inconfort / soft peach réaction); the only coral on the whole journey is the
   `Appelez le 15 ou le 112` rail. "Cheer everywhere" works BECAUSE the severity
   channel is honest.
2. Contrast is measured-clean, not claimed-clean: 48 nodes, 0 light failures, 5.39:1
   floor, with pastel-on-pastel at high density. Dark theme holds up.
3. The empty state is honest as the brief demands: 0, 0 jours, "Aucun allergène noté
   pour l'instant", "Rien cette semaine". No fabricated stats. It over-delivers to the
   point of becoming a problem, but the instinct is right.

## Priority Issues

### [P1] The allergen module hides more than it shows — and the project's own a11y gate cannot see it
AllergensSnapshot.svelte:41 is an overflow-x-auto snap-x <ul>: 911px of content in a
334px box, no affordance of any kind, third pill clipped mid-word. axe reports
scrollable-region-focusable (serious) on that node; Safari/Firefox do not auto-focus
scrollers, and the primary user is on iPhone. The `todo`/next-to-try pills sort LAST
and are therefore always off-screen — the most actionable data on the dashboard is
structurally invisible. Ships green because e2e/a11y-axe.spec.ts:87 uses a zero-entry
child, so the container does not exist in the fixture.
FIX: stop nesting a scroller in a link. Make it a <div> tile with a heading link, wrap
pills to two rows at 390px (flex-wrap, drop snap-x/overflow-x-auto), make
reaction/inconfort pills individual <a>s to their worst entry. If scroll must stay:
tabindex="0" + accessible name + edge mask. Extend the axe spec with a populated child.
CMD: $impeccable harden src/lib/components/bento/AllergensSnapshot.svelte

### [P1] Both hero captions are untrue
(a) `ALIMENTS 32` is count(distinct food_id) (+page.server.ts:134-142); the caption
`+8 cette semaine` is count(*) of ENTRIES in 7 days (:144-157). Seeded state: 8 entries
but 7 new foods (Poire re-logged). The tile is arithmetically inconsistent with itself.
(b) `meilleur score` shows for every streak >= 1: +page.svelte:70-71 passes
streak={data.streak} AND streakRecord={data.streak} — the same value — so
StatTiles.svelte:18 isRecord is unconditionally true. No longest-streak query exists
server-side. animate-record-pop replays on every navigation. `score` is game vocabulary
in a codebase whose rule is "Régularité" not "Streak".
FIX: (a) count foodIds whose min(givenAt) >= sevenDaysAgo, or reword to
"8 repas cette semaine" and move it off the distinct-food tile. (b) delete the record
line until a real longest-streak query exists; then state it as fact ("record : 6 jours")
with no animation.
CMD: $impeccable clarify src/lib/components/bento/StatTiles.svelte

### [P1] `réaction` and `à reproposer` are the same colour
AllergensSnapshot.svelte:7 fading → bg-tile-peach; :10 reaction → bg-reaction-reaction.
Measured light: rgb(255,219,189) vs rgb(248,213,191) = 1.02:1 apart, identical fg
rgb(105,45,7). Dark: 73,39,18 vs 84,50,28. With realistic data the strip renders FIVE
visually identical peach pills where one means "your baby reacted". Only differentiator
is a 10px text-3xs suffix (:50), the smallest text on the screen. Also misuses the brand:
PRODUCT.md assigns peach-200 to "New / hero", not "try again".
FIX: move fading to a butter outline (border-tile-butter-foreground/40 bg-tile-butter/60
text-tile-butter-foreground) or a dashed pill on bg-canvas; reserve peach for reaction
alone. Raise the state suffix to text-2xs.
CMD: $impeccable colorize src/lib/components/bento/AllergensSnapshot.svelte

### [P1] A 60-day undismissable banner structurally outranks every actionable reminder
ReminderStrip.svelte:8 renders reminders[0] only. reminders.ts:86-88 sorts by severity
and returns up to 4. ruleStageTransitions emits stage-transition:6m with
severity:'important' (:144) and dismissable:true (:149) over ageMonths >=6 && <8 (:140).
Consequences: 148px tall (y135-283 of 844) = 33% of the first viewport, ~45% at 200%
zoom; no dismiss control despite being flagged dismissable (?/dismissReminder exists but
only WelcomeDialog calls it); `important` sorts first so it permanently outranks the
warn/info reminders — including repeat-exposure whose CTA deep-links to
/log?foodId=<id>, the single most useful control the system can produce; up to 3
computed reminders are silently discarded every load. Title says `Bébé a 6 mois` while
the pill 40px above reads `7 mois`, and the static body (reminderStage6Body) tells a
parent who logged œuf on day 26 and arachide on day 25 not to delay them. :19 puts a
BELL icon on routine editorial content, against PRODUCT.md's rejection of alarm idioms.
FIX: ghost `Fermer` (min-h-11) posting reminderKey to ?/dismissReminder; butter not
peach for stage reminders; one sentence per the brief's own rule; show a count/link when
reminders.length > 1; gate the body on actual allergen history.
CMD: $impeccable distill src/lib/components/bento/ReminderStrip.svelte

### [P2] The surface is only verified at 390px in light theme; everything outside degrades
(a) Dark theme's ONE AA failure is on the celebration: `meilleur score` 4.10:1
(StatTiles.svelte:47 text-primary-strong on tile-butter instead of the paired token).
lint-contrast.ts cannot catch it (regex over token names, no background pairing).
(b) 200% zoom clips the streak tile: caption 80 in 46, value 72 in 46, grid 189 in 171.
WCAG 1.4.4. Compounded by text-3xl Fraunces ITALIC on a number+unit ("6 jours" is 7
glyphs where "32" is 2) inside a rigid grid-cols-2 that never collapses.
(c) At >=1024px the bento stops being a bento: 768px column at x=446 in 1440, ~452px
dead cream after the rail, stat tiles 366x108 (3.39:1) with the number in the left 8%,
handoff rows 768x62, and `+ Enregistrer un aliment` fixed right-4 top-4 floating in the
dead gutter detached from both rail and content. This is exactly the "review progress at
calm moments" scenario in the brief.
FIX: (a) text-primary-strong → text-tile-butter-foreground at StatTiles.svelte:47;
upgrade lint-contrast.ts to compute ratios for token PAIRS. (b) grid-cols-1
min-[360px]:grid-cols-2; numeral to Inter/800/tabular-nums per the brief's Numeric
style, unit word split out of the display face. (c) real desktop grid (lg:grid-cols-3,
feed spanning two, tiles in the third); dock the log CTA into the rail.
CMD: $impeccable adapt src/lib/components/bento ; $impeccable audit src/app.css

## Cognitive Load — 6 of 8 FAIL → HIGH (critical)

- Single focus — FAIL: largest and first element is editorial guidance (148px, 33% of
  the first viewport); both the log action and the reaction state are subordinate to it.
- Chunking <=4 — FAIL: 7 allergen pills (up to 10 via AujourdhuiBento.svelte:76-82),
  5 feed rows, 5 nav targets, 17 interactive elements on one screen.
- Grouping — PASS: tiles, feed and nav are cleanly grouped.
- Visual hierarchy — FAIL: 1.02:1 between the reaction pill and the four fading pills;
  the only tense datum has no rank.
- One thing at a time — FAIL (empty state): /child/2 stacks the welcome modal, the peach
  `Bienvenue sur Diversif` strip, two zero tiles, a 240px prose block and a dashed
  `Rien cette semaine` callout — four statements of emptiness plus a modal.
- Minimal choices <=4 — FAIL: 3 decision points above 4 options on the dashboard itself
  (nav+FAB = 5; feed = 5 rows; allergen strip = 7), plus 13 category chips and 103 rows
  on the /log hand-off.
- Working memory — FAIL: the 11pm parent must remember a reaction happened and which
  entry; scrolled-away pills must be remembered; /log requires knowing the taxonomy
  (Beurre de cacahuète is under Allergènes, not Matières grasses).
- Progressive disclosure — PASS: tiles link to Carnet, rows to entry detail, reminders
  to guide.

## Emotional Journey

(a) 6-second happy log. Open → the first thing is the peach bell about daily protein,
inapplicable to this child, a small daily guilt dip. Tap FAB → full route load of
`Noter un repas`, search UNFOCUSED on arrival (activeElement BODY), 13 chips before
results, submit at y=1742 of 1970 and not sticky. Redirect → toast `Repas noté.` and the
row fades in (animate-feed-item 200ms, 60ms stagger). PEAK = the toast + row: honest,
modest, on-brand. END = the dashboard, whose first element is the same peach bell.
VALLEY = the form. The brief promises 4 taps / 6 seconds; measured is 4 taps plus two
screens of one-handed scrolling.

(b) 11pm non-RAS reaction. Within 48h the path is genuinely good: buildObservationReminder
→ severity warn → butter strip `Surveiller « Tahin (sésame) »` → `Voir le profil` →
/foods/<id> with the Fraunces `On vous accompagne…`, `Respirez`, and the only coral on
the journey. Reassurance present, one tap away. AFTER 48h (the seeded state): the feed
shows five mint `OK` rows; the only trace is `Sésame · réaction`, first of five identical
peach pills, whose tile navigates to the allergen segment rather than the entry. Peak-end
for the tense scene: the peak (entry page) is excellent, the END (dashboard) looks like a
good day plus a bell. Extra valley: a parent who just logged `Réaction marquée` is bounced
to the dashboard with the same mint `Repas noté.` toast a RAS log gets.

## Persona Red Flags

CASEY (thumb-only, interrupted, slow link): FAB reachable at 60x60 x=165 y=784, but its
left edge is 165 while the `Carnet` tab ends at 163 — a 2px gutter between adjacent tap
targets (guidelines want >=8px); a one-handed thumb hits Carnet reaching for the log.
Horizontal swipe on the pills lands inside an <a>, so a slip navigates. FAB triggers a
full route load rendering all 103 catalogue rows with no sheet and no skeleton, search
unfocused, submit 1742px down and not sticky. Interruption mid-form loses the selection
(selectedIds is page-local $state, nothing persisted).

SAM (screen reader, keyboard, 200% zoom): the allergen tile's accessible name is the
entire concatenation — "Suivi des allergènes Sésame · réaction Œuf · à reproposer
Arachide · à reproposer…" — one link, 20+ words, <ul> nested inside the anchor, then the
scroller re-announces the same content as a second stop. Primary action is tab stop 17 on
mobile (after all four nav tabs) and last on desktop (AppShellBento.svelte:144-146,
156-165); no skip target. WelcomeDialog.svelte:27 passes no title → announced as the
fallback "Dialogue". ReminderStrip.svelte:13 marks editorial guidance role="status" with
no heading, so heading navigation skips the largest element on the page. Credit: the FAB
carries a designed 4px sage focus ring with 2px cream offset (verified rendering); every
other stop falls back to the 1px UA outline — visible but inconsistent.

JORDAN (literal first-timer): tab `Aujourd'hui` → heading `CETTE SEMAINE` → row
`sam. 12 sept. 19:15`. `meilleur score` — score of what? `+8 cette semaine` — she counts
7. `Bébé a 6 mois` under a pill saying `7 mois`. Five peach pills — are all five
problems? `à reproposer` with no reason. `OK` here (reactionsLabelRas) vs `Tout va bien`
in the form (reactionsRasLabel). The primary action is named five ways:
`Enregistrer un aliment` (FAB) → `Noter un repas` (page) → `Noter ce repas` (submit) →
`Ajouter un repas` (empty state) → "enregistrez le premier aliment" (reminder). Is a
repas different from an aliment? Two pixel-identical feed rows route differently: single
entries to /foods/<id> (RecentFeed.svelte:101), meal groups to /log/<id> (:94).

"MAMIE NADIA" (invited co-parent, cold open, active child — project-specific): the
welcome dialog NEVER fires for her (showWelcomeDialog requires distinctFoods === 0 and
the child has 32), so the screen must be self-explanatory on first contact — and the
primary action has no visible label at all: FabLog.svelte renders a bare `+` with an
aria-label only, and BottomNavBento.svelte:76 leaves a captionless w-16 spacer beneath it
while all four real tabs are labelled. She cannot tell which entries are hers:
loggedByName is selected server-side (+page.server.ts:125) and typed into RecentEntry,
and RecentFeed.svelte:45-62 never renders it. CoparentActivity shows only other people's
entries, unlinked and without times. Her first impression of a baby-food app is a bell
icon and a paragraph about daily protein quantities.

## Minor Observations

- Numerals contradict the brief: StatTiles.svelte:32,43 uses font-display text-3xl
  italic (Fraunces 30px/400, no tabular-nums). PRODUCT.md's Numeric style is Inter
  26-28/800/'tnum' "so the numbers don't jitter on update". tabular-nums IS applied in
  ReportSummaryStats.svelte and QuantitiesCard.svelte — the most-glanced numbers in the
  product are the only ones without it.
- Three sizes for one caption role: 12/500 (tiles), 14/600 (SectionHeader), 11/600
  (TipCard). The brief specifies 11/600/0.08em.
- `Cette semaine` is not a week: `recent` is .limit(20) with no date predicate;
  RecentFeed.svelte:22 slices 5. An inactive parent sees month-old entries under it.
- Navigation rows and data rows are the same object: AujourdhuiBento.svelte:100-126
  reuses the 62px feed-row anatomy for Menu du jour and Bilan pour le pédiatre, so
  "places to go" and "things that happened" are indistinguishable.
- Empty state has four voices at once, and its dashed border is the only dashed border on
  the surface. Two giant zeros in display italic are the closest thing to the
  "pretend streaks" principle 5 forbids. `Ajouter un repas` sits directly above the FAB
  that does the same thing.
- WelcomeDialog.svelte:31-33: the title runs under the Modal's absolute close button at
  390px (no right padding); footer buttons measure 40px against the codebase's own 44px
  tap-target rule.
- Skip link (36px) and the `Diversif` wordmark (28px tall) are the only sub-44px targets;
  both clear WCAG 2.5.8's 24px floor.
- +page.svelte never destructures `form`, so a failed ?/dismissReminder (fail(400,
  errorKey)) is silent.
- In dark theme tile-sky resolves to a saturated navy which, paired with the allergen
  topic, is the most institutional-looking element on the screen — brushing the
  "Doctolib-style navy" anti-reference in the module that most needs to feel calm.

## Questions to Consider

1. What if `Aujourd'hui` actually showed today — matin/midi/goûter/soir slots, empty
   slots AS the invitation to log, `Menu du jour` ideas living inside the empty slots?
   The FAB would have a place to put the entry and the tab name would be true.
2. Why is pediatric guidance the largest and first element of a status screen? If
   reminders moved under `Découvrir`, the top slot could hold the one thing that changed
   since the parent last opened the app.
3. If the `Régularité` tile were deleted tomorrow, what would a parent lose? If nothing,
   what diversification-specific fact deserves that butter tile —
   `Prochain à essayer : sésame · poisson · œuf`, or
   `Texture : moulinée → petits morceaux bientôt`?
4. Should a food logged as `Réaction marquée` bounce back to the dashboard with the same
   mint `Repas noté.` toast as a routine RAS log — or land directly on the entry's
   `Respirez` page, the best screen in the product and the one the dashboard stops
   pointing at after 48 hours?

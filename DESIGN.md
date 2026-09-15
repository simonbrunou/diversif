---
name: Diversif
description: A warm, compartmented tracker for a baby's food diversification — cheerful surfaces, honest data.
colors:
  sage: 'hsl(120 14% 49%)'
  sage-strong: 'hsl(120 18% 32%)'
  cream: 'hsl(39 67% 97%)'
  surface: 'hsl(0 0% 100%)'
  surface-2: 'hsl(39 50% 91%)'
  ink: 'hsl(0 0% 10%)'
  ink-soft: 'hsl(0 0% 32%)'
  border-warm: 'hsl(39 36% 88%)'
  tile-peach: 'hsl(27 100% 87%)'
  tile-peach-foreground: 'hsl(23 88% 22%)'
  tile-butter: 'hsl(47 100% 84%)'
  tile-butter-foreground: 'hsl(38 88% 23%)'
  tile-mint: 'hsl(142 35% 84%)'
  tile-mint-foreground: 'hsl(142 41% 21%)'
  tile-sky: 'hsl(213 100% 89%)'
  tile-sky-foreground: 'hsl(218 62% 26%)'
  tile-lilac: 'hsl(257 100% 92%)'
  tile-lilac-foreground: 'hsl(261 56% 27%)'
  reaction-reaction: 'hsl(23 80% 86%)'
  reaction-reaction-foreground: 'hsl(23 88% 22%)'
  severe-coral: 'hsl(14 100% 71%)'
  severe-foreground: 'hsl(14 88% 22%)'
typography:
  display:
    fontFamily: "'Fraunces Variable', Fraunces, Georgia, serif"
    fontSize: '2rem'
    fontWeight: 500
    lineHeight: '2.375rem'
    letterSpacing: '-0.02em'
  headline:
    fontFamily: "'Inter Variable', Inter, system-ui, sans-serif"
    fontSize: '1.375rem'
    fontWeight: 700
    lineHeight: '1.75rem'
    letterSpacing: '-0.015em'
  title:
    fontFamily: "'Inter Variable', Inter, system-ui, sans-serif"
    fontSize: '0.875rem'
    fontWeight: 700
    lineHeight: '1.25'
  numeric:
    fontFamily: "'Inter Variable', Inter, system-ui, sans-serif"
    fontSize: '1.75rem'
    fontWeight: 800
    lineHeight: '1'
    fontFeature: "'tnum'"
  body:
    fontFamily: "'Inter Variable', Inter, system-ui, sans-serif"
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: '1.3125rem'
  label:
    fontFamily: "'Inter Variable', Inter, system-ui, sans-serif"
    fontSize: '0.6875rem'
    fontWeight: 600
    letterSpacing: '0.08em'
rounded:
  sm: '0.375rem'
  md: '0.625rem'
  lg: '0.875rem'
  tile: '1.125rem'
  hero: '1.5rem'
  full: '9999px'
spacing:
  gutter: '0.75rem'
  tile-padding: '1rem'
  stack: '0.75rem'
  row-gap: '0.5rem'
components:
  button-primary:
    backgroundColor: '{colors.sage}'
    textColor: '{colors.ink}'
    rounded: '{rounded.lg}'
    padding: '0.5rem 1rem'
    height: '2.5rem'
    typography: '{typography.body}'
  button-pill:
    backgroundColor: '{colors.sage}'
    textColor: '{colors.ink}'
    rounded: '{rounded.full}'
    padding: '0 1.25rem'
    height: '2.75rem'
  button-tile-mint:
    backgroundColor: '{colors.tile-mint}'
    textColor: '{colors.tile-mint-foreground}'
    rounded: '{rounded.lg}'
    padding: '0.5rem 1rem'
    height: '2.5rem'
  button-outline:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.lg}'
    padding: '0.5rem 1rem'
    height: '2.5rem'
  input-text:
    backgroundColor: '{colors.cream}'
    textColor: '{colors.ink}'
    rounded: '{rounded.lg}'
    padding: '0.5rem 1rem'
    height: '2.75rem'
    typography: '{typography.body}'
  card-tile:
    backgroundColor: '{colors.tile-mint}'
    textColor: '{colors.tile-mint-foreground}'
    rounded: '{rounded.tile}'
    padding: '{spacing.tile-padding}'
  card-surface:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.ink}'
    rounded: '{rounded.tile}'
    padding: '0.5rem 0.75rem'
  chip-state:
    backgroundColor: '{colors.tile-butter}'
    textColor: '{colors.tile-butter-foreground}'
    rounded: '{rounded.full}'
    padding: '0 0.75rem'
    height: '2rem'
    typography: '{typography.body}'
  fab-log:
    backgroundColor: '{colors.sage}'
    textColor: '{colors.ink}'
    rounded: '{rounded.full}'
    height: '3.75rem'
    width: '3.75rem'
---

# Design System: Diversif

## Overview

**Creative North Star: "The Honest Bento Tray"**

Every screen is a tray of small coloured compartments. The compartments are warm, pastel and inviting; the data inside them is honest. That second half is not decoration — it is the load-bearing constraint. A tracker for a medical-adjacent task reflexively gets one of two treatments: the hospital portal (navy, teal, Helvetica, "please confirm your appointment") or the SaaS dashboard (warm grey, indigo accent, identical card grid). Both are refused here. This is a baby-care register, used by a parent at 11pm with one hand free.

Warmth is how reassurance is delivered, so warmth applies uniformly — to a new food, a milestone, a reaction, and the account-deletion form alike. What warmth must never do is soften a fact. A `réaction` is a soft peach, not an alarm red; but it is also visibly _not_ the same peach as a routine "re-offer this" nudge, because a parent must be able to tell in one glance which of the two they are looking at. Cheerful surfaces, unflinching numbers: when the two conflict, the number wins and the surface stays warm around it.

Density is low and deliberate. Compartments are generously padded, separated by a consistent 12px gutter, and each holds one idea. The system leans on tonal fill rather than outline or shadow to say "this is a distinct thing", which is why five pastels carry so much of the structural load.

**Key Characteristics:**

- Warm cream canvas; pastel tonal compartments; near-black ink
- Sage as the single brand voice — actions and focus only, never decoration
- Coral quarantined to one real emergency
- Fraunces italic for the emotional register, Inter for everything factual
- Tabular figures on every live number
- One elevation channel per surface: tonal fill _or_ hairline, never both
- Mobile-first and one-handed; the desktop layout is a genuine re-composition, not a stretch

## Colors

Five pastels over a warm cream canvas, with one sage brand voice and one quarantined alarm colour.

### Primary

- **Sage** (`{colors.sage}`): The brand's only voice. It appears on the log FAB, primary buttons, the brand mark and every _declared_ focus ring — and essentially nowhere else. Carried over from the previous brand so returning parents still recognise the app. Where a control declares no ring of its own, the fallback outline below carries the voice instead.
- **Deep Sage** (`{colors.sage-strong}`): Sage is too light to be legible as text; this is its text-safe sibling, used for sage-coloured type on light surfaces. Never a _surface_ fill — it never becomes a compartment or a button — but it carries the three places that need sage at legible strength against a background the system does not control: the text selection highlight, the fallback focus outline, and `accent-color` on native checkboxes and radios.

### Secondary

The five tile tints are the system's structural vocabulary. Each is a compartment fill, always paired with its own dark foreground — never with grey.

- **Peach** (`{colors.tile-peach}`): New, hero, and signup moments. Also the base of the reaction tint.
- **Butter** (`{colors.tile-butter}`): Régularité, milestones, reminders, and the `inconfort` reaction.
- **Mint** (`{colors.tile-mint}`): Success, the "tout va bien" reaction, and counts of what has been introduced.
- **Sky** (`{colors.tile-sky}`): Informational surfaces; the allergen snapshot.
- **Lilac** (`{colors.tile-lilac}`): Discovery and suggestion surfaces.

### Tertiary

- **Soft Peach** (`{colors.reaction-reaction}`): Reserved for a recorded `réaction`. Deliberately distinct from the plain peach tile — it sits between butter and coral on the hue wheel so it reads as "look at this" without reading as "panic".
- **Emergency Coral** (`{colors.severe-coral}`): Appears on exactly one surface in the entire product: the "appelez le 15 ou le 112" rail on a reaction's detail page.

### Neutral

- **Warm Cream** (`{colors.cream}`): The app canvas. Warm, never white, never grey.
- **White** (`{colors.surface}`): Cards and sheets that must separate from the canvas.
- **Warm Sand** (`{colors.surface-2}`): Raised tiles, segmented-control tracks, and chrome that should read as furniture rather than content.
- **Ink** (`{colors.ink}`) / **Soft Ink** (`{colors.ink-soft}`): Primary and secondary type on neutral surfaces only.
- **Warm Hairline** (`{colors.border-warm}`): Dividers and input strokes.

### Named Rules

**The Quarantined Coral Rule.** Coral means "call emergency services". It appears on one rail, on one page, and nowhere else — not on validation errors, not on destructive buttons, not on a bad reaction. Its total absence from routine screens is what makes it legible when it finally appears.

**The Paired Foreground Rule.** Text on a tint uses that tint's own `-foreground` token. Never `ink-soft`, never `ink`, never a grey. Grey-on-pastel is the failure mode this system is built to avoid: it looks acceptable in light mode and quietly fails AA in dark.

**The One Voice Rule.** Sage marks what the user can _do_. If sage appears on something that is not an action or a focus state, it is wrong.

## Typography

**Display Font:** Fraunces Variable (with Georgia, serif)
**Body Font:** Inter Variable (with system-ui and the platform sans stack)

**Character:** Fraunces italic is the emotional voice — warm, slightly editorial, used sparingly for moments that carry feeling ("On vous accompagne…", the wordmark). Inter carries everything factual, and the split is strict: if a string states something true about the child, it is Inter.

### Hierarchy

- **Display** (Fraunces italic): Reassurance and brand moments, the landing hero, and the page title inside the signed-in app shell — `BackHeader`, `CarnetHeader`, `OnboardingForm`, `BentoAuthLayout`. Those set it at `text-3xl`/`text-xl` (and `text-4xl`/`text-5xl` on the landing hero) rather than one size, so treat the serif as the voice and let the surface pick the step. Never a data label and never a counter.
- **Headline** (Inter, 700, 22/28, -0.015em): Section headings, and the page title on the public utility routes — `/aide`, `/allergens`, `/guide`, `/sources`, `/offline`, `+error`, the child picker, `account/deleted`, `join/[code]`. Those are read to answer a question, not to be charmed. Two surfaces run the other way and set their _section_ headings in Fraunces: the pediatrician report, because the whole surface is composed as a printed document, and the landing page, because it is still a brand moment below the fold.
- **Title** (Inter, 700, 14/1.25): Row and card titles — a food name, a reminder headline.
- **Numeric** (Inter, 800, 28/1, tabular figures): Every live counter.
- **Body** (Inter, 400, 14/21): Guidance copy and descriptions.
- **Caption** (Inter, 400/600, 12/1.33): Row metadata and secondary facts — a texture, a relative timestamp, a count suffix. The most-used step in the product (61 files) and the one the first scan of this system missed; it sits between Body and Label deliberately, because a fact that supports a title should be smaller than the title without dropping to the 11px label size.
- **Label** (Inter, 600, 11, 0.08em, uppercase): Compartment labels and eyebrows.

### Named Rules

**The Tabular Figures Rule.** Any number that can change while the parent is looking at it carries `font-feature-settings: 'tnum'`. Proportional digits reflow their own width on increment, and a stat that jitters as it updates reads as unreliable.

**The Numerals Are Inter Rule.** Counters are Inter 800, never the display serif. Fraunces italic is beautiful and proportional, which makes it wrong for a number: a two-glyph count and a seven-glyph count set in it are visibly unequal in weight, and it has no tabular variant.

**The Unit Is Not The Number Rule.** A value with a unit splits the two — the figure at numeric scale, the unit at body scale on a shared baseline. "6 jours" set as one 28px run overflows a narrow compartment and reads as a sentence rather than a measurement.

**The One Dash Rule.** An age range is set with an en dash and no spaces — `4–6 mois`, `9–12 mois` — in both locales. This is a deliberate choice against the stricter French convention, which prefers a trait d'union or `de 4 à 6 mois` and treats the demi-cadratin for ranges as an anglicism. The product's largest body of French copy, `src/lib/content/guidance.ts`, already sets all 24 of its ranges with an en dash, so matching it keeps one convention across the catalogue, the reminders and the stage titles; diverging would mean a parent seeing both forms on the same screen. Revisit as a whole if ever, never key by key.

## Layout

A single mobile column that becomes a genuine tray on desktop, not a widened stack.

The mobile shell is a fixed-height column: a brand strip, a scrolling content area, and a bottom navigation bar in normal document flow (not floating), with the log FAB fixed over the bar's centre slot. Content is capped at `max-w-md` with a 12px gutter. Vertical rhythm is a uniform 12px stack between compartments and 8px between rows inside one.

At the `lg` breakpoint (1024px) the chrome changes shape: the bottom bar is replaced by a 220px left rail carrying both wayfinding and the primary action, and the content well widens to `max-w-3xl`. Compartments re-compose into a three-column grid with asymmetric spans — a narrow column for stacked stats, wide spans for strips and feeds, a last column for destinations. Column gaps come from the grid; vertical rhythm still comes from each compartment's own margin.

**Breakpoints:** Tailwind defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280), plus a hand-placed `min-[20rem]` (320px) guard where a two-up grid must collapse to one.

### Named Rules

**The Re-Composition Rule.** A wide viewport gets a different arrangement, not a wider one. A two-up stat pair stretched to a 768px well produces 3.4:1 letterboxes with the number stranded in the left eighth; the same pair stacked in a narrow grid column stays near-square and legible.

**The Thumb Arc Rule.** The primary action lives within reach of a thumb on a phone held one-handed. On mobile it is centred in the bottom bar with at least 8px of clear space from its neighbours; the parent's other arm is holding a baby.

**The Min-Width-Zero Rule.** Any flex child that contains text carries `min-w-0`. Without it a flex item refuses to shrink below its content width, and the overflow surfaces at 200% zoom as content escaping its own compartment.

## Elevation & Depth

Depth is tonal first, shadow second. A compartment separates from the canvas because it is filled with a different tint, not because it casts a shadow. Shadows are ambient and soft — warm-hued, large-blur, negative-spread — and they exist to lift a surface a millimetre off the cream, never to outline it.

### Shadow Vocabulary

- **`shadow-sm`** (`0 1px 2px hsl(28 30% 20% / 0.06)`): Barely-there separation for dense chrome.
- **`shadow-card`** (`0 6px 14px -2px hsl(28 30% 20% / 0.1), 0 2px 4px -1px hsl(28 30% 20% / 0.05)`): Buttons and controls that should feel pressable.
- **`shadow-soft`** (`0 8px 24px -8px hsl(28 50% 30% / 0.18)`): The default compartment lift. The system's workhorse.
- **`shadow-lifted`** (`0 18px 36px -10px hsl(28 50% 30% / 0.22)`): Sheets and modals above the page.
- **`shadow-glow`** (`0 0 0 4px hsl(47 100% 84%), 0 8px 20px -4px hsl(40 90% 50% / 0.4)`): Celebration only.

In dark mode the same shapes switch to neutral black at higher opacity, because a warm-tinted shadow is invisible against a warm near-black canvas.

### Named Rules

**The Single Channel Rule.** Declare elevation once: tonal fill, a hairline, or a shadow — never a 1px border under a wide soft shadow. That combination is the ghost card: on a canvas-coloured fill the border does all the work and the shadow is wasted. If a surface needs to separate, give it a background that differs from its parent.

## Shapes

Soft, generous, consistently rounded — the compartment language is a bento tray, and trays have no sharp corners.

The radius scale is deliberately short and each step has a stated owner: `sm` (6px) and `md` (10px) for chips and small controls, `lg` (14px) for default cards and buttons, `tile` (18px) for compartments, `hero` (24px) for page-scale tiles and modals, and `full` for pills, badges and avatars. The scale is closed by convention: a new value means the design has drifted and is a conversation, not a commit.

Borders are rare. Where one exists it is a warm hairline doing a job a fill cannot — an input stroke, a divider inside a tint — and it is 1px. There are no coloured left-borders, no zero-blur block shadows, and no clipped or angled silhouettes.

### Named Rules

**The Closed Scale Rule.** Six radii and `full`. If a surface seems to need a seventh, it either belongs to an existing step or the composition is wrong.

## Components

### Buttons

- **Shape:** Gently curved (`{rounded.lg}`, 14px); the `pill` size goes fully round.
- **Primary:** Sage fill with near-black ink — not white. White-on-sage measures 3.66:1 light and 2.62:1 dark, both failing AA; ink on sage measures **4.73:1 light and 6.63:1 dark** and sits better in the warm palette. Light mode clears the 4.5 floor by 0.23, which is the whole margin: a primary button is safe, but anything that wants headroom — an empty-state CTA, a call to action on a tinted compartment — takes a tile variant instead (mint is 7.32:1). This is why the two empty-state CTAs are mint and not sage.
- **Hover / Focus:** Colour-only transition at 200ms on the soft easing curve; no lift, no scale. Focus is a 2px sage ring at a 2px offset.
- **Tile variants:** Each of the five tints is available as a button fill with its paired foreground, for actions that live inside a compartment of that colour.
- **Secondary / Outline / Ghost:** Warm sand fill, warm hairline on white, or transparent-until-hover respectively.
- **Sizes:** 40px default, 36px small, 48px large, 44px pill, 40px icon (with a 44px minimum hit area).

### Chips

- **Style:** Fully round, 32px tall, 12px horizontal padding, tint fill with paired foreground. State-bearing chips carry a label plus a smaller state suffix.
- **State:** The fill _is_ the state. Two states that mean materially different things must not share a tint — the reaction tint and the re-offer tint were once 1.02:1 apart, which made a recorded reaction indistinguishable from a routine nudge.
- **Target size:** 32px with 8px separation. This is a deliberate deviation from the 44px floor, justified only for secondary inline chips and only because a 44px chip row pushed the parent's actual data below the fold; it still clears WCAG 2.5.8's 24px minimum.

### Cards / Containers

- **Corner Style:** `{rounded.tile}` (18px) for compartments; `{rounded.hero}` (24px) for page-scale surfaces and modals.
- **Background:** One of the five tints for a labelled compartment, white for content rows that must separate from the cream, warm sand for chrome.
- **Shadow Strategy:** `shadow-soft`, and only where the fill alone does not separate. See The Single Channel Rule.
- **Border:** Transparent on tinted compartments. A hairline only where no fill difference exists.
- **Internal Padding:** 16px for compartments, 12px for rows.

### Inputs / Fields

- **Style:** 44px tall, cream fill, a 2px warm border, `{rounded.lg}`, 16px horizontal padding.
- **Focus:** The border becomes sage; no ring is added. The stroke is already 2px, so a ring on top would double the visual weight.
- **Placeholder:** Soft ink.
- **Disabled:** 50% opacity with a not-allowed cursor.

### Navigation

- **Mobile:** A 56px bar in normal document flow, plus the safe-area inset, holding four icon-and-label tabs at 11px uppercase-free labels. The active tab is deep sage; the rest are foreground at 70%. A reserved centre slot holds the log FAB.
- **Desktop:** A 220px left rail with the wordmark in Fraunces italic, the primary action as a filled sage pill directly beneath it, then the same four destinations as text rows. The action is visually distinct from the destinations because it is an action, not a place.
- **Active state:** Warm sand fill plus deep sage text, and `aria-current="page"`.

### The Log FAB (signature)

A 60px sage disc with a plus glyph, fixed over the centre slot of the mobile bar and floating ~23px above it. It carries a visible French caption beneath the disc, because the product's secondary user is a co-parent who opens the app cold on a child that already has data — so the onboarding dialog never fires for them, and an unlabelled green circle is the primary action of the entire app. Focus is a 4px sage ring with a 2px cream offset. This is the one control in the system that gets a bespoke focus treatment.

### Focus

Two treatments, and the difference is not cosmetic.

A control that declares its own ring gets sage (`--ring`) with a 2px canvas
offset band. The band is load-bearing, not padding: an `outline` sits directly
against the surface behind it, and a bare sage ring measures **2.65–2.80:1**
against peach, mint, sky, lilac and the reaction tint — under WCAG 1.4.11's 3:1
floor for non-text contrast. The band puts cream between ring and tint.

Anything that does _not_ declare a ring falls through to one global
`:focus-visible` rule in deep sage (`--primary-strong`), which measures
**5.07–6.99:1** on every surface in light and **4.08–6.95:1** in dark, so it
needs no band. Pair a Tailwind ring with `focus-visible:outline-none` to opt a
control out of it; never leave a control with neither, or it inherits the
browser's own near-black `outline: auto`.

### Browser surfaces

The parts of the interface the app never draws still carry the design. Theme
each from the palette:

- **Text selection:** deep sage with canvas-coloured text. A selection
  highlight has to separate from the surface it covers — butter measures
  **1.11:1** against the cream canvas and is invisible. Selection is an
  interaction state, so it takes the brand voice like focus does.
- **Native control accents:** `accent-color` is deep sage, not sage. The
  browser derives the checkmark colour from the accent's luminance, and sage at
  49% lightness sits at the flip point, leaving the glyph at 3.66:1.
- **Scrollbars:** the warm hairline on a transparent track.
- **Underline offset:** 0.15em, because the default runs the rule through
  descenders on the hover-underlined links.

## Do's and Don'ts

### Do:

- **Do** pair every tint with its own `-foreground` token. On a pastel, grey text is a dark-mode AA failure waiting to happen.
- **Do** give live numbers tabular figures and Inter 800, and split any unit off the figure.
- **Do** declare elevation once per surface — fill, hairline, or shadow.
- **Do** keep sage for actions and focus, and let the tints carry structure.
- **Do** put `min-w-0` on any flex child holding text, and verify the result at a 195px viewport (200% zoom).
- **Do** re-compose the grid at `lg` rather than widening the mobile stack.
- **Do** keep primary actions inside the thumb arc with ≥8px of clearance from neighbours.
- **Do** let a long label wrap. A wrapped heading is better than an ellipsis, and an ellipsis is better than an overflow.
- **Do** set a measurement — a texture, a count suffix, a unit — as data: caption or body scale, sentence case, no tracking. The Label treatment belongs to compartment labels and eyebrows; applied to a fact it shouts, and `PETITS MORCEAUX` wraps mid-phrase in a 390px row.
- **Do** give a toggle `aria-pressed`. A filter chip that only changes colour tells a screen-reader user nothing about which filter is on.
- **Do** give every empty state a way out of itself. A state that describes what will happen without offering the action is a dead end on the one screen whose whole job is the first entry.

### Don't:

- **Don't** use coral for anything but the emergency rail. Not errors, not destructive actions, not bad reactions.
- **Don't** give two materially different states the same tint.
- **Don't** put white text on sage.
- **Don't** hide content in a horizontal scroller without a visible affordance — and never nest one inside a link. Scroll containers are not keyboard-focusable in Safari or Firefox, which is where this product's users are.
- **Don't** set a data label or a counter in Fraunces. The display serif is for feeling, not for facts.
- **Don't** put a 1px border under a wide soft shadow.
- **Don't** add a radius value outside the closed scale.
- **Don't** reach for bounce or elastic easing for ambient motion. Overshoot belongs to the single celebration curve; everything else decelerates exponentially.
- **Don't** put an eyebrow above a heading. Where a label is the compartment's only heading it is doing real work; stacked above a title it is decoration.
- **Don't** use an emoji or a unicode glyph where an icon belongs. Icons are drawn, from one library, at one stroke weight.

### Documented deviations

Three places knowingly depart from the rules above. Each is narrow, and each is
here so it does not get "fixed" later.

- **Allergen chips are 32px, not 44px.** Secondary inline chips only. At 44px
  they wrapped to three rows and pushed the parent's actual data below the fold
  on a 390×844 screen. 32px with 8px separation still clears WCAG 2.5.8's 24px
  floor.
- **The pediatrician summary carries a document header above its heading.** It
  is letterhead on a print-first artifact — a sheet handed across a desk has to
  say what it is and when it was edited — not a kicker decorating a screen
  title. It is the only eyebrow this system endorses; any other is a defect,
  not a precedent.
- **The print stylesheet leaves the palette.** `PrintShell` sets 11pt type,
  pure `#000` on `#fff`, and a 12px print body size. Ink on paper is a
  different medium: the pastel compartments waste toner and read worse than
  black type, and physical point sizes are not the screen ramp. The detector
  flags these as off-scale; they are print-only and deliberate.

# Codebase simplification — 6-bundle DRY/coherence pass

**Date:** 2026-05-21
**Status:** Approved by user during brainstorm 2026-05-21

## Why

A 6-agent audit of the codebase (UI duplication · server repetition · style/token coherence · dead code · i18n/copy · file size) returned ~50 findings. The pattern is consistent: the foundation (design tokens, primitives, paraglide, server helpers) is solid, but consumers have drifted — hand-rolled copies of patterns that already exist as primitives, half-finished migrations, anglicism leaks, copy-pasted server preludes.

The aim is therefore not to redesign anything but to **migrate the codebase onto the abstractions it already has** (and add the small handful of primitives still missing). Visible parity is preserved end-to-end — the user explicitly rejected a previous "rewrite" PR (#166) for breaking visual parity, so every bundle here is a refactor, not a redesign.

## Scope

Six independently-mergeable PRs, executed in dependency order. Each bundle leaves the codebase in a working state; intermediate bundles surface no user-visible regressions.

### Bundle 1 — Foundation primitives

**New components**

- `src/lib/components/ui/Field.svelte` — `{ label, name, error, hint, children? }`. Wraps the `<div class="grid gap-1.5"><Label/><Input/><FormError/></div>` pattern repeated ~25 times across forms.
- `src/lib/components/ui/ConfirmModal.svelte` — `{ open, title, description, confirmLabel, requireText?, requirePassword?, destructive?, onConfirm }`. Absorbs the two hand-rolled center modals in `child/[id]/settings/+page.svelte` (delete child, leave child) and the future `account/delete` flow.
- `src/lib/components/ui/Callout.svelte` — `{ variant: 'warning' | 'info' | 'success', title?, children }`. Replaces the seven `bg-amber-50 / text-amber-900 / border-amber-300 / rounded-md` `<aside role="note">` blocks that bypass the `--warning` token and lack dark-mode parity.
- `src/lib/components/ui/DetailSheet.svelte` + `SheetSection.svelte` — slot-driven container for `StageDetailSheet`, `AddSymptomSheet`, `AllergenInfoDialog` (currently three near-identical implementations of "Modal side=auto → intro → labeled section list → optional warning panel").
- `src/lib/components/ui/CalloutCard.svelte` — promote `EmptyHint`'s rich-mode markup into its own primitive so empty-state, "you don't have any X yet" CTA, and the marketing-callout pages (allergens / sources / guide) share one layout. `EmptyHint` keeps its simple-text mode; rich-mode consumers move to `CalloutCard`.

**Extended primitives**

- `Button.svelte` — add `size="pill"` variant + `shadow-soft` option to absorb the ~9 hand-rolled `rounded-full bg-primary px-4 py-3 …` CTAs scattered through bento, login, signup, AppShellBento.
- `SectionHeader.svelte` — add `size: 'sm' | 'md'` prop and migrate the 28 inline `text-xs|sm font-semibold uppercase tracking-wider text-ink-soft` labels.
- `Card.svelte` — add `padding: 'sm' | 'md' | 'lg'` prop (current `class="p-4"` / `"p-3"` / `"p-5"` inline drift gets a knob).

**i18n keys added (shared)**

- `commonCancel`, `commonPassword`, `commonFirstName`, `commonRemove`, `commonDelete`, `commonSave` — referenced by the new primitives and by bundle 5.

**Acceptance**

- All new primitives + 3 extensions land with vitest unit coverage.
- No callsite migrations yet — that's bundle 2/3.
- `npm test` green; visual regression nil because nothing was migrated.

### Bundle 2 — Visual coherence sweep

**Migrations**

- Replace 7 `bg-amber-50` callouts with `<Callout variant="warning">` (`routes/cgu`, `allergens`, `+page.svelte` landing, `guide`, `mentions-legales`, `sources`, `politique-confidentialite`).
- Migrate inline primary-pill CTAs (~9 sites) to `<Button size="pill" shadow>`.
- Migrate 28 inline section labels to `<SectionHeader size="sm">`.
- Promote landing/empty-state pages' "outro CTA card" (`allergens`, `sources`, `guide`) to `<CalloutCard>`.

**Visual fixes**

- Modal scroll cap: change `Modal.svelte` `scrollableBody` from `max-h-[70vh]` to `flex-1 min-h-0 overflow-y-auto` so it inherits the 92dvh sheet height instead of leaving ~22vh dead space on tall iPhones.
- `BentoMark.svelte` `rounded-2xl` → `rounded-tile` (sole outlier in the radius scale).
- Two `duration-200` → `duration-base` (rotting the token scale).
- Move `.discover-group` ad-hoc CSS from `src/app.css:324-363` into Tailwind classes on `DiscoverGroup.svelte`, picking one opacity (0.18) across the three tints.

**New utility**

- `src/app.css` adds `.tap-target { @apply min-h-11 min-w-11; }` and applies it to icon buttons / sheet grabbers / severity chips that currently rely on padding alone.

**Standards documented**

- A 4-tier radius rule (sm/md for chips & inputs; tile for cards; hero for page-scale tiles; full for pills) — added as a comment block in `tailwind.config.ts` so future drift is loud.

**Acceptance**

- `grep -rn "bg-amber-50" src/` → 0 hits.
- `grep -rn "rounded-2xl" src/` → 0 hits.
- `grep -rn "duration-200" src/` → 0 hits.
- Playwright smoke run + manual sweep of the 7 migrated callouts in light + dark.

### Bundle 3 — Forms + destructive modals migration

**Migrations**

- Apply `Field` to every `<div class="grid gap-1.5">` form pattern (~25 sites): signup, login, account/password, account/profile, child/[id]/log, child/[id]/settings, FoodCombobox, AddSymptomSheet inline fields.
- Apply `ConfirmModal` to:
  - `child/[id]/settings/+page.svelte` — delete-child + leave-child modals.
  - `account/delete/+page.svelte` — the danger-zone flow.
- Apply `DetailSheet` + `SheetSection` to `StageDetailSheet`, `AddSymptomSheet`, `AllergenInfoDialog` (data-drive the section list).

**Heading hierarchy fix (a11y)**

- Each sheet currently jumps h1 → h3 (Modal title is h1, in-sheet labels are h3 with `text-xs uppercase`). `SheetSection` emits an `<h2>` so heading order is contiguous.

**Acceptance**

- `grep -rn 'class="grid gap-1.5"' src/` → 0 hits (or down to one-offs intentionally not using Field).
- Three sheets render identically (visual diff) and have correct heading order in axe-core.
- Both confirm modals keep their existing copy and `requireText`/`requirePassword` semantics.

### Bundle 4 — Server boilerplate kill

**New helpers (all in `src/lib/server/`)**

- `guards.ts` gains `requireChildContext(event): Promise<{ user, membership, childId }>` — collapses the 3-line `requireUser/parseChildIdParam/requireMembership` prelude duplicated ~20 times.
- `guards.ts` gains `parseIntParam(raw, kind)` — generalizes `parseChildIdParam` + `parseEntryIdParam` (currently two near-identical functions).
- `forms.ts` (new) exports `parseForm<T>(request, schema, { errorKey? = 'error' }): Promise<Result<T, ActionFailure>>` — collapses the 7-step `Object.fromEntries → safeParse → fail(400, …)` pattern (~12 sites) and enforces one canonical error-key convention (`{ error: string }`; all `errorKey`, `passwordErrorKey`, `deleteErrorKey`, `passkeyErrorKey`, `profileErrorKey` keys are renamed to `error` in callsites + client templates).
- `fresh-auth.ts` (new) exports `requireFreshAuth(user, currentPassword): Promise<Result<SafeUser, ActionFailure>>` — wraps the rate-limit + re-fetch + `verifyPassword` triplet duplicated across `account/password`, `account/delete`, `child/[id]/settings.deleteChild`.
- `food-resolution.ts` (new) exports `resolveOrInsertFood(tx, { foodId, customName, customCategory, childId })` — absorbs the 45-line copy-paste between `child/[id]/log/+page.server.ts` and `child/[id]/log/[entryId]/+page.server.ts`.
- `src/lib/utils/dates.ts` gains `formatDate(d, locale)`, `formatTime(d, locale)`, `toEpochMs(value)`, `dayBuckets(now, days)` — moves the file-private helpers and the `r.givenAt instanceof Date ? …` dance out of the routes.
- `src/lib/server/users.ts` (extend the existing module) exports `getUserPasswordHash(userId)`. The three `account/password`, `account/delete`, `child/[id]/settings.deleteChild` sites switch from "re-fetch user → if (!fresh) localizedRedirect('/login')" (a stale-session anti-pattern that treats an invariant violation as a logout) to "fetch hash; if absent, throw a 500-class error." `requireFreshAuth` consumes this helper rather than re-implementing it.

**Session cookie helper**

- `src/lib/server/sessions.ts` (or wherever the cookie ceremony lives) exports `setSessionCookie(cookies, sessionId)`; `login`, `signup`, and `account/password` migrate to it.

**Acceptance**

- `grep -rnA1 "requireUser" src/routes/child` returns at most loaders that need the user identity beyond membership.
- `grep -rn "Object.fromEntries(await" src/routes` → 0 hits.
- `grep -rn "verifyPassword" src/routes` → 0 hits (only `fresh-auth.ts` calls it).
- All existing `*.test.ts` suites stay green; no test rewrites required.

**Deliberately deferred**

- `withIdempotencyKey` expansion to all double-submit POSTs — needs a per-scope design pass, not in this bundle.
- `audit()` wrapping convention via a `formAction()` builder — once `parseForm` + `requireFreshAuth` exist, this is the obvious next step but ships separately so its design can be reviewed standalone.

### Bundle 5 — Copy & i18n cleanup

**Finish paraglide migration**

- Replace hardcoded French in `routes/child/[id]/log/+page.svelte`, `routes/child/[id]/log/[entryId]/+page.svelte`, `routes/child/[id]/settings/+page.svelte`, `routes/join/[code]/+page.svelte`. Existing keys (`commonCancel`, `commonPassword`, `commonFirstName` from bundle 1) cover most of it.

**Terminology decisions (documented in `PRODUCT.md`)**

- "Carnet" is the canonical product noun for the surface (matches `chromeTabsCarnet`). `printDocumentTitle` and `authAccountDataDescription` change "journal" → "carnet"; `dialogsWelcomeStep1Bullet2Bold` changes "Suivi des allergènes" → "Carnet des allergènes" (or whichever phrasing the user prefers — see open question).
- "Passkey" → "clé d'accès" everywhere. Keys to update: `authLoginPasskeyPrimaryCta`, `authLoginPasskeySecondary`, `authSignupPasskeyCta`. Drop the parenthetical "(passkeys)" in `authAccountPasskeysSection`.
- The `decouvrirSuggestionReasonDiversify` value "Diversifie ta journée" becomes "Diversifiez votre journée" — the lone tu-form in 158 messages.
- "Stats"/"Bilan" key family normalized to `*Bilan*` (renames in source; values unchanged). The visible word stays "Bilan" on the Carnet surface. The Report surface currently mixes "Tableau" (`reportBackToDashboard`), "Récap" (`reportHeaderEyebrow`), and "Bilan" (`reportHandoffTitle`); this bundle aligns it on "Bilan" too unless the user prefers otherwise (see open question 3).

**Typographic apostrophe normalization**

- Script-level pass: every in-word `'` in `messages/fr.json` becomes U+2019 (`'`). 46 keys affected. Verified by `python -c "…"` one-shot during the PR.
- Add an `npm run lint:i18n` script that fails if a straight-apostrophe sneaks back in.

**Cleanup**

- Delete unused keys: `authAccountDataDescription`, `authAccountDataExport` (verified by audit; live exports use `profilRgpdExport`).
- Reconcile "12 vs 14 allergènes": `landingFeatureAllergensBody` says 14; `kidPickerGuideChipAllergens` and `landingFaqA2` say 12. Pick the truthful number (catalog count, almost certainly 12) and align all three.
- Move the leading "← " out of `reportBackToDashboard` into the `<a>` template.

**Acceptance**

- `grep -rn "Annuler\|Mot de passe\|Prénom" src/routes/child src/routes/join` → only paraglide-emitted output.
- `grep -rn "passkey\|Passkey" src/lib/paraglide` → 0 occurrences in FR string values (key names can keep the term).
- `npm run lint:i18n` green.

### Bundle 6 — Cleanup tail

**Dead code deletion**

- Delete `src/lib/components/LegalLinks.svelte` (0 consumers — `ProfilBento.svelte` inlines its content separately).
- Drop unused exports: `parseDateTimeLocal()`, `formatDateTime()` in `src/lib/utils/dates.ts` (already orphaned in the audit; the bundle 4 `formatDate`/`formatTime` additions are new symbols that don't collide).
- Drop unused `pendingCount` _export_ in `src/lib/offline/queue.ts` (the internal writable remains).
- De-export `EXPORT_FOOD_ENTRIES_LIMIT` (internal-only constant).
- Inline or delete `isPlaceholder()` in `src/lib/server/legal.ts` (only consumer is its own test).

**File size — split**

- `src/lib/server/guidance/queries.ts` (555 lines, 11 unrelated loaders) → split into `queries/diversity.ts`, `queries/timeline.ts`, `queries/dismissals.ts` with a re-export `index.ts`.
- `src/lib/components/GuideStaticSections.svelte` (424 lines, 9 sections) → one `.svelte` per section under `src/lib/components/guide/`, with `GuideStaticSections.svelte` becoming the index.
- Split oversized test files by describe block:
  - `guidance/queries.test.ts` (1032) → 3-5 files matching the production split.
  - `child/[id]/log/page.server.test.ts` (702) → `log.create.test.ts`, `log.update.test.ts`, `log.idempotency.test.ts`.
  - `child/[id]/foods/page.server.test.ts` (603) → `foods.list.test.ts`, `foods.actions.test.ts`.
  - `passkeys.test.ts` (594) → `passkeys.helpers.test.ts`, `passkeys.challenges.test.ts`, `passkeys.ceremony.test.ts`.
  - `child/[id]/settings/page.server.test.ts` (579) → `settings.child.test.ts`, `settings.membership.test.ts`, `settings.invitations.test.ts`.
  - `gdpr.test.ts` (574) → `gdpr.delete.test.ts`, `gdpr.export.test.ts`.

**File size — refactor in place**

- Extract `Modal.svelte`'s ~200-line drag gesture into `src/lib/components/ui/use-bottom-sheet-drag.svelte.ts` (Svelte 5 rune composable). The `.svelte` shell drops to ~250 lines and the gesture is unit-testable.

**Acceptance**

- `find src/lib src/routes src/test -type f \( -name '*.svelte' -o -name '*.ts' \) -not -path '*/paraglide/*' -exec wc -l {} + | sort -rn | head -5` shows no file over ~500 lines (except generated/content data files).
- `npm test` green; no behavioral test changes.

## Non-goals (explicitly out of scope)

- **Header consolidation** (`BackHeader` / `SharedTopBar` / `PublicHeader` / `ChildHeaderPill`). Subtle placement differences; deserves its own RFC.
- **Idempotency wrapper coverage expansion**. Per-scope design decision, not mechanical.
- **`audit()` wrapping convention**. Wait for bundle 4's helpers to settle before designing the action-builder.
- **`schema.ts` split into per-domain files**. Modest gain; Drizzle migration tooling expects a single source.
- **Welcome dialog ICU rich-text consolidation** (`Step0Bullet*Before/Bold/After` per bullet). Worth doing eventually; isolated effort, not part of the coherence story.

## Decisions (locked during brainstorm 2026-05-21)

1. **"Carnet" is canonical.** "Suivi des allergènes" → "Carnet des allergènes" in the Welcome dialog. "Journal" → "Carnet" in PDF/export copy. One noun for the surface across the app.
2. **`Callout` icons are hardcoded per variant.** `warning = ⚠`, `info = ℹ`, `success = ✓`. No icon prop; no slot. Visual consistency by construction.
3. **Report surface aligns on "Bilan."** "Récap pédiatrique" eyebrow → "Bilan pédiatrique." "← Tableau" back-link → "← Bilan." One word for the concept across Carnet and Report.

## Risks & mitigations

- **Visual regression during migrations (bundles 2–3, 5).** Mitigation: each migration sweep runs the existing Playwright suite; for amber-callout / sheet / form sweeps, manually screenshot before and after on 1 light + 1 dark page from each route.
- **Server-side helper rewrite breaks an obscure path (bundle 4).** Mitigation: helpers are introduced first and called from one site, then migrated route by route; existing test suites keep all 7 affected routes covered.
- **Audit-finding consumer-trace miss (bundle 6 deletions).** Mitigation: each delete is gated by a clean grep + `tsc --noEmit` pass — follow the "audit two extra passes" rule from prior memory.
- **Stacked-PR retargeting.** Bundles will likely overlap in time; per memory, retarget child PRs to `main` before merging the parent.

## Out of band

- After each bundle merges, run `graphify update .` to keep the graph fresh.
- Each bundle's PR description links back to this spec.

## Next step

Hand off to the `writing-plans` skill to turn each bundle into a step-by-step implementation plan (one plan per bundle, executed in order).

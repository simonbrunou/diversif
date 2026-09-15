# Graph Report - diversif  (2026-09-15)

## Corpus Check
- 608 files · ~462,865 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 4553 nodes · 7771 edges · 255 communities (213 shown, 42 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 58 edges (avg confidence: 0.82)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `71e4b49e`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- en.json
- fr.json
- Card.svelte
- component.ts
- Key screens
- Button.svelte
- engine.ts
- "../../../node_modules/.pnpm/@sinclair+typebox@0.31.28/node_modules/@sinclair/typebox/typebox.js"
- Bento UI/UX Redesign ("Joyful Bento") — Design
- i18n Scaffolding (paraglide-sveltekit, FR + EN) Implementation Plan
- Components
- _helpers.ts
- schema.ts
- tables.ts
- guidance.ts
- db/index.ts
- db.ts
- Common Workflows
- enabledPlugins
- Tasks
- routes/+layout.svelte
- SectionHeader.svelte
- bun-test-utils.ts
- medical-audit-2026-05-08.md
- Foundation: Bento Tokens + shadcn-svelte Primitives — Implementation Plan
- queue.ts
- passkeys.ts
- @axe-core/playwright
- Fallow: Critical Gotchas
- textures.ts
- TSchema
- plugin-message-format.js
- Observability — Sentry (server + client) — Design
- content/symptoms.ts
- auth.ts
- Diversif
- ignoreDependencies
- scripts
- Tasks
- .fallowrc.json
- sources.ts
- dependencies
- report/+page.server.ts
- Fallow CLI Reference
- Phase 2 — Menu engine + safety
- Quantités & Menu du jour (meal engine)
- export-user.ts
- Phase 3: App Shell + FAB Log Flow Implementation Plan
- Multi-ingredient Meals Implementation Plan
- Allergen maintenance tracking
- Critique — /child/[id] (Aujourd'hui)
- FoodCombobox.svelte
- Texture progression + Bilan pour le pédiatre
- Visit
- dates.ts
- Key screens
- Fallow: Common Workflow Patterns & Recipes
- PWA Offline Log Queue Implementation Plan
- UI Regression Coverage Implementation Plan
- Multi-ingredient meals — design
- CI Pipeline Setup
- Phase 7 — Cleanup & Flag Removal Implementation Plan
- Route-loader Hardening — Design
- i18n Scaffolding (FR + EN, paraglide-sveltekit) — Design
- i18n dead-key trim — design
- IsOpenParen
- Quantités & Menu du jour Implementation Plan
- compilerOptions
- bun-test.ts
- Migration plan (seven phases, every commit shippable)
- rate-limit.ts
- DEPLOY.md
- PRODUCT.md — Diversif product register
- Bundle 1 — Foundation primitives (Implementation Plan)
- Design
- PRODUCT.md — Diversif
- railpack.json
- check-i18n-unused.ts
- useBottomSheetDrag
- Information architecture
- log/+page.server.ts
- Sentry Observability Implementation Plan
- Task 5: Visual-fix batch
- Bun Migration Implementation Plan
- PWA Offline Log Queue (+ Install CTA + Offline Fallback) — Design Spec
- Phase 5 — Découvrir + Profil + Reaction Detail — Design Spec
- Codebase simplification — 6-bundle DRY/coherence pass
- UI regression coverage — design
- TLiteral
- sentry.ts
- Design tokens
- Testing & accessibility
- Allergen maintenance tracking Implementation Plan
- Texture Progression + Bilan pour le pédiatre Design
- overrides
- TObjectRight
- reaction-values.ts
- pre-launch-check SKILL
- Late reaction promotion — implementation plan
- PR 2 — Bilan pour le pédiatre
- Late reaction promotion on a `ras` food entry
- Discover tab — grouped layout
- Modal.svelte
- Component primitives (shadcn-svelte)
- seo.ts
- localized-href.ts
- devDependencies
- webauthn-auth-reviewer subagent
- Testing & accessibility
- PR 1 — Texture progression
- Discover tab grouped layout — Implementation Plan
- Phase 5 — Test framework migration (the big one)
- Multi-ingredient Meals Implementation Plan
- Bento UI/UX Redesign ("Joyful Bento") Design
- Phase 5 — Découvrir + Profil + Reaction Detail Design
- Reproducible Claude Code setup — design
- check-bundle-size.ts
- reminders.ts
- timeline.ts
- Phase 5 — Découvrir + Profil + Reaction Detail Implementation Plan
- Perf budget Implementation Plan
- UI Regression Coverage Implementation Plan
- A11y audit — design
- project.inlang/settings.json
- categories.ts
- passkey-client.ts
- seed.ts
- CLAUDE.md hard rules
- prettier-plugin-tailwindcss
- tenant-isolation-auditor subagent
- typescript
- JSON Output Structure
- vite.config.ts
- Route-loader Hardening Implementation Plan
- Bun Migration Implementation Plan
- Phase 6 — Auth + Onboarding + Landing + Legal — Design Spec
- Perf budget — design
- [id]/+page.server.ts
- typescript-eslint
- Testing Diversif Locally
- `license`: Manage Continuous Runtime License
- `health`: Function Complexity & File Health Analysis
- Custom Plugin Setup
- Claude Code setup — reproducible everywhere
- Phase 6 — Auth + Onboarding + Landing + Legal Implementation Plan
- Perf Budget Implementation Plan
- package.json
- verify-backup-restore.ts
- profile/page.server.test.ts
- getLegalIdentity
- ageInMonths
- Bundle 2 — Visual coherence sweep (Implementation Plan)
- allergen-status.ts
- Monorepo Analysis
- dependency-cruiser
- Sentry Observability Implementation Plan
- PARKING_LOT.md
- `coverage`: Production-Coverage Workflow
- `fix`: Auto-Remove Unused Code
- Full Project Audit
- Safe Auto-Fix Workflow
- i18n-add-key/SKILL.md
- Phase 3 — DB layer
- Testing & accessibility
- Architecture
- create-migration/SKILL.md
- renovate.json
- log.hint.test.ts
- `audit`: Changed-File Quality Gate
- Debugging False Positives
- Incremental Adoption with Baselines
- PWA Offline Log Queue Design
- Testing strategy
- Architecture
- Throw
- scripts/cleanup.ts
- generate-icons.ts
- lint-contrast.ts
- list-stale-users.ts
- healthz/+server.ts
- Diversif — Claude context
- Guard `git push` with a Claude Code PreToolUse hook
- Migration from jscpd
- litestream.yml replication config
- Data flow
- The engine — `src/lib/server/menu/engine.ts` (Phase 2)
- `explain`: Rule Explanation
- Configuration File Format
- `dead-code`: Dead Code Analysis
- `dupes`: Duplication Detection
- `security`: Security Candidate Detection
- `flags`: Feature Flag Detection
- Client queue contract
- UI surfaces
- Q: Why does resetTestDb connect Test Seed Helpers to Passkey, Hooks Auth Tests, Dashboard Data Loaders, GDPR Data Export, Cleanup Rate Limiting, and Database Backup Migrations?
- Q: Why do 5+ test files independently call hashPassword from lib/server/auth.ts?
- tokens.test.ts
- File Structure
- svelte.config.js
- sqlite
- Graphify memory: hashPassword fan-out query
- playwright.config.ts
- claude-setup.sh
- lint-i18n.ts
- src/app.html
- svelte-loader.preload.ts
- .env.example
- eslint
- @eslint/js
- eslint-plugin-drizzle
- eslint-plugin-svelte
- fake-indexeddb
- fallow
- husky
- knip
- @playwright/test
- prettier
- @sentry/vite-plugin
- @sveltejs/vite-plugin-svelte
- @tailwindcss/vite
- @types/bun
- vite
- @vite-pwa/sveltekit
- cloud-setup.sh
- session-bootstrap.sh
- prerender
- GitHub FUNDING.yml
- Diversif Favicon Icon
- Apple Touch Icon (180x180)
- Diversif PWA Icon (192x192)
- Diversif PWA App Icon (512x512)
- Maskable App Icon (192px)
- Maskable App Icon (512px)
- Diversif Social Share OG Image

## God Nodes (most connected - your core abstractions)
1. `"../../../node_modules/.pnpm/@sinclair+typebox@0.31.28/node_modules/@sinclair/typebox/typebox.js"()` - 151 edges
2. `testDb` - 68 edges
3. `seedUser()` - 62 edges
4. `makeRouteEvent()` - 59 edges
5. `resetTestDb()` - 55 edges
6. `Visit()` - 52 edges
7. `safeUser()` - 49 edges
8. `seedChild()` - 46 edges
9. `users` - 45 edges
10. `seedMembership()` - 42 edges

## Surprising Connections (you probably didn't know these)
- `CI workflow (ci.yml)` --references--> `@sentry/sveltekit`  [EXTRACTED]
  .github/workflows/ci.yml → package.json
- `webauthn-auth-reviewer subagent` --references--> `@simplewebauthn/server`  [EXTRACTED]
  .claude/agents/webauthn-auth-reviewer.md → package.json
- `Use Bun, not npm/Node convention` --conceptually_related_to--> `Bundle 1 — Foundation primitives Implementation Plan`  [AMBIGUOUS]
  CLAUDE.md → docs/superpowers/plans/2026-05-21-bundle-1-foundation-primitives.md
- `Reverse proxy / Cloudflare Tunnel header config (ADDRESS_HEADER etc.)` --semantically_similar_to--> `ADDRESS_HEADER / reverse-proxy client-IP trust config`  [INFERRED] [semantically similar]
  README.md → DEPLOY.md
- `FR/EN message-key parity enforcement (lint:i18n)` --semantically_similar_to--> `check-i18n-unused.mjs dead-key detector (i18n-keep directive)`  [INFERRED] [semantically similar]
  README.md → docs/superpowers/plans/2026-05-22-i18n-deadkey-trim.md

## Import Cycles
- 3-file cycle: `src/lib/server/guidance/queries/diversity.ts -> src/lib/server/guidance/repeat-candidates.ts -> src/lib/server/guidance/queries/index.ts -> src/lib/server/guidance/queries/diversity.ts`

## Communities (255 total, 42 thin omitted)

### Community 0 - "en.json"
Cohesion: 0.00
Nodes (500): addSymptomLabel, addSymptomNote, addSymptomNotePlaceholder, addSymptomObservedAt, addSymptomSeveritySevereSrPrefix, addSymptomSubmit, addSymptomTitle, allergenArachide (+492 more)

### Community 1 - "fr.json"
Cohesion: 0.00
Nodes (500): addSymptomLabel, addSymptomNote, addSymptomNotePlaceholder, addSymptomObservedAt, addSymptomSeveritySevereSrPrefix, addSymptomSubmit, addSymptomTitle, allergenArachide (+492 more)

### Community 2 - "Card.svelte"
Cohesion: 0.07
Nodes (9): sources, Icon, string, ./$types, ./$types, ./$types, ./$types, ./$types (+1 more)

### Community 3 - "component.ts"
Cohesion: 0.08
Nodes (5): i(), user, page, setPagePathname(), textSnippet()

### Community 4 - "Key screens"
Cohesion: 0.29
Nodes (7): `/child/new` (`OnboardingForm`), Key screens, `/` (landing) — bento restyle, Legacy Aujourd'hui — `BentoOptInBanner`, Legal pages, `/login` (wrapped in `BentoAuthLayout`), `/signup` (wrapped in `BentoAuthLayout`)

### Community 5 - "Button.svelte"
Cohesion: 0.07
Nodes (19): createFormToasts(), KeysOf, error, success, resolveMessageKey(), noCancel, trackSubmission(), ./$types (+11 more)

### Community 6 - "engine.ts"
Cohesion: 0.16
Nodes (29): allowedAllergen(), amountFor(), applyAllergenFocus(), applyAllergenFocusAndDedup(), assembleFullDayMeals(), buildMenu(), buildStarterMeal(), catalogSafe() (+21 more)

### Community 7 - ""../../../node_modules/.pnpm/@sinclair+typebox@0.31.28/node_modules/@sinclair/typebox/typebox.js""
Cohesion: 0.06
Nodes (36): "../../../node_modules/.pnpm/@sinclair+typebox@0.31.28/node_modules/@sinclair/typebox/typebox.js"(), Capitalize(), Check(), IntrinsicLiteral(), IsBoolean(), IsControlCharacterFree(), IsIntersectOptional(), IsNumber() (+28 more)

### Community 8 - "Bento UI/UX Redesign ("Joyful Bento") — Design"
Cohesion: 0.17
Nodes (12): Bento UI/UX Redesign ("Joyful Bento") — Design, Brand mark, Brand & visual identity, Components — impact table, Dark mode strategy, Goal, Non-goals, Open questions (+4 more)

### Community 9 - "i18n Scaffolding (paraglide-sveltekit, FR + EN) Implementation Plan"
Cohesion: 0.04
Nodes (45): i18n Scaffolding (paraglide-sveltekit, FR+EN) Implementation Plan, File map, Final verification, i18n Scaffolding (paraglide-sveltekit, FR + EN) Implementation Plan, Message-key naming convention, Task 1 — Infrastructure pilot, Task 2 — LocaleSwitcher component (TDD), Task 3 — Chrome + dialogs + error + cookies (string extraction) (+37 more)

### Community 10 - "Components"
Cohesion: 0.06
Nodes (31): Browser surfaces, Buttons, Cards / Containers, Chips, Colors, Components, Design System: Diversif, Do: (+23 more)

### Community 11 - "_helpers.ts"
Cohesion: 0.10
Nodes (15): axeSweep(), AxeViolation, formatViolations(), PUBLIC_ROUTES, TAGS, awaitHydration(), dismissWelcomeIfPresent(), expectBottomSheet() (+7 more)

### Community 12 - "schema.ts"
Cohesion: 0.06
Nodes (47): CleanupResult, runCleanup(), startCleanupTimer(), stopCleanupTimer(), Child, FoodEntry, IdempotencyKey, Invitation (+39 more)

### Community 13 - "tables.ts"
Cohesion: 0.13
Nodes (16): StageId, MenuInput, CATALOG, CHARCUTERIE_MATCHERS, CHOKING_BY_FOOD, INFANT_DAY, MEAL_TEMPLATES, MealId (+8 more)

### Community 14 - "guidance.ts"
Cohesion: 0.10
Nodes (28): ALLERGEN_GUIDANCE, AllergenGuidance, ALLERGY_SAFETY_SOURCES, APPROACHES, BentoStage, CATEGORY_GUIDANCE, CategoryGuidance, CHOKING_HAZARDS (+20 more)

### Community 15 - "db/index.ts"
Cohesion: 0.04
Nodes (63): App, Error, Locals, db, drizzleDb, pool, sqlite, children (+55 more)

### Community 16 - "db.ts"
Cohesion: 0.07
Nodes (69): FlowOutcome, formDataFromBody(), realActionResponder(), setup(), toEnvelopeResponse(), foodEntries, foods, _clearAllRateLimits() (+61 more)

### Community 17 - "Common Workflows"
Cohesion: 0.05
Nodes (39): Agent Rules, Analyze specific workspaces, Audit a project for cleanup opportunities, Catch typos in entry file exports, Check if a PR introduces quality risk, Commands, Common Workflows, Configuration (+31 more)

### Community 18 - "enabledPlugins"
Cohesion: 0.06
Nodes (37): source, enabledPlugins, chrome-devtools-mcp@claude-plugins-official, claude-md-management@claude-plugins-official, code-review@claude-plugins-official, code-simplifier@claude-plugins-official, commit-commands@claude-plugins-official, context7@claude-plugins-official (+29 more)

### Community 19 - "Tasks"
Cohesion: 0.05
Nodes (38): Task 10: DiscoverBento composer, Task 11: ChildCardRow component, Task 12: CoparentsSection component, Task 13: CompteSection component, Task 14: RgpdSection component, Task 15: ProfilBento composer, Task 16: monitor-timer utility + hook, Task 17: ReassuranceHero component (+30 more)

### Community 20 - "routes/+layout.svelte"
Cohesion: 0.11
Nodes (8): needRefresh, toastFn, updateServiceWorker, bentoKids, firstChildId, isAccountRoute, locale, refreshNeedsReauthIndicator()

### Community 21 - "SectionHeader.svelte"
Cohesion: 0.10
Nodes (3): baseProps, ./$types, ./$types

### Community 22 - "bun-test-utils.ts"
Cohesion: 0.08
Nodes (21): drainPool(), EndablePool, Logger, registerShutdownHandlers(), _resetShutdownState(), ShutdownOptions, makeHarness(), makeProc() (+13 more)

### Community 23 - "medical-audit-2026-05-08.md"
Cohesion: 0.07
Nodes (35): 1. `oeuf-cru` and `egg-fully-cooked` use the wrong age cliff, 2. "12 allergens per HCSP-2020" attribution is wrong, 3. Egg portion contradiction, 4. Walnut oil mistranslated as "knob of butter", A. Soja: ESPGHAN-permissive vs HCSP/ANSES-conservative, Audit findings that did NOT hold up under verification (detail), B. Allergen `recommendedAgeMonths: 6`, C. Meat / fish / egg grammage table (+27 more)

### Community 24 - "Foundation: Bento Tokens + shadcn-svelte Primitives — Implementation Plan"
Cohesion: 0.06
Nodes (35): Conventions, End of plan, Foundation: Bento Tokens + shadcn-svelte Primitives — Implementation Plan, Task 10: Restyle `Button.svelte`, Task 11: Restyle `Card.svelte`, Task 12: Restyle `Badge.svelte`, Task 13: Restyle `Input.svelte`, Task 14: Restyle `Label.svelte` (+27 more)

### Community 25 - "queue.ts"
Cohesion: 0.12
Nodes (24): purgeBeforeSubmit(), purgeClientState(), CachesLike, globalWithCaches, ActionError, ActionFailure, ActionRedirect, ActionResult (+16 more)

### Community 26 - "passkeys.ts"
Cohesion: 0.06
Nodes (59): audit(), webauthnChallenges, requireUser(), assertRpidOrigin(), AuthenticationResult, base64UrlToBuffer(), bufferToBase64Url(), buildAuthenticationOptions() (+51 more)

### Community 28 - "Fallow: Critical Gotchas"
Cohesion: 0.06
Nodes (33): Baseline Comparison Tracks Issue Identity, `--changed-since` Shows Only New Issues, Class Instance Members Are Tracked, Decorated Members Are Skipped By Default, Don't Create Config Unless Needed, Duplication Modes Affect What's Detected, Dynamically Loaded Files: Use `dynamicallyLoaded`, Exit Code 1 vs 2 (+25 more)

### Community 29 - "textures.ts"
Cohesion: 0.06
Nodes (9): filtered, baseClass, getTextureLabel(), LABEL_FNS, defaultTextureForAgeMonths(), TEXTURE_VALUES, TextureKey, ./$types (+1 more)

### Community 30 - "TSchema"
Cohesion: 0.27
Nodes (32): IntoBooleanResult(), IsAdditionalProperties(), IsOptionalNumber(), IsOptionalString(), IsStructuralRight(), StructuralRight(), TArray(), TAsyncIterator() (+24 more)

### Community 31 - "plugin-message-format.js"
Cohesion: 0.12
Nodes (24): escapeMarkupLiteral(), escapePatternText(), findPlaceholderClosingIndex(), flatten(), step(), isBuffer(), parseBundle(), parseDeclaration() (+16 more)

### Community 32 - "Observability — Sentry (server + client) — Design"
Cohesion: 0.08
Nodes (28): Sentry Setup Operator Runbook, 1. Create the Sentry project, 2. Create an internal integration auth token, 3. Wire env vars in Coolify, 4. Configure an alert rule, 5. Smoke test, 6. Privacy policy ack, Sentry New-Issue Alert Rule (+20 more)

### Community 33 - "content/symptoms.ts"
Cohesion: 0.17
Nodes (9): SEVERE, Severity, severityOf(), SYMPTOM_LABELS, SymptomLabel, symptomLabelText(), WARN, InsertSymptomInput (+1 more)

### Community 34 - "auth.ts"
Cohesion: 0.08
Nodes (40): appHandle(), handle(), handleError(), { captureExceptionMock, initMock }, CookieOpts, warnIfAddressHeaderMissing(), AuditEvent, ARGON_OPTS (+32 more)

### Community 35 - "Diversif"
Cohesion: 0.08
Nodes (23): 1. Before any deploy that includes a migration, 2. Deploy, 3. Rollback, Concurrency decision (lost updates), Deploy & migration runbook, Launch ops backlog (deferred from [`TOOLING_AUDIT.md`](./TOOLING_AUDIT.md)), Pre-launch environment gate, Signup & abuse controls (+15 more)

### Community 36 - "ignoreDependencies"
Cohesion: 0.08
Nodes (24): entry, ignoreBinaries, ignoreDependencies, @fontsource-variable/fraunces, @fontsource-variable/inter, prettier-plugin-svelte, prettier-plugin-tailwindcss, src/test/**! (+16 more)

### Community 37 - "scripts"
Cohesion: 0.08
Nodes (25): scripts, build, _bun_invocation_note, check, check:budget, check:watch, db:generate, db:push (+17 more)

### Community 38 - "Tasks"
Cohesion: 0.08
Nodes (24): Task 10: Extend `/child/new` action — call `createInvitationForChild` when checkbox set, Task 11: `BentoOptInBanner` component, Task 12: Add `?/optInBento` action on `/child/[id]` + wire `BentoOptInBanner` in legacy branch, Task 13: `LandingHeroBento` component, Task 14: `LandingFeaturesBento` component, Task 15: `LandingTrustBento` component, Task 16: `LandingClosingCtaBento` component, Task 17: Wire bento landing components into `/+page.svelte` (+16 more)

### Community 39 - ".fallowrc.json"
Cohesion: 0.08
Nodes (23): audit, gate, duplicates, minOccurrences, entry, health, maxCognitive, maxCrap (+15 more)

### Community 40 - "sources.ts"
Cohesion: 0.18
Nodes (11): makeFood(), makeMenu(), getQuantitiesForStage(), QUANTITIES, StageQuantities, ALL_SOURCE_IDS, Source, SourceId (+3 more)

### Community 41 - "dependencies"
Cohesion: 0.09
Nodes (23): clsx, drizzle-orm, @fontsource-variable/fraunces, @fontsource-variable/inter, @inlang/paraglide-js, dependencies, bits-ui, clsx (+15 more)

### Community 42 - "report/+page.server.ts"
Cohesion: 0.12
Nodes (20): rulePendingAllergens(), ALLERGEN_LABEL_RESOLVERS, ALLERGENS, countsAsAllergenExposure(), getAllergenLabel(), NOTE: this module is imported by server code (guidance/reminders,, toEpochMs(), CATEGORY_THRESHOLDS (+12 more)

### Community 43 - "Fallow CLI Reference"
Cohesion: 0.06
Nodes (32): Behavior, CI Integration, `ci`: Provider-Aware Review Automation, Combined Mode Flags, `config-schema`: Config JSON Schema, `config`: Show Resolved Config, Detected Source Configs, Environment Variables (+24 more)

### Community 44 - "Phase 2 — Menu engine + safety"
Cohesion: 0.09
Nodes (22): Final verification (run before opening each phase's PR), Global Constraints, Phase 1 — Quantités (ships alone; no engine, no schema), Phase 2 — Menu engine + safety, Phase 3 — Dietary exclusions, Quantités & Menu du jour Implementation Plan, Self-review notes (author), Task 10: `/child/[id]/menu` loader (+14 more)

### Community 45 - "Quantités & Menu du jour (meal engine)"
Cohesion: 0.09
Nodes (22): Components, Council review — rounds 1–3 addressed, Data flow, Data model, Delivery phases, Error handling / edge cases, Goals, i18n (+14 more)

### Community 46 - "export-user.ts"
Cohesion: 0.10
Nodes (17): args, childIds, ChildRow, db, EntryRow, FoodNameRow, inList, MembershipRow (+9 more)

### Community 47 - "Phase 3: App Shell + FAB Log Flow Implementation Plan"
Cohesion: 0.10
Nodes (20): Conventions, Created (new files), End of plan, File Structure, Modified, Phase 3: App Shell + FAB Log Flow Implementation Plan, Task 10: e2e — tab navigation, Task 11: e2e — FAB → log → save (+12 more)

### Community 48 - "Multi-ingredient Meals Implementation Plan"
Cohesion: 0.10
Nodes (20): File Structure, Final verification, Global Constraints, Multi-ingredient Meals Implementation Plan, Self-review notes (coverage map), Shared test helpers, Task 10: Meal-mode edit UI, Task 11: Dashboard recent feed — grouped meal cards (+12 more)

### Community 49 - "Allergen maintenance tracking"
Cohesion: 0.10
Nodes (20): Allergen maintenance tracking, Audit / event log, Components, Data flow, Data model, Error handling, Goal, i18n (+12 more)

### Community 50 - "Critique — /child/[id] (Aujourd'hui)"
Cohesion: 0.12
Nodes (16): Cognitive Load — 6 of 8 FAIL → HIGH (critical), Critique — /child/[id] (Aujourd'hui), Design Health Score — 23/40 (Acceptable), Design Specificity Verdict, Emotional Journey, Measured evidence, Minor Observations, [P1] A 60-day undismissable banner structurally outranks every actionable reminder (+8 more)

### Community 51 - "FoodCombobox.svelte"
Cohesion: 0.15
Nodes (3): foods, foods, customFoodSection()

### Community 52 - "Texture progression + Bilan pour le pédiatre"
Cohesion: 0.11
Nodes (19): Additions, Carnet & entry detail, CarnetStats — _« Textures explorées »_ tile, Data model, Default selection, Feature 1 — Texture progression, Feature 2 — Bilan pour le pédiatre, Goal (+11 more)

### Community 53 - "Visit"
Cohesion: 0.13
Nodes (19): ArrayType(), Create(), DateType(), Escape(), Extends(), IntrinsicRest(), IntrinsicTemplateLiteral(), IsArrayOfTuple() (+11 more)

### Community 54 - "dates.ts"
Cohesion: 0.42
Nodes (8): formatDateInputValue(), formatHHmm(), formatRelative(), formatTime(), isSameDay(), isValidBirthDate(), localInputToIso(), pad2()

### Community 55 - "Key screens"
Cohesion: 0.25
Nodes (8): Aujourd'hui (home), Auth — signup (first impression), Carnet, Découvrir, Key screens, Log sheet (FAB), Profil, Reaction detail (cheer-everywhere stress test)

### Community 56 - "Fallow: Common Workflow Patterns & Recipes"
Cohesion: 0.07
Nodes (27): Node.js Bindings, All-in-one with `--ci`, Combined Dead Code + Duplication, Cross-directory only, Duplication Threshold CI Gate, Fallow: Common Workflow Patterns & Recipes, Full audit (default), GitHub Code Scanning Integration (+19 more)

### Community 57 - "PWA Offline Log Queue Implementation Plan"
Cohesion: 0.11
Nodes (18): Conventions, File map, Final verification, PWA Offline Log Queue Implementation Plan, Task 10 — Mount QueueBadge + InstallPrompt in AppShell, Task 11 — Offline fallback page + workbox config, Task 12 — i18n keys (FR + EN), Task 13 — Playwright e2e smoke (+10 more)

### Community 58 - "UI Regression Coverage Implementation Plan"
Cohesion: 0.11
Nodes (18): Commit 1 — Infrastructure, Commit 2 — Extend existing specs, Commit 3 — New regression specs, File map, Spec reference, Task 10: `responsive-allergen-sheet.spec.ts` — the #179/#180 lock, Task 11: Verification — the load-bearing check, Task 12: Final review + ship (+10 more)

### Community 59 - "Multi-ingredient meals — design"
Cohesion: 0.11
Nodes (18): Allergen safety hint — keyed to never-tried count, not major-allergen count, Core correctness rule: reaction stays per-ingredient, Create flow — multi-select, Data model — group token, no new table, Edge cases, Edit / delete — extend `log/[entryId]`, no new route, Files touched, Goal (+10 more)

### Community 60 - "CI Pipeline Setup"
Cohesion: 0.12
Nodes (17): CI Pipeline Setup, GitHub Actions: Basic, GitHub Actions: Duplication Gate, GitHub Actions: Inline PR Annotations (No Advanced Security), GitHub Actions: PR-Scoped Check, GitHub Actions: PR-Scoped Duplication Check, GitHub Actions: Security Delta Gate, GitHub Actions: Severity-Aware PR Quality Gate (Audit) (+9 more)

### Community 61 - "Phase 7 — Cleanup & Flag Removal Implementation Plan"
Cohesion: 0.12
Nodes (17): Phase 7 — Cleanup & Flag Removal Implementation Plan, Task 10: Delete BentoOptInBanner, Task 11: Delete legacy AppShell + BottomNav, Task 12: Delete `/child/[id]/allergens/` redirect-only route, Task 13: Delete `feature-flags.ts`, Task 14: Clean up E2E specs — remove bento cookie manipulations, Task 15: Final sweep — run the whole local test suite + paraglide compile, Task 16: Open PR + watch CI (+9 more)

### Community 62 - "Route-loader Hardening — Design"
Cohesion: 0.12
Nodes (17): Route-loader Hardening Design, 1. Report query dedup (`src/routes/child/[id]/report/+page.server.ts`), 2. Log form action transaction (`src/routes/child/[id]/log/+page.server.ts`), Architecture, Components, Data flow / failure modes, Goal, Log Form Action Transaction Wrap (+9 more)

### Community 63 - "i18n Scaffolding (FR + EN, paraglide-sveltekit) — Design"
Cohesion: 0.12
Nodes (17): i18n Scaffolding (FR + EN, paraglide-sveltekit) Design, Architecture, Components, Data flow, Error handling / failure modes, Goal, i18n Scaffolding (FR + EN, paraglide-sveltekit) — Design, LocaleSwitcher Component (+9 more)

### Community 64 - "i18n dead-key trim — design"
Cohesion: 0.12
Nodes (17): Architecture, Companion bundles, Components, Data flow, Detection algorithm, Error handling, Goal, i18n dead-key trim — design (+9 more)

### Community 65 - "IsOpenParen"
Cohesion: 0.21
Nodes (17): And(), Group(), Range(), Const(), Generate(), InGroup(), IsCloseParen(), IsGroup() (+9 more)

### Community 66 - "Quantités & Menu du jour Implementation Plan"
Cohesion: 0.17
Nodes (16): Quantités & Menu du jour Implementation Plan, Engine Determinism Constraint, PROTEIN_WEEK Rotation, quantities.ts Content Module, QuantitiesCard Component, Allergen Maintenance Tracking Design, 'fading' Allergen State, Four-Day Maintenance Threshold (+8 more)

### Community 67 - "compilerOptions"
Cohesion: 0.12
Nodes (15): ./.svelte-kit/tsconfig.json, compilerOptions, allowJs, checkJs, esModuleInterop, forceConsistentCasingInFileNames, moduleResolution, resolveJsonModule (+7 more)

### Community 68 - "bun-test.ts"
Cohesion: 0.13
Nodes (12): applyNextMarker(), args, collectFiles(), covRoot, failedFiles, files, parseIgnoredLines(), passthroughFlags (+4 more)

### Community 69 - "Migration plan (seven phases, every commit shippable)"
Cohesion: 0.25
Nodes (8): Migration plan (seven phases, every commit shippable), Phase 1 — Foundation: tokens, fonts, gitignored brand assets (~½ day), Phase 2 — Primitive layer (~1 day), Phase 3 — App shell + log Sheet (~2–3 days), Phase 4 — Aujourd'hui + Carnet (~2–3 days), Phase 5 — Découvrir + Profil + Reaction detail (~2 days), Phase 6 — Auth + onboarding + landing + legal pages (~1–2 days), Phase 7 — Cleanup & flag removal (~½ day)

### Community 70 - "rate-limit.ts"
Cohesion: 0.06
Nodes (44): verifyPassword(), hasUniqueShape(), isUniqueViolation(), isE2E(), FRESH_AUTH_LIMIT, requireFreshAuth(), requireFreshAuthWithKey(), Result (+36 more)

### Community 71 - "DEPLOY.md"
Cohesion: 0.17
Nodes (15): DEPLOY.md, ADDRESS_HEADER / reverse-proxy client-IP trust config, Backup + verify-before-trust procedure (VACUUM INTO + db:verify-backup), Co-parent concurrency: last-write-wins decision, Litestream → Cloudflare R2 continuous backup replication, Session tokens hashed at rest (sha256); pre-hashing backups carry raw tokens, docker-compose.yml — local dev / self-hosting compose file, 'app' service — diversif-app container (+7 more)

### Community 72 - "PRODUCT.md — Diversif product register"
Cohesion: 0.15
Nodes (15): Foundation: Bento Tokens + shadcn-svelte Primitives Implementation Plan, Phase 3: App Shell + FAB Log Flow Implementation Plan, Phase 7 — Cleanup & Flag Removal Implementation Plan, Bento design-token palette (light + dark CSS variables), 8 restyled + 14 new shadcn-svelte-style UI primitives, 4-tab bottom nav + center FAB log-sheet flow, 'bentoEnabled' feature flag (owner allow-list + bento=1 cookie override), Delete bentoEnabled flag and every legacy branch it gated — bento becomes the only UI (+7 more)

### Community 73 - "Bundle 1 — Foundation primitives (Implementation Plan)"
Cohesion: 0.13
Nodes (15): Bundle 1 — Foundation primitives (Implementation Plan), File structure, Out of band, Self-review checklist (run before declaring the plan ready), Task 10: Extend `Card` with `padding` prop, Task 11: Refresh graphify + final verification + PR, Task 1: Add shared paraglide message keys, Task 2: Create `Field` primitive (+7 more)

### Community 74 - "Design"
Cohesion: 0.13
Nodes (15): Context (verified), Cutover / rollback / backups, Data migration (`scripts/migrate-pg-to-sqlite.ts`), DB client (`index.ts`), Decisions (confirmed with operator), Deployment (Coolify → CT 103, Railpack kept), Design, diversif: Postgres → SQLite migration (on the Bun stack) (+7 more)

### Community 75 - "PRODUCT.md — Diversif"
Cohesion: 0.13
Nodes (14): Anti-references, Anti-user — the developer who wants a "feature-rich tracker", Brand & visual identity, Palette tokens, Primary — the parent of a baby aged 4–12 months, PRODUCT.md — Diversif, Secondary — the co-parent, Strategic principles (+6 more)

### Community 76 - "railpack.json"
Cohesion: 0.13
Nodes (14): deploy, startCommand, variables, variables, packages, bun, provider, $schema (+6 more)

### Community 77 - "check-i18n-unused.ts"
Cohesion: 0.15
Nodes (13): collectKeepTokens(), data, dead, EXCLUDED_DIRS, haystack, ingestSourceFile(), keepTokens, keys (+5 more)

### Community 78 - "useBottomSheetDrag"
Cohesion: 0.23
Nodes (14): BottomSheetDrag, BottomSheetDragOptions, findScrollable(), isInteractive(), useBottomSheetDrag(), clearTimer(), commitPendingGesture(), driveScrollHandoff() (+6 more)

### Community 79 - "Information architecture"
Cohesion: 0.33
Nodes (6): 4-tab shell, Center FAB, Desktop variant (≥ 1024px), Information architecture, Multi-child header, Wide desktop variant (≥ 1440px)

### Community 80 - "log/+page.server.ts"
Cohesion: 0.10
Nodes (25): idempotencyKeys, Executor, loadVisibleFoodsForChild(), ResolveFoodInput, ResolveFoodResult, resolveOrInsertFood(), visibleToChild(), IdempotencyInFlight (+17 more)

### Community 81 - "Sentry Observability Implementation Plan"
Cohesion: 0.20
Nodes (10): File map, Final verification, Sentry Observability Implementation Plan, Task 1 — Install deps and document env vars, Task 2 — `scrubEvent` module (TDD), Task 3 — Server SDK init and `handleError` integration (TDD), Task 4 — Client hook, Task 5 — Source-map upload via `@sentry/vite-plugin` (+2 more)

### Community 82 - "Task 5: Visual-fix batch"
Cohesion: 0.29
Nodes (7): 5a. Modal scrollable body, 5b. BentoMark radius, 5c. duration-200 → duration-base, 5d. .discover-group inline CSS, 5e. .tap-target utility, 5f. Radius rule comment, Task 5: Visual-fix batch

### Community 83 - "Bun Migration Implementation Plan"
Cohesion: 0.14
Nodes (14): Bun Migration Implementation Plan, Decisions locked, File-level structure, Phase 1 — Toolchain, Phase 2 — Argon2 swap, Phase 4 — Adapter swap, Phase 6 — Scripts, Phase 7 — CI (+6 more)

### Community 84 - "PWA Offline Log Queue (+ Install CTA + Offline Fallback) — Design Spec"
Cohesion: 0.14
Nodes (14): Architecture, Edge cases, Endpoint integration sketch, File map, Manifest/icons audit (pre-flight), Out of scope (could come later), Problem, Public API (+6 more)

### Community 85 - "Phase 5 — Découvrir + Profil + Reaction Detail — Design Spec"
Cohesion: 0.14
Nodes (14): Data flow, Découvrir (replaces `/child/[id]/guide` body when flag on), Goal, Information architecture, Key screens, Migration / sequencing, Non-goals, Open questions (+6 more)

### Community 86 - "Codebase simplification — 6-bundle DRY/coherence pass"
Cohesion: 0.14
Nodes (14): Bundle 1 — Foundation primitives, Bundle 2 — Visual coherence sweep, Bundle 3 — Forms + destructive modals migration, Bundle 4 — Server boilerplate kill, Bundle 5 — Copy & i18n cleanup, Bundle 6 — Cleanup tail, Codebase simplification — 6-bundle DRY/coherence pass, Decisions (locked during brainstorm 2026-05-21) (+6 more)

### Community 87 - "UI regression coverage — design"
Cohesion: 0.14
Nodes (14): Architecture, Companion bundles, Components & specs, Data flow, Error handling & flake budget, Extending existing specs (add `@responsive` + mobile-aware assertions), Goal, Helpers (`e2e/_helpers.ts`) (+6 more)

### Community 88 - "TLiteral"
Cohesion: 0.19
Nodes (14): TAnyRight(), TArrayRight(), TBooleanRight(), TIntegerRight(), TLiteral(), TLiteralBoolean(), TLiteralNumber(), TLiteralString() (+6 more)

### Community 89 - "sentry.ts"
Cohesion: 0.23
Nodes (10): eventRoute(), filterIncomingBreadcrumb(), ScrubbableEvent, scrubBreadcrumbData(), scrubBreadcrumbs(), scrubEvent(), scrubException(), scrubPathname() (+2 more)

### Community 90 - "Design tokens"
Cohesion: 0.40
Nodes (5): Color tokens (dark), Color tokens (light), Design tokens, Glow shadow, Motion

### Community 91 - "Testing & accessibility"
Cohesion: 0.40
Nodes (5): A11y, Existing tests, Performance, Testing & accessibility, Visual regression

### Community 92 - "Allergen maintenance tracking Implementation Plan"
Cohesion: 0.15
Nodes (13): Allergen maintenance tracking Implementation Plan, Allergen maintenance tracking Implementation Plan, Create, File map, Modify (8 files), Self-review checklist (run once, fix inline), Task 1: Add i18n strings for the new state, Task 2: Render the `'fading'` state on the Carnet allergens pill (+5 more)

### Community 93 - "Texture Progression + Bilan pour le pédiatre Design"
Cohesion: 0.19
Nodes (13): Texture Progression + Bilan pour le pédiatre Design, Allergen Status Block (Report), "Bilan pour le pédiatre" Report Reframe, Categorical Texture UX Trade-off, TexturePicker Component, Codebase Simplification — 6-Bundle DRY/Coherence Pass Design, Bundle 1 — Foundation Primitives (Field, ConfirmModal, Callout), Bundle 4 — Server Boilerplate Kill (requireChildContext, parseForm) (+5 more)

### Community 94 - "overrides"
Cohesion: 0.15
Nodes (13): overrides, baseline-browser-mapping, browserslist, cookie, devalue, esbuild, fast-uri, nanoid (+5 more)

### Community 95 - "TObjectRight"
Cohesion: 0.27
Nodes (13): IsObjectArrayLike(), IsObjectBigIntLike(), IsObjectBooleanLike(), IsObjectConstructorLike(), IsObjectDateLike(), IsObjectFunctionLike(), IsObjectNumberLike(), IsObjectPromiseLike() (+5 more)

### Community 96 - "reaction-values.ts"
Cohesion: 0.10
Nodes (18): FoodIcon, #each(), InsertSymptomResult, RecentEntry, formatDate(), groupByMeal(), MealGroup, REACTION_RANK (+10 more)

### Community 97 - "pre-launch-check SKILL"
Cohesion: 0.21
Nodes (12): pre-launch-check SKILL, Gate (run in this order), Notes, pre-launch-check, Report, dependency-cruiser (architecture boundaries), CI workflow (ci.yml), knip (dead code / unused deps & exports) (+4 more)

### Community 98 - "Late reaction promotion — implementation plan"
Cohesion: 0.17
Nodes (12): File structure, Late reaction promotion — implementation plan, Notes for the executor, Severity mapping (resolved open question), Task 1: Extend `AuditEvent` union, Task 2: Failing action tests for promotion + audit (TDD red), Task 3: Make `insertSymptom` promote inside a transaction, Task 4: Update the `addSymptom` action and emit the audit event (+4 more)

### Community 99 - "PR 2 — Bilan pour le pédiatre"
Cohesion: 0.17
Nodes (12): Texture Progression + Bilan pour le pédiatre Implementation Plan, File Structure, PR 2 — Bilan pour le pédiatre, Self-Review Notes, Task 11: Priority-first allergen ordering + isPriority flag in the report loader, Task 12: Stage status block (current stage + texture gap), Task 13: Textures distribution mini-bar (last 30 days), Task 14: Print stylesheet + _« Imprimer »_ button + nav rename (+4 more)

### Community 100 - "Late reaction promotion on a `ras` food entry"
Cohesion: 0.17
Nodes (12): After submit, Audit / event log, Data model, French copy, Goal, Late reaction promotion on a `ras` food entry, Non-goals, Open questions for the plan (+4 more)

### Community 101 - "Discover tab — grouped layout"
Cohesion: 0.12
Nodes (16): API: `DiscoverGroup.svelte`, Dark mode, Discover tab — grouped layout, Files touched, Group container (`DiscoverGroup.svelte`), Group order, Layout structure, Risk / open items (+8 more)

### Community 102 - "Modal.svelte"
Cohesion: 0.20
Nodes (6): drag, handleOpenChange(), isDesktop, string, dragSheet(), getSheetTargets()

### Community 103 - "Component primitives (shadcn-svelte)"
Cohesion: 0.40
Nodes (5): Add (new primitives), Component primitives (shadcn-svelte), Keep (bespoke domain components), Replace (regenerate from CLI, restyled with bento tokens), Replace with new shell

### Community 104 - "seo.ts"
Cohesion: 0.17
Nodes (18): absoluteUrl(), articleJsonLd(), BreadcrumbItem, breadcrumbJsonLd(), faqPageJsonLd(), organizationJsonLd(), SeoInput, SITE (+10 more)

### Community 105 - "localized-href.ts"
Cohesion: 0.07
Nodes (7): recordLabel, showRecord, streakUnit, weekLabel, cn(), localizedHref(), ./$types

### Community 106 - "devDependencies"
Cohesion: 0.06
Nodes (33): drizzle-kit, eslint-config-prettier, globals, happy-dom, @happy-dom/global-registrator, lint-staged, devDependencies, drizzle-kit (+25 more)

### Community 107 - "webauthn-auth-reviewer subagent"
Cohesion: 0.18
Nodes (11): webauthn-auth-reviewer subagent, Cross-cutting, Output, Session & hashing, What to check (WebAuthn ceremony — the high-value bugs), migration 0002_purge_sessions_for_token_hashing, @simplewebauthn/server, src/lib/server/auth.ts (+3 more)

### Community 108 - "Testing & accessibility"
Cohesion: 0.40
Nodes (5): Accessibility, E2E (Playwright, mobile viewport pinned), Testing & accessibility, Unit / component (vitest, 100% coverage gate enforced), Visual regression

### Community 109 - "PR 1 — Texture progression"
Cohesion: 0.18
Nodes (11): PR 1 — Texture progression, Task 10: Run the full quality bar before opening PR 1, Task 1: Texture utils module + types, Task 2: Schema column + migration + migration test, Task 3: Form action accepts and persists `texture`, Task 4: `TexturePicker.svelte` component, Task 5: Wire `TexturePicker` into the log sheet, Task 6: Feed badge + entry detail row (+3 more)

### Community 110 - "Discover tab grouped layout — Implementation Plan"
Cohesion: 0.18
Nodes (11): Discover tab grouped layout Implementation Plan, Discover tab grouped layout — Implementation Plan, Self-Review Notes, Task 0: Branch + paraglide baseline, Task 1: Add the three i18n keys, Task 2: Create the `DiscoverGroup` component (TDD), Task 3: Add CSS rules for `[data-tint]` and the label, Task 4: Wire `DiscoverGroup` into `DiscoverBento.svelte` (+3 more)

### Community 111 - "Phase 5 — Test framework migration (the big one)"
Cohesion: 0.18
Nodes (11): Phase 5 — Test framework migration (the big one), Step 5a — `bunfig.toml`, Step 5b — `bunfig.preload.ts`, Step 5c — Move vitest test config out of `vite.config.ts`, Step 5d — Codemod the 195 test files, Step 5e — Hand-fix residue, Step 5f — Update `package.json` scripts, Step 5g — Run the suite (+3 more)

### Community 112 - "Multi-ingredient Meals Implementation Plan"
Cohesion: 0.27
Nodes (11): Multi-ingredient Meals Implementation Plan, groupByMeal Pure Helper, mealId Group Token Column, Reaction Stays Per-Ingredient Rule, seedMeal Test Helper, Multi-ingredient Meals Design, Reaction Stays Per-Ingredient Core Rule, groupByMeal Grouping Helper (+3 more)

### Community 113 - "Bento UI/UX Redesign ("Joyful Bento") Design"
Cohesion: 0.22
Nodes (11): Bento UI/UX Redesign ("Joyful Bento") Design, Bento Design Metaphor / Pastel Palette, Bento Color Design Tokens (CSS variables), bentoEnabled Feature Flag, 4-Tab Shell IA (Aujourd'hui/Carnet/Découvrir/Profil), shadcn-svelte Component Adoption, Phase 6 — Auth + Onboarding + Landing + Legal Design, BentoAuthLayout Component (+3 more)

### Community 114 - "Phase 5 — Découvrir + Profil + Reaction Detail Design"
Cohesion: 0.18
Nodes (14): Phase 5 — Découvrir + Profil + Reaction Detail Design, useMonitorTimer 30-min Countdown, Print Food Entry Page, ReactionDetailBento Component, SevereRail tel:15 Component, severityOf Symptom Severity Function, symptoms Table, Late Reaction Promotion on a 'ras' Food Entry Design (+6 more)

### Community 115 - "Reproducible Claude Code setup — design"
Cohesion: 0.18
Nodes (11): Reproducible Claude Code Setup Design, Decisions (confirmed with owner), Deliverables, Hybrid Reference+Vendor Mechanism, Inventory (as discovered), Local (uncommitted) cleanup, Reproducible Claude Code setup — design, Security (+3 more)

### Community 116 - "check-bundle-size.ts"
Cohesion: 0.18
Nodes (8): BUDGET_PATH, CLIENT_DIR, jsFiles, ROOT, STATIC_DIR, staticFiles, totalJs, violations

### Community 117 - "reminders.ts"
Cohesion: 0.09
Nodes (27): EnrichedEntry, MaintainCandidate, push(), Reminder, ReminderInput, ruleCategoryImbalance(), RuleContext, ruleForbiddenFoods() (+19 more)

### Community 118 - "timeline.ts"
Cohesion: 0.22
Nodes (5): execRows(), Executor, CoparentEntry, StreakStats, mealPlusSingleton

### Community 119 - "Phase 5 — Découvrir + Profil + Reaction Detail Implementation Plan"
Cohesion: 0.22
Nodes (10): Phase 5 — Découvrir + Profil + Reaction Detail Implementation Plan, File structure, Phase 5 — Découvrir + Profil + Reaction Detail Implementation Plan, Pre-flight context, Self-review summary, Late reaction promotion — implementation plan, 'food_entry.reaction_promoted' audit event, severityOf-driven ras→inconfort/reaction promotion mapping (+2 more)

### Community 120 - "Perf budget Implementation Plan"
Cohesion: 0.20
Nodes (10): File map, Perf budget Implementation Plan, Self-review, Spec reference, Task 1: Measure the baseline, Task 2: Write `scripts/check-bundle-size.mjs`, Task 3: Write `scripts/bundle-budget.json`, Task 4: Add `check:budget` script + wire CI job (+2 more)

### Community 121 - "UI Regression Coverage Implementation Plan"
Cohesion: 0.29
Nodes (10): UI Regression Coverage Implementation Plan, data-side Attribute on Modal Root, expectBottomSheet / expectNotBottomSheet Helpers, Mobile Playwright Project (iPhone 14), uniqueForWorker Test Helper, bun test Runner Migration (195 files), UI Regression Coverage Design (Bundle A), Replay-the-Broken-Commit Verification (+2 more)

### Community 122 - "A11y audit — design"
Cohesion: 0.11
Nodes (20): A11y Audit Design (Bundle C), A11y audit — design, Architecture, axe-core Playwright A11y Gate, Companion bundles, Components, Data flow, Dependencies (+12 more)

### Community 123 - "project.inlang/settings.json"
Cohesion: 0.20
Nodes (9): baseLocale, locales, modules, plugin.inlang.messageFormat, pathPattern, $schema, en, fr (+1 more)

### Community 124 - "categories.ts"
Cohesion: 0.22
Nodes (12): getCategoryIcon(), CATEGORIES, CATEGORY_IDS, CATEGORY_LABEL_RESOLVERS, CategoryClasses, CategoryColor, CLASS_MAP, getCategoryClasses() (+4 more)

### Community 125 - "passkey-client.ts"
Cohesion: 0.24
Nodes (6): authenticateWithPasskey(), PasskeyAuthResult, PasskeyErrorKey, signInWithPasskey(), FakeResponse, toastErrorCalls

### Community 126 - "seed.ts"
Cohesion: 0.33
Nodes (7): AnyDb, applySeedCorrections(), FOODS_SEED, SeedFood, seedFoods(), Tx, CategoryId

### Community 127 - "CLAUDE.md hard rules"
Cohesion: 0.21
Nodes (11): CLAUDE.md hard rules, French UI, no anglicisms convention, graphify knowledge-graph workflow rules, Claude Code cloud session reproducibility (fresh clone + setup script), External graphify CLI prerequisite (no public installer), PreToolUse/PostToolUse hooks (graphify nudge, code-review-on-push, format-edited, council-on-brainstorm), Committed .claude/settings.json plugin/marketplace auto-install, hookify: block-no-verify (+3 more)

### Community 129 - "tenant-isolation-auditor subagent"
Cohesion: 0.22
Nodes (9): tenant-isolation-auditor subagent, How to audit, Output, What "correct" looks like in this codebase, countNthExposition (src/lib/server/db/symptoms.ts), insertSymptom (src/lib/server/db/symptoms.ts), listSymptomsByEntry (src/lib/server/db/symptoms.ts), requireChildContext scope guard (+1 more)

### Community 131 - "JSON Output Structure"
Cohesion: 0.22
Nodes (9): `actions` Array, `baseline_deltas` Object, Combined output (`fallow` with no subcommand), `dead-code` output, `dupes` output, Error output (exit code 2), `fix` output (dry-run), Health `actions` array (CRAP findings) (+1 more)

### Community 133 - "Route-loader Hardening Implementation Plan"
Cohesion: 0.22
Nodes (9): Route-loader Hardening Implementation Plan, File map, Final verification, Route-loader Hardening Implementation Plan, Task 1 — Report query dedup (TDD), Task 2 — Log action transaction with sentinel pattern (TDD), Idempotency-Key header + idempotency_keys table dedupe design, Dedup redundant allergen SQL scan — derive aggregation in memory from existing 'entries' (+1 more)

### Community 134 - "Bun Migration Implementation Plan"
Cohesion: 0.25
Nodes (9): Bun Migration Implementation Plan, Bun.password Argon2id Hashing, bun:sql Postgres Driver, PGlite In-Process Test DB, svelte-adapter-bun HTTP Adapter, diversif: Postgres → SQLite Migration (on the Bun stack), Big-Bang Cutover Risk Acceptance, bun:sqlite + drizzle-orm/bun-sqlite Driver (+1 more)

### Community 135 - "Phase 6 — Auth + Onboarding + Landing + Legal — Design Spec"
Cohesion: 0.22
Nodes (9): Data flow, Goal, Information architecture, Migration / sequencing, Non-goals, Open questions, Phase 6 — Auth + Onboarding + Landing + Legal — Design Spec, Privacy / PII posture (+1 more)

### Community 136 - "Perf budget — design"
Cohesion: 0.13
Nodes (15): Architecture, Companion bundles, Components, Data flow, Error handling, `.github/workflows/ci.yml` (modified), Goal, Non-goals (+7 more)

### Community 137 - "[id]/+page.server.ts"
Cohesion: 0.14
Nodes (23): loadAllergenRows(), loadAllergenStatus(), summarizeAllergenRows(), dismissReminder(), loadDismissals(), ttlForReminderKey(), DiversityMetrics, loadDiversityMetrics() (+15 more)

### Community 140 - "Testing Diversif Locally"
Cohesion: 0.25
Nodes (7): Auth Flow (Browser), Child Age & Stages, Devin Secrets Needed, Key Navigation, Prerequisites, Testing Diversif Locally, Tips

### Community 141 - "`license`: Manage Continuous Runtime License"
Cohesion: 0.25
Nodes (8): Actionable error messages, `activate` flags, Clock skew, Exit Codes, Grace ladder, `license`: Manage Continuous Runtime License, Storage precedence, Subcommands

### Community 142 - "`health`: Function Complexity & File Health Analysis"
Cohesion: 0.25
Nodes (8): Examples, Exit Codes, Flags, `health`: Function Complexity & File Health Analysis, Health Trend, JSON Output Structure, Vital Signs, Vital Signs Snapshots

### Community 143 - "Custom Plugin Setup"
Cohesion: 0.50
Nodes (4): Custom Plugin Setup, Option 1: Inline framework config, Option 2: External plugin file, Option 3: Plugin directory

### Community 144 - "Claude Code setup — reproducible everywhere"
Cohesion: 0.25
Nodes (8): Claude Code on the web (cloud), Claude Code setup — reproducible everywhere, External prerequisite: graphify, Secrets — important, TL;DR, Updating the setup, What reproduces automatically (no script), What the script restores

### Community 145 - "Phase 6 — Auth + Onboarding + Landing + Legal Implementation Plan"
Cohesion: 0.25
Nodes (8): Phase 6 — Auth + Onboarding + Landing + Legal Implementation Plan, File structure, Final verification (no separate task, run before pushing), Phase 6 — Auth + Onboarding + Landing + Legal Implementation Plan, Pre-flight context, Self-review summary, Flip bento flag default-on for new signups via bento=1 cookie, Extract shared createInvitationForChild server helper

### Community 146 - "Perf Budget Implementation Plan"
Cohesion: 0.43
Nodes (7): Perf Budget Implementation Plan, bundle-budget.json Thresholds, check-bundle-size.mjs Script, bundle-budget CI Job, Perf Budget Design (Bundle D), bundle-budget.json, Baseline × 1.2 Threshold Strategy

### Community 147 - "package.json"
Cohesion: 0.17
Nodes (12): license, lint-staged, *.{json,md,css,html}, *.{ts,js,svelte}, name, private, trustedDependencies, type (+4 more)

### Community 148 - "verify-backup-restore.ts"
Cohesion: 0.25
Nodes (4): Counts, CRITICAL_TABLES, MUST_BE_NONEMPTY, SKIP_TABLES

### Community 149 - "profile/page.server.test.ts"
Cohesion: 0.20
Nodes (9): parseForm(), ParseFormResult, parseFormWithKey(), ParseFormWithKeyResult, schema, actions, load(), profileSchema (+1 more)

### Community 150 - "getLegalIdentity"
Cohesion: 0.23
Nodes (7): getLegalIdentity(), LegalIdentity, read(), KEYS, original, load(), load()

### Community 151 - "ageInMonths"
Cohesion: 0.15
Nodes (11): dayFormats, dayLabels, formatDDMMYY(), parisDay(), beforeLocalMidnight, localMidnightPlus30, ageInMonths(), formatAge() (+3 more)

### Community 152 - "Bundle 2 — Visual coherence sweep (Implementation Plan)"
Cohesion: 0.20
Nodes (11): Bundle 1 — Foundation primitives Implementation Plan, Bundle 2 — Visual coherence sweep Implementation Plan, Bundle 2 — Visual coherence sweep (Implementation Plan), Decision notes (carry forward to writing-plans or directly inline), Task 1: Amber-callout migration, Task 2: Pill-CTA migration, Task 3: Section-label migration, Task 4: Outro-CTA migration (+3 more)

### Community 153 - "allergen-status.ts"
Cohesion: 0.19
Nodes (11): Aggregate, aggregateRows(), AllergenItem, AllergenRow, deriveState(), mergeAggregate(), PRIORITY_SET, seedAggregate() (+3 more)

### Community 154 - "Monorepo Analysis"
Cohesion: 0.40
Nodes (5): Analyze a single package, Analyze the full monorepo, List all discovered files across workspaces, Monorepo Analysis, Per-package CI

### Community 156 - "Sentry Observability Implementation Plan"
Cohesion: 0.29
Nodes (7): Use Bun, not npm/Node convention, GlitchTip self-hosted Sentry-SDK-compatible error monitoring option, Sentry Observability Implementation Plan, PWA Offline Log Queue Implementation Plan, IndexedDB offline log queue + replay-on-reconnect, scrubEvent PII-scrubbing design (strict posture, errorId-only correlation), Two Sentry SDK init points (hooks.server.ts / hooks.client.ts) sharing scrubEvent as beforeSend

### Community 157 - "PARKING_LOT.md"
Cohesion: 0.25
Nodes (7): INVITE_ONLY signup abuse control (dormant lever), Email verification / transactional mail sender, Explicitly out of scope for the hardening pass, PARKING_LOT.md, Email verification / transactional mail sender deferred, Off-box backup scheduling (Litestream → R2), Parking lot

### Community 158 - "`coverage`: Production-Coverage Workflow"
Cohesion: 0.29
Nodes (7): `analyze` flags, `coverage`: Production-Coverage Workflow, `coverage upload-source-maps` flags, Environment, Exit Codes, `setup` flow, `upload-inventory` flags

### Community 159 - "`fix`: Auto-Remove Unused Code"
Cohesion: 0.29
Nodes (7): Examples, File encoding contract, `fix`: Auto-Remove Unused Code, Flags, Low-confidence export removals, On-disk drift protection, What gets fixed

### Community 160 - "Full Project Audit"
Cohesion: 0.29
Nodes (7): Full Project Audit, Step 1: Run full analysis, Step 2: Review issue counts, Step 3: Find duplication, Step 4: Preview auto-fix, Step 5: Apply fixes (after user confirmation), Step 6: Verify

### Community 161 - "Safe Auto-Fix Workflow"
Cohesion: 0.29
Nodes (7): Safe Auto-Fix Workflow, Step 1: Dry-run first, Step 2: Review each proposed change, Step 3: Confirm with user before applying, Step 4: Apply, Step 5: Verify, Step 6: Run project tests

### Community 162 - "i18n-add-key/SKILL.md"
Cohesion: 0.14
Nodes (16): scripts/check-i18n-unused.mjs, scripts/check-i18n-unused.ts, i18n-add-key, Pitfalls, Steps, scripts/compile-paraglide.ts, hookify: block-generated-paraglide, hookify: verify-i18n-on-message-edit (+8 more)

### Community 163 - "Phase 3 — DB layer"
Cohesion: 0.29
Nodes (7): Phase 3 — DB layer, Step 3a — Install drivers, Step 3b — Rewrite `src/lib/server/db/index.ts`, Step 3c — Rewrite `src/test/db.ts` for PGlite, Step 3d — Audit `pg-mem`-aware code, Step 3e — Verify, Step 3f — Commit

### Community 164 - "Testing & accessibility"
Cohesion: 0.29
Nodes (7): Accessibility, E2E (Playwright, mobile viewport pinned 414×896), Existing tests, Server tests, Testing & accessibility, Unit/component (vitest, 100% coverage gate enforced), Visual regression

### Community 165 - "Architecture"
Cohesion: 0.29
Nodes (7): Architecture, Components added (~6), Database migration, Feature flag posture, Onboarding form action, Opt-in form action, Routes

### Community 166 - "create-migration/SKILL.md"
Cohesion: 0.38
Nodes (6): create-migration, If a just-generated migration is wrong, Steps, drizzle/meta/_journal.json, hookify: block-applied-migration-edit, src/lib/server/db/schema.ts

### Community 167 - "renovate.json"
Cohesion: 0.29
Nodes (6): config:recommended, helpers:pinGitHubActionDigests, extends, packageRules, platformAutomerge, $schema

### Community 175 - "`audit`: Changed-File Quality Gate"
Cohesion: 0.33
Nodes (6): `audit`: Changed-File Quality Gate, Examples, Flags, JSON contract: which fields are severity-aware, JSON Output Structure, Verdicts

### Community 176 - "Debugging False Positives"
Cohesion: 0.33
Nodes (6): Debugging False Positives, If the trace shows it IS used, If the trace shows it's NOT used, Trace a dependency, Trace all edges for a file, Trace an export's usage chain

### Community 177 - "Incremental Adoption with Baselines"
Cohesion: 0.33
Nodes (6): Duplication baseline, Incremental Adoption with Baselines, Step 1: Save current state as baseline, Step 2: Commit the baseline, Step 3: CI only fails on NEW issues, Step 4: Gradually fix and update baseline

### Community 178 - "PWA Offline Log Queue Design"
Cohesion: 0.47
Nodes (6): PWA Offline Log Queue Design, Workbox BackgroundSync Rejected, idempotency_keys Table, InstallPrompt Component, Offline Log Queue (IndexedDB), withIdempotencyKey Function

### Community 179 - "Testing strategy"
Cohesion: 0.33
Nodes (6): Coverage, E2E (`tests/offline.spec.ts`), Integration (existing `page.server.test.ts`), Not tested at e2e, Testing strategy, Unit (vitest)

### Community 180 - "Architecture"
Cohesion: 0.33
Nodes (6): Architecture, Components added (~22), Database migration, Feature flag, Routes, Symptom vocabulary and severity

### Community 184 - "Throw"
Cohesion: 0.33
Nodes (6): RecordKey(), RecordValue(), Throw(), TNot(), TTemplateLiteral(), UnwrapTNot()

### Community 185 - "scripts/cleanup.ts"
Cohesion: 0.33
Nodes (5): challenges, db, invitations, now, sessions

### Community 186 - "generate-icons.ts"
Cohesion: 0.40
Nodes (5): chunk(), cream, makePng(), out, sage

### Community 187 - "lint-contrast.ts"
Cohesion: 0.08
Nodes (37): Background, backgroundFromCardVariant(), backgroundFromClass(), bareUtility(), checkSvelteFile(), closeTag(), ContrastOffender, contrastOffenders (+29 more)

### Community 188 - "list-stale-users.ts"
Cohesion: 0.33
Nodes (4): db, rows, stale, StaleRow

### Community 191 - "healthz/+server.ts"
Cohesion: 0.40
Nodes (4): GET(), NO_STORE, startedAt, { get }

### Community 193 - "Diversif — Claude context"
Cohesion: 0.40
Nodes (4): Conventions Claude must respect, Diversif — Claude context, graphify, Orientation

### Community 195 - "Guard `git push` with a Claude Code PreToolUse hook"
Cohesion: 0.40
Nodes (5): `.claude/hooks/fallow-gate.sh`, `.claude/settings.json`, Distinguish from `fallow hooks install --target git`, Guard `git push` with a Claude Code PreToolUse hook, Remove the hook

### Community 197 - "Migration from jscpd"
Cohesion: 0.40
Nodes (5): Detection mode mapping, Migration from jscpd, Step 1: Preview migration, Step 2: Apply migration, Step 3: Compare results

### Community 199 - "litestream.yml replication config"
Cohesion: 0.40
Nodes (5): getDb (src/lib/server/db/index.ts), docker-compose litestream service, litestream.yml replication config, Graphify memory: resetTestDb query, resetTestDb (src/test/db.ts)

### Community 200 - "Data flow"
Cohesion: 0.40
Nodes (5): Data flow, T0 — User offline, submits the form, T1 — Connectivity returns, T2 — Server receives replay, T3 — Page surfaces milestones (post-replay)

### Community 202 - "The engine — `src/lib/server/menu/engine.ts` (Phase 2)"
Cohesion: 0.40
Nodes (5): Filtering & rotation — over the compacted **introduced-safe** list (fixes F1/F2/NEW-1/F8), `midi` protéine — weekday category + stride-1 occurrence rotation (fixes F4/a), Novelty — one **proactive** new food per day, on the surface that fits (fixes F3/b, orphan-novelty), The engine — `src/lib/server/menu/engine.ts` (Phase 2), Timezone & weekday (fixes F5/F6, + DST conditions)

### Community 209 - "`explain`: Rule Explanation"
Cohesion: 0.50
Nodes (4): Arguments, `explain`: Rule Explanation, JSON Output Structure, Usage

### Community 210 - "Configuration File Format"
Cohesion: 0.50
Nodes (4): Configuration field notes, Configuration File Format, JSON Format (`.fallowrc.json` / `.fallowrc.jsonc`), TOML Format (`fallow.toml`)

### Community 211 - "`dead-code`: Dead Code Analysis"
Cohesion: 0.50
Nodes (4): `dead-code`: Dead Code Analysis, Examples, Flags, Issue Type Filters

### Community 213 - "`dupes`: Duplication Detection"
Cohesion: 0.50
Nodes (4): Detection Modes, `dupes`: Duplication Detection, Examples, Flags

### Community 214 - "`security`: Security Candidate Detection"
Cohesion: 0.50
Nodes (4): Examples, Flags, JSON Output Structure, `security`: Security Candidate Detection

### Community 215 - "`flags`: Feature Flag Detection"
Cohesion: 0.50
Nodes (4): Examples, Flags, `flags`: Feature Flag Detection, JSON Output Structure

### Community 218 - "Client queue contract"
Cohesion: 0.50
Nodes (4): API, Client queue contract, IDB structure, Triggers

### Community 219 - "UI surfaces"
Cohesion: 0.50
Nodes (4): Install CTA, Offline fallback page, Queue badge, UI surfaces

### Community 221 - "Q: Why does resetTestDb connect Test Seed Helpers to Passkey, Hooks Auth Tests, Dashboard Data Loaders, GDPR Data Export, Cleanup Rate Limiting, and Database Backup Migrations?"
Cohesion: 0.50
Nodes (3): Answer, Q: Why does resetTestDb connect Test Seed Helpers to Passkey, Hooks Auth Tests, Dashboard Data Loaders, GDPR Data Export, Cleanup Rate Limiting, and Database Backup Migrations?, Source Nodes

### Community 222 - "Q: Why do 5+ test files independently call hashPassword from lib/server/auth.ts?"
Cohesion: 0.50
Nodes (3): Answer, Q: Why do 5+ test files independently call hashPassword from lib/server/auth.ts?, Source Nodes

### Community 225 - "tokens.test.ts"
Cohesion: 0.50
Nodes (3): css, here, REQUIRED_TOKENS

### Community 230 - "File Structure"
Cohesion: 0.67
Nodes (3): Created (new files), File Structure, Modified

### Community 233 - "Graphify memory: hashPassword fan-out query"
Cohesion: 0.67
Nodes (3): Graphify memory: hashPassword fan-out query, hashPassword (src/lib/server/auth.ts), seedUser (src/test/route.ts)

## Ambiguous Edges - Review These
- `Bundle 1 — Foundation primitives Implementation Plan` → `Use Bun, not npm/Node convention`  [AMBIGUOUS]
  CLAUDE.md · relation: conceptually_related_to
- `Sentry Observability Implementation Plan` → `Use Bun, not npm/Node convention`  [AMBIGUOUS]
  CLAUDE.md · relation: conceptually_related_to
- `PWA Offline Log Queue Implementation Plan` → `Use Bun, not npm/Node convention`  [AMBIGUOUS]
  CLAUDE.md · relation: conceptually_related_to
- `scripts/check-i18n-unused.mjs` → `scripts/check-i18n-unused.ts`  [AMBIGUOUS]
  project.inlang/modules/README.md · relation: references
- `scripts/lint-i18n.mjs` → `scripts/lint-i18n.ts`  [AMBIGUOUS]
  project.inlang/modules/README.md · relation: references

## Knowledge Gaps
- **2619 isolated node(s):** `$schema`, `superpowers@claude-plugins-official`, `frontend-design@claude-plugins-official`, `code-review@claude-plugins-official`, `code-simplifier@claude-plugins-official` (+2614 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **42 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Bundle 1 — Foundation primitives Implementation Plan` and `Use Bun, not npm/Node convention`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `Sentry Observability Implementation Plan` and `Use Bun, not npm/Node convention`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `PWA Offline Log Queue Implementation Plan` and `Use Bun, not npm/Node convention`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `scripts/check-i18n-unused.mjs` and `scripts/check-i18n-unused.ts`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **What is the exact relationship between `scripts/lint-i18n.mjs` and `scripts/lint-i18n.ts`?**
  _Edge tagged AMBIGUOUS (relation: references) - confidence is low._
- **Why does `CLAUDE.md hard rules` connect `CLAUDE.md hard rules` to `PRODUCT.md — Diversif product register`, `i18n-add-key/SKILL.md`, `Sentry Observability Implementation Plan`, `DEPLOY.md`?**
  _High betweenness centrality (0.091) - this node is a cross-community bridge._
- **Why does `hookify: block-no-verify` connect `CLAUDE.md hard rules` to `Fallow: Common Workflow Patterns & Recipes`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
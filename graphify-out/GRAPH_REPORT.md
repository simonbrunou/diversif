# Graph Report - diversif  (2026-05-21)

## Corpus Check
- 419 files · ~615,422 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2349 nodes · 4460 edges · 160 communities (148 shown, 12 thin omitted)
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 539 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f88a7083`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_i18n Messages (auth.)|i18n Messages (auth.*)]]
- [[_COMMUNITY_i18n Messages (chrome.)|i18n Messages (chrome.*)]]
- [[_COMMUNITY_i18n Messages (errors+log+landing)|i18n Messages (errors+log+landing)]]
- [[_COMMUNITY_Page Loaders & Form Actions|Page Loaders & Form Actions]]
- [[_COMMUNITY_Test Fixtures & Setup Helpers|Test Fixtures & Setup Helpers]]
- [[_COMMUNITY_Branding, App Shell & PWA Manifest|Branding, App Shell & PWA Manifest]]
- [[_COMMUNITY_Architecture Patterns & Conventions|Architecture Patterns & Conventions]]
- [[_COMMUNITY_Auth Routes & i18n Routing|Auth Routes & i18n Routing]]
- [[_COMMUNITY_UI Components & Tests|UI Components & Tests]]
- [[_COMMUNITY_WebAuthn  Passkeys|WebAuthn / Passkeys]]
- [[_COMMUNITY_Offline Log Queue (IndexedDB)|Offline Log Queue (IndexedDB)]]
- [[_COMMUNITY_User Memory & Medical Audit|User Memory & Medical Audit]]
- [[_COMMUNITY_SEO  JSON-LD Library|SEO / JSON-LD Library]]
- [[_COMMUNITY_UI Component Library|UI Component Library]]
- [[_COMMUNITY_Account Export  Delete|Account Export / Delete]]
- [[_COMMUNITY_DB Init, Backup & Seed|DB Init, Backup & Seed]]
- [[_COMMUNITY_Allergens & Milestones|Allergens & Milestones]]
- [[_COMMUNITY_Sentry Observability|Sentry Observability]]
- [[_COMMUNITY_Legal Pages|Legal Pages]]
- [[_COMMUNITY_Invitations & Memberships|Invitations & Memberships]]
- [[_COMMUNITY_SEO Source-of-Truth Config|SEO Source-of-Truth Config]]
- [[_COMMUNITY_Diversification Guidance & Stages|Diversification Guidance & Stages]]
- [[_COMMUNITY_UI Primitives & LEAPEAT Cards|UI Primitives & LEAP/EAT Cards]]
- [[_COMMUNITY_Migration Tests|Migration Tests]]
- [[_COMMUNITY_Food Categories|Food Categories]]
- [[_COMMUNITY_Reaction Reports & Reminders|Reaction Reports & Reminders]]
- [[_COMMUNITY_Idempotency Primitive|Idempotency Primitive]]
- [[_COMMUNITY_Auth Guards & Sessions|Auth Guards & Sessions]]
- [[_COMMUNITY_Reactions Vocabulary|Reactions Vocabulary]]
- [[_COMMUNITY_Diversity Metrics|Diversity Metrics]]
- [[_COMMUNITY_Reminders Engine|Reminders Engine]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]

## God Nodes (most connected - your core abstractions)
1. `languageTag()` - 397 edges
2. `makeRouteEvent()` - 44 edges
3. `requireUser()` - 42 edges
4. `resetTestDb()` - 42 edges
5. `safeUser()` - 33 edges
6. `captureFlow()` - 27 edges
7. `seedChild()` - 27 edges
8. `hashPassword()` - 25 edges
9. `seedMembership()` - 24 edges
10. `requireMembership()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `load()` --calls--> `requireUser()`  [INFERRED]
  src/routes/account/delete/+page.server.ts → src/lib/server/guards.ts
- `handleError()` --calls--> `scrubPathname()`  [INFERRED]
  src/hooks.server.ts → src/lib/sentry.ts
- `handle()` --calls--> `validateSession()`  [INFERRED]
  src/hooks.server.ts → src/lib/server/auth.ts
- `handle()` --calls--> `invalidateSession()`  [INFERRED]
  src/hooks.server.ts → src/lib/server/auth.ts
- `load()` --calls--> `resolveOrigin()`  [INFERRED]
  src/routes/+layout.server.ts → src/lib/seo.ts

## Communities (160 total, 12 thin omitted)

### Community 0 - "i18n Messages (auth.*)"
Cohesion: 0.01
Nodes (305): addSymptomLabel(), addSymptomNote(), addSymptomNotePlaceholder(), addSymptomObservedAt(), addSymptomTitle(), allergenDialogBadgeFromMonths(), allergenDialogClose(), allergenDialogFirstSignsTitle() (+297 more)

### Community 1 - "i18n Messages (chrome.*)"
Cohesion: 0.01
Nodes (142): addSymptomLabel(), addSymptomNote(), addSymptomNotePlaceholder(), addSymptomTitle(), allergenDialogSevereSignsTitle(), allergenDialogWhyEarlyTitle(), aujourdhuiAllergensTodo(), aujourdhuiStatsAliments() (+134 more)

### Community 2 - "i18n Messages (errors+log+landing)"
Cohesion: 0.01
Nodes (246): addSymptomObservedAt(), addSymptomSubmit(), allergenDialogBadgeFromMonths(), allergenDialogClose(), allergenDialogFirstSignsTitle(), allergenDialogHowToOfferTitle(), allergenDialogSeverityMajor(), allergenDialogSourcesTitle() (+238 more)

### Community 3 - "Page Loaders & Form Actions"
Cohesion: 0.01
Nodes (142): addSymptomNotePlaceholder(), addSymptomSubmit(), allergenDialogBadgeFromMonths(), allergenDialogFirstSignsTitle(), allergenDialogSeverityMajor(), allergenDialogWhyEarlyTitle(), aujourdhuiAllergensFading(), aujourdhuiStatsAliments() (+134 more)

### Community 4 - "Test Fixtures & Setup Helpers"
Cohesion: 0.01
Nodes (246): addSymptomLabel(), addSymptomNote(), addSymptomObservedAt(), addSymptomTitle(), allergenDialogClose(), allergenDialogHowToOfferTitle(), allergenDialogSevereSignsTitle(), allergenDialogSourcesTitle() (+238 more)

### Community 5 - "Branding, App Shell & PWA Manifest"
Cohesion: 0.01
Nodes (84): addSymptomSubmit(), allergenDialogHowToOfferTitle(), aujourdhuiAllergensFading(), aujourdhuiRecentEmpty(), aujourdhuiRecentTitle(), authAccountAppearanceDescription(), authAccountDataDescription(), authAccountDataExport() (+76 more)

### Community 6 - "Architecture Patterns & Conventions"
Cohesion: 0.06
Nodes (35): seed(), seed(), makeDeleteEvent(), makeFormEvent(), setup(), loadFor(), setup(), setupEgg() (+27 more)

### Community 7 - "Auth Routes & i18n Routing"
Cohesion: 0.13
Nodes (27): load(), POST(), load(), base64UrlToBuffer(), bufferToBase64Url(), buildAuthenticationOptions(), buildRegistrationOptions(), consumeChallenge() (+19 more)

### Community 9 - "WebAuthn / Passkeys"
Cohesion: 0.11
Nodes (20): getAllStagesForBento(), load(), loadBentoAllergens(), loadWeeklyEntries(), loadAllergenStatus(), dismissReminder(), loadAnalyticsBuckets(), loadCoparentActivity() (+12 more)

### Community 10 - "Offline Log Queue (IndexedDB)"
Cohesion: 0.08
Nodes (14): back(), findScrollable(), handleOpenChange(), isInteractive(), onSheetPointerCancel(), onSheetPointerDown(), onSheetPointerMove(), onSheetPointerUp() (+6 more)

### Community 11 - "User Memory & Medical Audit"
Cohesion: 0.09
Nodes (15): clear(), deleteRow(), emit(), enqueue(), flush(), openDb(), postOne(), readAllOrdered() (+7 more)

### Community 12 - "SEO / JSON-LD Library"
Cohesion: 0.13
Nodes (16): load(), load(), load(), LogActionAbort, load(), load(), load(), parseChildIdParam() (+8 more)

### Community 13 - "UI Component Library"
Cohesion: 0.1
Nodes (16): categoryLabel(), computeReminders(), push(), allergenEntry(), entry(), input(), isolated(), findRepeatCandidates() (+8 more)

### Community 14 - "Account Export / Delete"
Cohesion: 0.12
Nodes (18): filterIncomingBreadcrumb(), scrubEvent(), scrubPathname(), scrubUrlString(), enforceLanguageTag(), isAvailableLanguageTag(), onSetLanguageTag(), setLanguageTag() (+10 more)

### Community 15 - "DB Init, Backup & Seed"
Cohesion: 0.12
Nodes (15): findActiveInvitation(), load(), userHasMembership(), isUniqueViolation(), runCleanup(), startCleanupTimer(), stopCleanupTimer(), IdempotencyInFlight (+7 more)

### Community 16 - "Allergens & Milestones"
Cohesion: 0.13
Nodes (21): escapePatternText(), findPlaceholderClosingIndex(), flatten(), isBuffer(), parseBundle(), parseDeclaration(), parseMarkupBody(), parseMarkupPlaceholder() (+13 more)

### Community 17 - "Sentry Observability"
Cohesion: 0.16
Nodes (14): load(), POST(), load(), createSession(), findUserByEmail(), getDecoyHash(), invalidateAllUserSessions(), invalidateSession() (+6 more)

### Community 18 - "Legal Pages"
Cohesion: 0.15
Nodes (13): severityOf(), countNthExposition(), deleteSymptomById(), insertSymptom(), listSymptomsByEntry(), formatDate(), formatTime(), load() (+5 more)

### Community 19 - "Invitations & Memberships"
Cohesion: 0.14
Nodes (8): load(), GET(), audit(), deleteUserAccount(), ExportTooLargeError, exportUserData(), isoOrNull(), isoOrThrow()

### Community 20 - "SEO Source-of-Truth Config"
Cohesion: 0.19
Nodes (11): absoluteUrl(), articleJsonLd(), breadcrumbJsonLd(), faqPageJsonLd(), organizationJsonLd(), resolveOrigin(), webApplicationJsonLd(), websiteJsonLd() (+3 more)

### Community 21 - "Diversification Guidance & Stages"
Cohesion: 0.21
Nodes (9): getStageForAgeMonths(), getTipsFor(), pickRotatingTip(), load(), ageInMonths(), formatAge(), defaultTextureForAgeMonths(), getTextureLabel() (+1 more)

### Community 22 - "UI Primitives & LEAP/EAT Cards"
Cohesion: 0.18
Nodes (7): applySeedCorrections(), seedFoods(), drainPool(), registerShutdownHandlers(), _resetShutdownState(), makeHarness(), makeProc()

### Community 23 - "Migration Tests"
Cohesion: 0.23
Nodes (4): dismissWelcomeIfPresent(), signUp(), signUpAndCreateChild(), unique()

### Community 24 - "Food Categories"
Cohesion: 0.27
Nodes (11): addSortIndicators(), enableUI(), getNthColumn(), getTable(), getTableBody(), getTableHeader(), loadColumns(), loadData() (+3 more)

### Community 25 - "Reaction Reports & Reminders"
Cohesion: 0.27
Nodes (11): addSortIndicators(), enableUI(), getNthColumn(), getTable(), getTableBody(), getTableHeader(), loadColumns(), loadData() (+3 more)

### Community 26 - "Idempotency Primitive"
Cohesion: 0.35
Nodes (8): a(), B(), D(), g(), i(), k(), Q(), y()

### Community 27 - "Auth Guards & Sessions"
Cohesion: 0.35
Nodes (8): a(), B(), D(), g(), i(), k(), Q(), y()

### Community 28 - "Reactions Vocabulary"
Cohesion: 0.28
Nodes (5): load(), load(), getLegalIdentity(), isPlaceholder(), read()

### Community 30 - "Reminders Engine"
Cohesion: 0.5
Nodes (6): clearTimer(), formatRemaining(), keyFor(), loadTimer(), remainingMs(), saveTimer()

### Community 31 - "Community 31"
Cohesion: 0.6
Nodes (3): signUp(), signUpOwnerAndCreateChild(), unique()

### Community 35 - "Community 35"
Cohesion: 0.7
Nodes (4): goToNext(), goToPrevious(), makeCurrent(), toggleClass()

### Community 36 - "Community 36"
Cohesion: 0.7
Nodes (4): goToNext(), goToPrevious(), makeCurrent(), toggleClass()

## Knowledge Gaps
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `languageTag()` connect `i18n Messages (auth.*)` to `Offline Log Queue (IndexedDB)`, `Branding, App Shell & PWA Manifest`, `Account Export / Delete`?**
  _High betweenness centrality (0.109) - this node is a cross-community bridge._
- **Why does `isValidBirthDate()` connect `SEO / JSON-LD Library` to `Account Export / Delete`?**
  _High betweenness centrality (0.060) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `SEO / JSON-LD Library` to `Auth Routes & i18n Routing`, `WebAuthn / Passkeys`, `Sentry Observability`, `Legal Pages`, `Invitations & Memberships`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Are the 389 inferred relationships involving `languageTag()` (e.g. with `localizedHref()` and `formatRelative()`) actually correct?**
  _`languageTag()` has 389 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `makeRouteEvent()` (e.g. with `loadFor()` and `makeFormEvent()`) actually correct?**
  _`makeRouteEvent()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **Are the 20 inferred relationships involving `requireUser()` (e.g. with `localizedRedirect()` and `load()`) actually correct?**
  _`requireUser()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `safeUser()` (e.g. with `loadFor()` and `makeFormEvent()`) actually correct?**
  _`safeUser()` has 4 INFERRED edges - model-reasoned connections that need verification._
# Graph Report - diversif  (2026-05-21)

## Corpus Check
- 473 files · ~660,214 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2774 nodes · 5074 edges · 184 communities (172 shown, 12 thin omitted)
- Extraction: 89% EXTRACTED · 11% INFERRED · 0% AMBIGUOUS · INFERRED: 579 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8955659e`
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
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]

## God Nodes (most connected - your core abstractions)
1. `languageTag()` - 397 edges
2. `resetTestDb()` - 55 edges
3. `makeRouteEvent()` - 54 edges
4. `requireUser()` - 43 edges
5. `safeUser()` - 43 edges
6. `seedMembership()` - 38 edges
7. `seedChild()` - 34 edges
8. `captureFlow()` - 32 edges
9. `seedUser()` - 28 edges
10. `hashPassword()` - 27 edges

## Surprising Connections (you probably didn't know these)
- `load()` --calls--> `requireUser()`  [INFERRED]
  src/routes/account/delete/+page.server.ts → src/lib/server/guards.ts
- `load()` --calls--> `requireUser()`  [INFERRED]
  src/routes/account/password/+page.server.ts → src/lib/server/guards.ts
- `load()` --calls--> `requireUser()`  [INFERRED]
  src/routes/account/sessions/+page.server.ts → src/lib/server/guards.ts
- `load()` --calls--> `requireUser()`  [INFERRED]
  src/routes/child/new/+page.server.ts → src/lib/server/guards.ts
- `load()` --calls--> `loadWeeklyRecap()`  [INFERRED]
  src/routes/child/[id]/+page.server.ts → src/lib/server/guidance/queries/diversity.ts

## Communities (184 total, 12 thin omitted)

### Community 0 - "i18n Messages (auth.*)"
Cohesion: 0.01
Nodes (355): addSymptomLabel(), addSymptomNote(), addSymptomNotePlaceholder(), addSymptomObservedAt(), addSymptomSubmit(), addSymptomTitle(), allergenDialogBadgeFromMonths(), allergenDialogFirstSignsTitle() (+347 more)

### Community 1 - "i18n Messages (chrome.*)"
Cohesion: 0.01
Nodes (296): addSymptomNote(), addSymptomNotePlaceholder(), addSymptomObservedAt(), addSymptomSubmit(), addSymptomTitle(), allergenDialogBadgeFromMonths(), allergenDialogTitle(), allergenDialogWhyEarlyTitle() (+288 more)

### Community 2 - "i18n Messages (errors+log+landing)"
Cohesion: 0.01
Nodes (105): addSymptomLabel(), allergenDialogClose(), allergenDialogFirstSignsTitle(), allergenDialogHowToOfferTitle(), allergenDialogSevereSignsTitle(), allergenDialogSeverityMajor(), allergenDialogSourcesTitle(), aujourdhuiBilanAlimentsDelta() (+97 more)

### Community 3 - "Page Loaders & Form Actions"
Cohesion: 0.01
Nodes (296): addSymptomLabel(), addSymptomNote(), allergenDialogBadgeFromMonths(), allergenDialogHowToOfferTitle(), allergenDialogSevereSignsTitle(), allergenDialogSeverityMajor(), allergenDialogSourcesTitle(), allergenDialogTitle() (+288 more)

### Community 4 - "Test Fixtures & Setup Helpers"
Cohesion: 0.01
Nodes (105): addSymptomNotePlaceholder(), addSymptomObservedAt(), addSymptomSubmit(), addSymptomTitle(), allergenDialogClose(), allergenDialogFirstSignsTitle(), aujourdhuiBilanAliments(), aujourdhuiBilanStreak() (+97 more)

### Community 5 - "Branding, App Shell & PWA Manifest"
Cohesion: 0.01
Nodes (47): allergenDialogClose(), allergenDialogHowToOfferTitle(), aujourdhuiAllergensFading(), aujourdhuiBilanAliments(), aujourdhuiBilanAlimentsDelta(), aujourdhuiRecentEmpty(), aujourdhuiRecentTitle(), aujourdhuiStatsStreakDaysOne() (+39 more)

### Community 6 - "Architecture Patterns & Conventions"
Cohesion: 0.05
Nodes (46): seed(), seed(), makeDeleteEvent(), makeFormEvent(), setup(), loadFor(), setup(), setupEgg() (+38 more)

### Community 7 - "Auth Routes & i18n Routing"
Cohesion: 0.07
Nodes (37): load(), GET(), POST(), load(), audit(), deleteUserAccount(), ExportTooLargeError, exportUserData() (+29 more)

### Community 8 - "UI Components & Tests"
Cohesion: 0.09
Nodes (25): load(), load(), POST(), load(), load(), findUserByEmail(), getDecoyHash(), invalidateAllUserSessions() (+17 more)

### Community 9 - "WebAuthn / Passkeys"
Cohesion: 0.07
Nodes (14): back(), findScrollable(), handleOpenChange(), isInteractive(), onSheetPointerCancel(), onSheetPointerDown(), onSheetPointerMove(), onSheetPointerUp() (+6 more)

### Community 10 - "Offline Log Queue (IndexedDB)"
Cohesion: 0.09
Nodes (15): clear(), deleteRow(), emit(), enqueue(), flush(), openDb(), postOne(), readAllOrdered() (+7 more)

### Community 11 - "User Memory & Medical Audit"
Cohesion: 0.11
Nodes (18): getAllStagesForBento(), getStageForAgeMonths(), getTipsFor(), pickRotatingTip(), getRecipesForStage(), getSeasonalNames(), loadSeasonalFoods(), loadTextureProgress() (+10 more)

### Community 12 - "SEO / JSON-LD Library"
Cohesion: 0.1
Nodes (16): categoryLabel(), computeReminders(), push(), allergenEntry(), entry(), input(), isolated(), findRepeatCandidates() (+8 more)

### Community 13 - "UI Component Library"
Cohesion: 0.19
Nodes (14): load(), load(), load(), LogActionAbort, load(), load(), parseChildIdParam(), requireChildContext() (+6 more)

### Community 14 - "Account Export / Delete"
Cohesion: 0.13
Nodes (21): escapePatternText(), findPlaceholderClosingIndex(), flatten(), isBuffer(), parseBundle(), parseDeclaration(), parseMarkupBody(), parseMarkupPlaceholder() (+13 more)

### Community 15 - "DB Init, Backup & Seed"
Cohesion: 0.16
Nodes (12): dismissReminder(), loadAnalyticsBuckets(), loadCoparentActivity(), loadDismissals(), loadDiversityMetrics(), loadRecentEntries(), loadStreak(), loadWeeklyRecap() (+4 more)

### Community 16 - "Allergens & Milestones"
Cohesion: 0.17
Nodes (12): filterIncomingBreadcrumb(), scrubEvent(), scrubPathname(), scrubUrlString(), enforceLanguageTag(), isAvailableLanguageTag(), onSetLanguageTag(), setLanguageTag() (+4 more)

### Community 17 - "Sentry Observability"
Cohesion: 0.16
Nodes (14): severityOf(), countNthExposition(), deleteSymptomById(), insertSymptom(), listSymptomsByEntry(), formatDate(), formatTime(), load() (+6 more)

### Community 18 - "Legal Pages"
Cohesion: 0.15
Nodes (11): isUniqueViolation(), load(), runCleanup(), startCleanupTimer(), stopCleanupTimer(), IdempotencyInFlight, IdempotencyScopeMismatch, pruneExpiredKeys() (+3 more)

### Community 20 - "SEO Source-of-Truth Config"
Cohesion: 0.19
Nodes (11): absoluteUrl(), articleJsonLd(), breadcrumbJsonLd(), faqPageJsonLd(), organizationJsonLd(), resolveOrigin(), webApplicationJsonLd(), websiteJsonLd() (+3 more)

### Community 21 - "Diversification Guidance & Stages"
Cohesion: 0.16
Nodes (12): load(), loadBentoAllergens(), loadWeeklyEntries(), loadAllergenStatus(), loadRepeatCandidates(), loadTexturesTried(), loadDiversityMetrics(), loadRepeatCandidates() (+4 more)

### Community 23 - "Migration Tests"
Cohesion: 0.18
Nodes (7): applySeedCorrections(), seedFoods(), drainPool(), registerShutdownHandlers(), _resetShutdownState(), makeHarness(), makeProc()

### Community 24 - "Food Categories"
Cohesion: 0.23
Nodes (4): dismissWelcomeIfPresent(), signUp(), signUpAndCreateChild(), unique()

### Community 25 - "Reaction Reports & Reminders"
Cohesion: 0.27
Nodes (11): addSortIndicators(), enableUI(), getNthColumn(), getTable(), getTableBody(), getTableHeader(), loadColumns(), loadData() (+3 more)

### Community 26 - "Idempotency Primitive"
Cohesion: 0.27
Nodes (11): addSortIndicators(), enableUI(), getNthColumn(), getTable(), getTableBody(), getTableHeader(), loadColumns(), loadData() (+3 more)

### Community 27 - "Auth Guards & Sessions"
Cohesion: 0.3
Nodes (10): formatDate(), formatDateInputValue(), formatDateTime(), formatMonthsSince(), formatRelative(), formatTime(), isValidBirthDate(), localInputToIso() (+2 more)

### Community 28 - "Reactions Vocabulary"
Cohesion: 0.35
Nodes (8): a(), B(), D(), g(), i(), k(), Q(), y()

### Community 29 - "Diversity Metrics"
Cohesion: 0.35
Nodes (8): a(), B(), D(), g(), i(), k(), Q(), y()

### Community 30 - "Reminders Engine"
Cohesion: 0.24
Nodes (5): load(), load(), getLegalIdentity(), isPlaceholder(), read()

### Community 31 - "Community 31"
Cohesion: 0.36
Nodes (5): findActiveInvitation(), load(), userHasMembership(), generateInviteCodeRaw(), isValidInviteCodeFormat()

### Community 33 - "Community 33"
Cohesion: 0.5
Nodes (6): clearTimer(), formatRemaining(), keyFor(), loadTimer(), remainingMs(), saveTimer()

### Community 34 - "Community 34"
Cohesion: 0.6
Nodes (3): signUp(), signUpOwnerAndCreateChild(), unique()

### Community 38 - "Community 38"
Cohesion: 0.7
Nodes (4): goToNext(), goToPrevious(), makeCurrent(), toggleClass()

### Community 39 - "Community 39"
Cohesion: 0.7
Nodes (4): goToNext(), goToPrevious(), makeCurrent(), toggleClass()

## Knowledge Gaps
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `languageTag()` connect `i18n Messages (auth.*)` to `Allergens & Milestones`, `WebAuthn / Passkeys`, `Auth Guards & Sessions`, `Branding, App Shell & PWA Manifest`?**
  _High betweenness centrality (0.134) - this node is a cross-community bridge._
- **Why does `setLanguageTag()` connect `Allergens & Milestones` to `i18n Messages (auth.*)`, `Auth Guards & Sessions`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `localizedHref()` connect `WebAuthn / Passkeys` to `i18n Messages (auth.*)`?**
  _High betweenness centrality (0.035) - this node is a cross-community bridge._
- **Are the 389 inferred relationships involving `languageTag()` (e.g. with `localizedHref()` and `formatRelative()`) actually correct?**
  _`languageTag()` has 389 INFERRED edges - model-reasoned connections that need verification._
- **Are the 8 inferred relationships involving `makeRouteEvent()` (e.g. with `loadFor()` and `loadFor()`) actually correct?**
  _`makeRouteEvent()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Are the 20 inferred relationships involving `requireUser()` (e.g. with `localizedRedirect()` and `load()`) actually correct?**
  _`requireUser()` has 20 INFERRED edges - model-reasoned connections that need verification._
- **Are the 6 inferred relationships involving `safeUser()` (e.g. with `loadFor()` and `loadFor()`) actually correct?**
  _`safeUser()` has 6 INFERRED edges - model-reasoned connections that need verification._
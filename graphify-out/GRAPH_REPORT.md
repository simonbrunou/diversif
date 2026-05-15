# Graph Report - diversif  (2026-05-15)

## Corpus Check
- 380 files · ~567,791 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1991 nodes · 4013 edges · 155 communities (147 shown, 8 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 509 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `67cbbe55`
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
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]

## God Nodes (most connected - your core abstractions)
1. `languageTag()` - 397 edges
2. `makeRouteEvent()` - 35 edges
3. `resetTestDb()` - 35 edges
4. `requireUser()` - 28 edges
5. `seedChild()` - 27 edges
6. `safeUser()` - 25 edges
7. `seedMembership()` - 24 edges
8. `requireMembership()` - 21 edges
9. `captureFlow()` - 20 edges
10. `seedUser()` - 20 edges

## Surprising Connections (you probably didn't know these)
- `handleError()` --calls--> `scrubPathname()`  [INFERRED]
  src/hooks.server.ts → src/lib/sentry.ts
- `load()` --calls--> `requireUser()`  [INFERRED]
  src/routes/child/new/+page.server.ts → src/lib/server/guards.ts
- `handle()` --calls--> `setLanguageTag()`  [INFERRED]
  src/hooks.server.ts → src/paraglide/runtime.js
- `load()` --calls--> `resolveOrigin()`  [INFERRED]
  src/routes/+layout.server.ts → src/lib/seo.ts
- `load()` --calls--> `getLegalIdentity()`  [INFERRED]
  src/routes/mentions-legales/+page.server.ts → src/lib/server/legal.ts

## Communities (155 total, 8 thin omitted)

### Community 0 - "i18n Messages (auth.*)"
Cohesion: 0.01
Nodes (265): addSymptomNote(), addSymptomNotePlaceholder(), addSymptomObservedAt(), addSymptomSubmit(), addSymptomTitle(), allergenDialogHowToOfferTitle(), allergenDialogSevereSignsTitle(), allergenDialogSourcesTitle() (+257 more)

### Community 1 - "i18n Messages (chrome.*)"
Cohesion: 0.01
Nodes (200): addSymptomNotePlaceholder(), addSymptomSubmit(), allergenDialogClose(), allergenDialogFirstSignsTitle(), allergenDialogSevereSignsTitle(), allergenDialogSeverityMajor(), allergenDialogSourcesTitle(), allergenDialogWhyEarlyTitle() (+192 more)

### Community 2 - "i18n Messages (errors+log+landing)"
Cohesion: 0.01
Nodes (188): addSymptomLabel(), addSymptomNote(), addSymptomObservedAt(), addSymptomTitle(), allergenDialogBadgeFromMonths(), allergenDialogHowToOfferTitle(), allergenDialogTitle(), aujourdhuiAllergensTodo() (+180 more)

### Community 3 - "Page Loaders & Form Actions"
Cohesion: 0.01
Nodes (200): addSymptomLabel(), addSymptomNote(), addSymptomSubmit(), allergenDialogClose(), allergenDialogFirstSignsTitle(), allergenDialogHowToOfferTitle(), allergenDialogWhyEarlyTitle(), aujourdhuiAllergensTitle() (+192 more)

### Community 4 - "Test Fixtures & Setup Helpers"
Cohesion: 0.01
Nodes (188): addSymptomNotePlaceholder(), addSymptomObservedAt(), addSymptomTitle(), allergenDialogBadgeFromMonths(), allergenDialogSevereSignsTitle(), allergenDialogSeverityMajor(), allergenDialogSourcesTitle(), allergenDialogTitle() (+180 more)

### Community 5 - "Branding, App Shell & PWA Manifest"
Cohesion: 0.01
Nodes (124): addSymptomLabel(), allergenDialogBadgeFromMonths(), allergenDialogClose(), allergenDialogFirstSignsTitle(), allergenDialogSeverityMajor(), aujourdhuiAllergensFading(), aujourdhuiAllergensTitle(), aujourdhuiRecentEmpty() (+116 more)

### Community 6 - "Architecture Patterns & Conventions"
Cohesion: 0.06
Nodes (38): seed(), makeFormEvent(), setup(), loadFor(), setup(), setupEgg(), setup(), setup() (+30 more)

### Community 7 - "Auth Routes & i18n Routing"
Cohesion: 0.07
Nodes (37): load(), GET(), POST(), audit(), runCleanup(), startCleanupTimer(), stopCleanupTimer(), deleteUserAccount() (+29 more)

### Community 8 - "UI Components & Tests"
Cohesion: 0.09
Nodes (15): clear(), deleteRow(), emit(), enqueue(), flush(), openDb(), postOne(), readAllOrdered() (+7 more)

### Community 9 - "WebAuthn / Passkeys"
Cohesion: 0.08
Nodes (13): findScrollable(), handleOpenChange(), isInteractive(), onSheetPointerCancel(), onSheetPointerDown(), onSheetPointerMove(), onSheetPointerUp(), resetGesture() (+5 more)

### Community 11 - "User Memory & Medical Audit"
Cohesion: 0.13
Nodes (21): escapePatternText(), findPlaceholderClosingIndex(), flatten(), isBuffer(), parseBundle(), parseDeclaration(), parseMarkupBody(), parseMarkupPlaceholder() (+13 more)

### Community 12 - "SEO / JSON-LD Library"
Cohesion: 0.14
Nodes (14): filterIncomingBreadcrumb(), scrubEvent(), scrubPathname(), scrubUrlString(), enforceLanguageTag(), isAvailableLanguageTag(), onSetLanguageTag(), setLanguageTag() (+6 more)

### Community 13 - "UI Component Library"
Cohesion: 0.19
Nodes (11): absoluteUrl(), articleJsonLd(), breadcrumbJsonLd(), faqPageJsonLd(), organizationJsonLd(), resolveOrigin(), webApplicationJsonLd(), websiteJsonLd() (+3 more)

### Community 14 - "Account Export / Delete"
Cohesion: 0.24
Nodes (11): dismissReminder(), loadAnalyticsBuckets(), loadCoparentActivity(), loadDismissals(), loadDiversityMetrics(), loadRecentEntries(), loadRepeatCandidates(), loadStreak() (+3 more)

### Community 15 - "DB Init, Backup & Seed"
Cohesion: 0.32
Nodes (8): load(), load(), parseChildIdParam(), requireMembership(), requireOwnership(), requireUser(), load(), load()

### Community 16 - "Allergens & Milestones"
Cohesion: 0.2
Nodes (9): findActiveInvitation(), load(), userHasMembership(), load(), load(), findUserByEmail(), requireGuest(), localizedRedirect() (+1 more)

### Community 17 - "Sentry Observability"
Cohesion: 0.21
Nodes (10): severityOf(), countNthExposition(), insertSymptom(), formatDate(), formatTime(), load(), loadEntry(), loadEntryForChild() (+2 more)

### Community 18 - "Legal Pages"
Cohesion: 0.18
Nodes (7): applySeedCorrections(), seedFoods(), drainPool(), registerShutdownHandlers(), _resetShutdownState(), makeHarness(), makeProc()

### Community 19 - "Invitations & Memberships"
Cohesion: 0.27
Nodes (11): addSortIndicators(), enableUI(), getNthColumn(), getTable(), getTableBody(), getTableHeader(), loadColumns(), loadData() (+3 more)

### Community 20 - "SEO Source-of-Truth Config"
Cohesion: 0.27
Nodes (11): addSortIndicators(), enableUI(), getNthColumn(), getTable(), getTableBody(), getTableHeader(), loadColumns(), loadData() (+3 more)

### Community 21 - "Diversification Guidance & Stages"
Cohesion: 0.24
Nodes (4): dismissWelcomeIfPresent(), signUp(), signUpAndCreateChild(), unique()

### Community 22 - "UI Primitives & LEAP/EAT Cards"
Cohesion: 0.27
Nodes (6): getAllStagesForBento(), getStageForAgeMonths(), getTipsFor(), pickRotatingTip(), load(), chooseSuggestedFoods()

### Community 23 - "Migration Tests"
Cohesion: 0.25
Nodes (5): isUniqueViolation(), load(), createInvitationForChild(), generateInviteCodeRaw(), isValidInviteCodeFormat()

### Community 24 - "Food Categories"
Cohesion: 0.22
Nodes (4): logHref(), getAllergenLabel(), celebrate(), pickMilestoneFromQuery()

### Community 25 - "Reaction Reports & Reminders"
Cohesion: 0.35
Nodes (8): a(), B(), D(), g(), i(), k(), Q(), y()

### Community 26 - "Idempotency Primitive"
Cohesion: 0.35
Nodes (8): a(), B(), D(), g(), i(), k(), Q(), y()

### Community 27 - "Auth Guards & Sessions"
Cohesion: 0.31
Nodes (6): load(), loadBentoAllergens(), loadWeeklyEntries(), loadTexturesTried(), fuzzyMatch(), normalize()

### Community 28 - "Reactions Vocabulary"
Cohesion: 0.31
Nodes (5): LogActionAbort, IdempotencyInFlight, IdempotencyScopeMismatch, pruneExpiredKeys(), withIdempotencyKey()

### Community 29 - "Diversity Metrics"
Cohesion: 0.28
Nodes (5): load(), load(), getLegalIdentity(), isPlaceholder(), read()

### Community 30 - "Reminders Engine"
Cohesion: 0.33
Nodes (7): categoryLabel(), computeReminders(), push(), allergenEntry(), entry(), input(), isolated()

### Community 31 - "Community 31"
Cohesion: 0.5
Nodes (6): clearTimer(), formatRemaining(), keyFor(), loadTimer(), remainingMs(), saveTimer()

### Community 32 - "Community 32"
Cohesion: 0.48
Nodes (4): listSymptomsByEntry(), load(), ageInMonths(), formatAge()

### Community 33 - "Community 33"
Cohesion: 0.6
Nodes (4): getCategoryClasses(), getCategoryColor(), getCategoryIcon(), getCategoryLabel()

### Community 34 - "Community 34"
Cohesion: 0.6
Nodes (3): signUp(), signUpOwnerAndCreateChild(), unique()

### Community 35 - "Community 35"
Cohesion: 0.6
Nodes (3): defaultTextureForAgeMonths(), getTextureLabel(), isTextureKey()

### Community 37 - "Community 37"
Cohesion: 0.7
Nodes (4): goToNext(), goToPrevious(), makeCurrent(), toggleClass()

### Community 38 - "Community 38"
Cohesion: 0.7
Nodes (4): goToNext(), goToPrevious(), makeCurrent(), toggleClass()

## Knowledge Gaps
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `languageTag()` connect `i18n Messages (auth.*)` to `WebAuthn / Passkeys`, `SEO / JSON-LD Library`, `Branding, App Shell & PWA Manifest`?**
  _High betweenness centrality (0.097) - this node is a cross-community bridge._
- **Why does `setLanguageTag()` connect `SEO / JSON-LD Library` to `i18n Messages (auth.*)`, `Architecture Patterns & Conventions`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `isValidBirthDate()` connect `SEO / JSON-LD Library` to `Migration Tests`, `DB Init, Backup & Seed`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Are the 389 inferred relationships involving `languageTag()` (e.g. with `localizedHref()` and `formatRelative()`) actually correct?**
  _`languageTag()` has 389 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `makeRouteEvent()` (e.g. with `loadFor()` and `makeFormEvent()`) actually correct?**
  _`makeRouteEvent()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 13 inferred relationships involving `requireUser()` (e.g. with `localizedRedirect()` and `load()`) actually correct?**
  _`requireUser()` has 13 INFERRED edges - model-reasoned connections that need verification._
- **Are the 8 inferred relationships involving `seedChild()` (e.g. with `setup()` and `setup()`) actually correct?**
  _`seedChild()` has 8 INFERRED edges - model-reasoned connections that need verification._
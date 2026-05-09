# Graph Report - diversif  (2026-05-09)

## Corpus Check
- 275 files · ~376,166 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1564 nodes · 2180 edges · 180 communities (125 shown, 55 thin omitted)
- Extraction: 82% EXTRACTED · 18% INFERRED · 0% AMBIGUOUS · INFERRED: 388 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `debe4c24`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_i18n Messages (auth.)|i18n Messages (auth.*)]]
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
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 83|Community 83]]
- [[_COMMUNITY_Community 85|Community 85]]
- [[_COMMUNITY_Community 86|Community 86]]
- [[_COMMUNITY_Community 87|Community 87]]
- [[_COMMUNITY_Community 88|Community 88]]
- [[_COMMUNITY_Community 89|Community 89]]
- [[_COMMUNITY_Community 90|Community 90]]
- [[_COMMUNITY_Community 91|Community 91]]
- [[_COMMUNITY_Community 92|Community 92]]
- [[_COMMUNITY_Community 93|Community 93]]
- [[_COMMUNITY_Community 94|Community 94]]
- [[_COMMUNITY_Community 95|Community 95]]
- [[_COMMUNITY_Community 141|Community 141]]
- [[_COMMUNITY_Community 142|Community 142]]
- [[_COMMUNITY_Community 143|Community 143]]
- [[_COMMUNITY_Community 144|Community 144]]
- [[_COMMUNITY_Community 145|Community 145]]
- [[_COMMUNITY_Community 146|Community 146]]
- [[_COMMUNITY_Community 147|Community 147]]
- [[_COMMUNITY_Community 155|Community 155]]
- [[_COMMUNITY_Community 156|Community 156]]
- [[_COMMUNITY_Community 157|Community 157]]
- [[_COMMUNITY_Community 158|Community 158]]
- [[_COMMUNITY_Community 159|Community 159]]
- [[_COMMUNITY_Community 160|Community 160]]
- [[_COMMUNITY_Community 161|Community 161]]
- [[_COMMUNITY_Community 162|Community 162]]
- [[_COMMUNITY_Community 163|Community 163]]
- [[_COMMUNITY_Community 164|Community 164]]
- [[_COMMUNITY_Community 165|Community 165]]
- [[_COMMUNITY_Community 166|Community 166]]
- [[_COMMUNITY_Community 167|Community 167]]
- [[_COMMUNITY_Community 168|Community 168]]
- [[_COMMUNITY_Community 169|Community 169]]
- [[_COMMUNITY_Community 170|Community 170]]
- [[_COMMUNITY_Community 171|Community 171]]
- [[_COMMUNITY_Community 172|Community 172]]
- [[_COMMUNITY_Community 173|Community 173]]
- [[_COMMUNITY_Community 174|Community 174]]
- [[_COMMUNITY_Community 175|Community 175]]
- [[_COMMUNITY_Community 176|Community 176]]
- [[_COMMUNITY_Community 177|Community 177]]
- [[_COMMUNITY_Community 178|Community 178]]
- [[_COMMUNITY_Community 179|Community 179]]

## God Nodes (most connected - your core abstractions)
1. `languageTag()` - 245 edges
2. `makeRouteEvent()` - 35 edges
3. `resetTestDb()` - 31 edges
4. `requireUser()` - 30 edges
5. `safeUser()` - 23 edges
6. `seedChild()` - 22 edges
7. `captureFlow()` - 21 edges
8. `requireMembership()` - 20 edges
9. `parseChildIdParam()` - 18 edges
10. `localizedRedirect()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `RGPD compliance: legal pages, consent, exports, deletion` --semantically_similar_to--> `Strict PII posture: errorId-only correlation, no user/IP/body`  [INFERRED] [semantically similar]
  README.md → docs/superpowers/specs/2026-05-06-observability-sentry-design.md
- `i18n via @inlang/paraglide-sveltekit (FR default, /en/ for English)` --conceptually_related_to--> `i18n Scaffolding (FR + EN) design spec`  [INFERRED]
  README.md → docs/superpowers/specs/2026-05-07-i18n-scaffolding-design.md
- `PWA via @vite-pwa/sveltekit with offline log queue` --conceptually_related_to--> `PWA Offline Log Queue design spec`  [INFERRED]
  README.md → docs/superpowers/specs/2026-05-07-pwa-offline-log-design.md
- `Observability via @sentry/sveltekit (strict PII)` --conceptually_related_to--> `Observability — Sentry design spec`  [INFERRED]
  README.md → docs/superpowers/specs/2026-05-06-observability-sentry-design.md
- `app.html SvelteKit shell with paraglide lang` --references--> `Favicon: green pin/leaf brand mark`  [EXTRACTED]
  src/app.html → static/favicon.svg

## Hyperedges (group relationships)
- **JSON-LD generators sharing absoluteUrl + SITE** — seo_breadcrumbjsonld, seo_organizationjsonld, seo_websitejsonld, seo_webapplicationjsonld, seo_articlejsonld, seo_faqpagejsonld, seo_absoluteurl, seo_site [EXTRACTED 1.00]
- **UI primitive component kit** — button_svelte, card_svelte, badge_svelte, input_svelte, label_svelte, dialog_svelte [INFERRED 0.85]
- **Form input primitives sharing cn() styling** — select_svelte_component, textarea_svelte_component, cn_util [INFERRED 0.85]
- **Invite generate-validate-rollout** — invites_generate_invite_code_raw, invites_is_valid_invite_code_format, rationale_legacy_invite_acceptance [INFERRED 0.85]
- **Theme storage/resolve/apply pipeline** — theme_get_stored_theme, theme_resolve_theme, theme_apply_theme [EXTRACTED 1.00]
- **Account export GDPR endpoint with throttle + oversize** — account_export_server_get, account_export_throttle_rationale, account_export_oversize_rationale [EXTRACTED 0.85]
- **Passkey registration flow** — passkeys_reg_options_server, passkeys_reg_verify_server [INFERRED 0.95]
- **Sentry PII scrub pipeline (server + client + scrubEvent + privacy policy)** — spec_observability_sentry, concept_scrub_event, concept_strict_pii_posture, concept_route_pattern_scrub, concept_privacy_policy_sentry_disclosure [EXTRACTED 1.00]
- **Offline log replay flow: queue + idempotency + transaction** — concept_offline_queue_idb, concept_with_idempotency_key, concept_idempotency_keys_table, concept_log_action_transaction [EXTRACTED 1.00]
- **i18n translation slice: reroute + switcher + errorKey + FR-only banners + hreflang** — concept_paraglide_reroute, concept_locale_switcher, concept_error_key_pattern, concept_fr_only_banner, concept_seo_alternate_locales [EXTRACTED 1.00]
- **Diversif PWA branding assets (shell + icons + OG)** — app_html_shell, favicon_svg_brand, icon_192_png, icon_512_png, og_image_svg, diversif_brand_color_6b8e6b [EXTRACTED 1.00]
- **Dependabot remediation via overrides + targeted bumps** — project_dependabot_followup_pr26_vite, project_dependabot_followup_pr43_overrides, project_dependabot_followup_pr50_overrides, project_dependabot_followup_overrides_pattern [EXTRACTED 1.00]
- **Diversif test infra: resetTestDb + hashPassword fan-out** — query_20260505_135209_resettestdb_bridge, query_20260505_140943_hashpassword_fanout, project_stack_tests, project_stack_auth [INFERRED 0.85]

## Communities (180 total, 55 thin omitted)

### Community 0 - "i18n Messages (auth.*)"
Cohesion: 0.02
Nodes (236): authAccountAppearanceDescription(), authAccountAppearanceSection(), authAccountBack(), authAccountCurrentPasswordLabel(), authAccountDataDescription(), authAccountDataExport(), authAccountDataSection(), authAccountDeleteConfirmLabel() (+228 more)

### Community 3 - "Page Loaders & Form Actions"
Cohesion: 0.08
Nodes (25): seed(), loadFor(), setup(), setup(), loadFor(), setup(), setup(), setup() (+17 more)

### Community 4 - "Test Fixtures & Setup Helpers"
Cohesion: 0.07
Nodes (41): load(), load(), POST(), createSession(), findUserByEmail(), getDecoyHash(), invalidateAllUserSessions(), newToken() (+33 more)

### Community 5 - "Branding, App Shell & PWA Manifest"
Cohesion: 0.07
Nodes (31): load(), allergens load test, findActiveInvitation(), load(), userHasMembership(), isUniqueViolation(), load(), loadEntry() (+23 more)

### Community 6 - "Architecture Patterns & Conventions"
Cohesion: 0.06
Nodes (47): errorKey pattern for i18n form errors, FR-only banner for guide/legal/sources pages, idempotency_keys table (key, user_id, scope, redirect, created_at), InstallPrompt: Android beforeinstallprompt + iOS instructions modal, LocaleSwitcher FR/EN pill component, LogActionAbort sentinel pattern, Wrap log form action in db.transaction with LogActionAbort sentinel, Dot-namespaced message keys (chrome.*, auth.*, errors.*) (+39 more)

### Community 7 - "Auth Routes & i18n Routing"
Cohesion: 0.09
Nodes (24): load(), getStageForAgeMonths(), getTipsFor(), pickRotatingTip(), dismissReminder(), loadAnalyticsBuckets(), loadCoparentActivity(), loadDismissals() (+16 more)

### Community 8 - "UI Components & Tests"
Cohesion: 0.05
Nodes (6): #each(), #each(), setPagePathname(), textSnippet(), getChildNavItems(), isNavItemActive()

### Community 9 - "WebAuthn / Passkeys"
Cohesion: 0.09
Nodes (15): clear(), deleteRow(), emit(), enqueue(), flush(), openDb(), postOne(), readAllOrdered() (+7 more)

### Community 10 - "Offline Log Queue (IndexedDB)"
Cohesion: 0.1
Nodes (16): filterIncomingBreadcrumb(), scrubEvent(), scrubPathname(), scrubUrlString(), POST(), enforceLanguageTag(), setLanguageTag(), invalidateSession() (+8 more)

### Community 11 - "User Memory & Medical Audit"
Cohesion: 0.19
Nodes (11): absoluteUrl(), articleJsonLd(), breadcrumbJsonLd(), faqPageJsonLd(), organizationJsonLd(), resolveOrigin(), webApplicationJsonLd(), websiteJsonLd() (+3 more)

### Community 12 - "SEO / JSON-LD Library"
Cohesion: 0.13
Nodes (8): $components/ui/Badge.svelte, $lib/utils/cn, Select.svelte UI component, Select component tests, $lib/content/sources, Textarea.svelte UI component, Textarea component tests, $lib/utils/theme

### Community 13 - "UI Component Library"
Cohesion: 0.16
Nodes (7): GET(), audit(), deleteUserAccount(), ExportTooLargeError, exportUserData(), isoOrNull(), isoOrThrow()

### Community 14 - "Account Export / Delete"
Cohesion: 0.27
Nodes (11): addSortIndicators(), enableUI(), getNthColumn(), getTable(), getTableBody(), getTableHeader(), loadColumns(), loadData() (+3 more)

### Community 15 - "DB Init, Backup & Seed"
Cohesion: 0.27
Nodes (11): addSortIndicators(), enableUI(), getNthColumn(), getTable(), getTableBody(), getTableHeader(), loadColumns(), loadData() (+3 more)

### Community 16 - "Allergens & Milestones"
Cohesion: 0.21
Nodes (7): backupBeforeMigrate(), resolveBackupKeep(), ensureDir(), getDb(), resolveDbPath(), applySeedCorrections(), seedFoods()

### Community 17 - "Sentry Observability"
Cohesion: 0.21
Nodes (14): 12 allergens misattributed to HCSP (actually EU 1169/2011), Medical-content audit 2026-05-08, Egg portion contradiction between guidance.ts:73 and :240, Three parallel agents methodology (PR-diff, age, quantity), Walnut oil mistranslated as 'noix de beurre' (knob of butter), oeuf-cru wrong age cliff (12mo vs 3 ans), Soja: ESPGHAN-permissive vs HCSP/ANSES-conservative, ANSES NUT2017SA0145 0–3 ans nutrition (+6 more)

### Community 18 - "Legal Pages"
Cohesion: 0.22
Nodes (4): logHref(), getAllergenLabel(), celebrate(), pickMilestoneFromQuery()

### Community 19 - "Invitations & Memberships"
Cohesion: 0.35
Nodes (8): a(), B(), D(), g(), i(), k(), Q(), y()

### Community 20 - "SEO Source-of-Truth Config"
Cohesion: 0.35
Nodes (8): a(), B(), D(), g(), i(), k(), Q(), y()

### Community 21 - "Diversification Guidance & Stages"
Cohesion: 0.28
Nodes (5): load(), load(), getLegalIdentity(), isPlaceholder(), read()

### Community 22 - "UI Primitives & LEAP/EAT Cards"
Cohesion: 0.33
Nodes (9): absoluteUrl, articleJsonLd, breadcrumbJsonLd, Centralised SEO/JSON-LD source-of-truth pattern, organizationJsonLd, resolveOrigin, SITE config (centralised SEO), webApplicationJsonLd (+1 more)

### Community 23 - "Migration Tests"
Cohesion: 0.33
Nodes (9): PWA manifest + apple-touch-icon links, app.html SvelteKit shell with paraglide lang, theme-init.js sync script (avoid theme flash), Brand color #6b8e6b (sage green), Favicon: green pin/leaf brand mark, PWA icon 192x192 (green disc), PWA icon 512x512 (green disc), OG image: Diversifier en confiance hero (+1 more)

### Community 25 - "Reaction Reports & Reminders"
Cohesion: 0.6
Nodes (4): getCategoryClasses(), getCategoryColor(), getCategoryIcon(), getCategoryLabel()

### Community 26 - "Idempotency Primitive"
Cohesion: 0.47
Nodes (3): applyMigrationFile(), buildDbAt0006(), markMigrationsApplied()

### Community 27 - "Auth Guards & Sessions"
Cohesion: 0.4
Nodes (6): Passkey Auth Options POST, Passkey Auth Options test, Passkey Auth Verify POST, Passkey Registration Options POST, Passkey Registration Verify POST, Why we don't reset rate-limit bucket on success

### Community 28 - "Reactions Vocabulary"
Cohesion: 0.6
Nodes (3): signUp(), signUpOwnerAndCreateChild(), unique()

### Community 29 - "Diversity Metrics"
Cohesion: 0.7
Nodes (4): goToNext(), goToPrevious(), makeCurrent(), toggleClass()

### Community 30 - "Reminders Engine"
Cohesion: 0.7
Nodes (4): goToNext(), goToPrevious(), makeCurrent(), toggleClass()

### Community 31 - "Community 31"
Cohesion: 0.4
Nodes (5): Periodic cleanup of expired rows, Cleanup tests, Rate-limit subsystem (referenced), Rate-limit tests, Drop rate-limit buckets older than 1h auth window

### Community 32 - "Community 32"
Cohesion: 0.4
Nodes (5): server/cleanup.ts (periodic cleanup), checkRateLimit, clientKey, evictExpiredRateLimits, resetRateLimit

### Community 33 - "Community 33"
Cohesion: 0.4
Nodes (5): generateInviteCodeRaw, isValidInviteCodeFormat, src/lib/utils/invites.test.ts, Invite codes bumped from 4 to 6 chars for entropy, Accept legacy 4-char codes during 7-day TTL rollout

### Community 36 - "Community 36"
Cohesion: 0.67
Nodes (4): applyTheme, getStoredTheme, resolveTheme, src/lib/utils/theme.test.ts

### Community 37 - "Community 37"
Cohesion: 0.5
Nodes (4): src/routes/+layout.server.ts, src/routes/layout.server.test.ts, src/routes/+page.server.ts, src/routes/page.server.test.ts

### Community 38 - "Community 38"
Cohesion: 0.5
Nodes (4): Refuse oversize export instead of truncating (Article 15), GET /account/export, account export GET tests, Atomic throttle prevents concurrent exports

### Community 39 - "Community 39"
Cohesion: 0.5
Nodes (4): mentions-legales +page.server.ts, mentions-legales page.server.test.ts, politique-confidentialite +page.server.ts, politique-confidentialite page.server.test.ts

### Community 54 - "Community 54"
Cohesion: 0.67
Nodes (3): EAT 2016 trial, ESPGHAN Complementary Feeding 2017, LEAP 2015 trial

### Community 55 - "Community 55"
Cohesion: 0.67
Nodes (3): getChildNavItems, isNavItemActive, src/lib/utils/nav.test.ts

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (3): fuzzyMatch, normalize, src/lib/utils/search.test.ts

### Community 57 - "Community 57"
Cohesion: 0.67
Nodes (3): join/[code] +page.server.ts, join/[code] page.server.test.ts, GET only inspects state; POST consumes one-shot invite to avoid prefetch consumption

### Community 58 - "Community 58"
Cohesion: 0.67
Nodes (3): Read GRAPH_REPORT.md before answering architecture questions, Prefer graphify query/path/explain over grep, Graphify usage rules for Claude

## Knowledge Gaps
- **113 isolated node(s):** `resolveOrigin`, `breadcrumbJsonLd`, `faqPageJsonLd`, `Centralised SEO/JSON-LD source-of-truth pattern`, `$lib/seo` (+108 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **55 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `languageTag()` connect `i18n Messages (auth.*)` to `Community 50`, `Offline Log Queue (IndexedDB)`, `Community 52`?**
  _High betweenness centrality (0.092) - this node is a cross-community bridge._
- **Why does `setLanguageTag()` connect `Offline Log Queue (IndexedDB)` to `i18n Messages (auth.*)`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `validateSession()` connect `Page Loaders & Form Actions` to `Offline Log Queue (IndexedDB)`, `Test Fixtures & Setup Helpers`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Are the 239 inferred relationships involving `languageTag()` (e.g. with `localizedHref()` and `formatRelative()`) actually correct?**
  _`languageTag()` has 239 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `makeRouteEvent()` (e.g. with `loadFor()` and `loadFor()`) actually correct?**
  _`makeRouteEvent()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 14 inferred relationships involving `requireUser()` (e.g. with `localizedRedirect()` and `load()`) actually correct?**
  _`requireUser()` has 14 INFERRED edges - model-reasoned connections that need verification._
- **Are the 3 inferred relationships involving `safeUser()` (e.g. with `loadFor()` and `loadFor()`) actually correct?**
  _`safeUser()` has 3 INFERRED edges - model-reasoned connections that need verification._
# Graph Report - src  (2026-05-05)

## Corpus Check
- Large corpus: 208 files · ~71,480 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 719 nodes · 887 edges · 124 communities (92 shown, 32 thin omitted)
- Extraction: 83% EXTRACTED · 17% INFERRED · 0% AMBIGUOUS · INFERRED: 147 edges (avg confidence: 0.82)
- Token cost: 455,996 input · 80,474 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Test Seed Helpers|Test Seed Helpers]]
- [[_COMMUNITY_App Shell & Navigation|App Shell & Navigation]]
- [[_COMMUNITY_Passkey  WebAuthn|Passkey / WebAuthn]]
- [[_COMMUNITY_Route Loaders & Guards|Route Loaders & Guards]]
- [[_COMMUNITY_UI Primitives|UI Primitives]]
- [[_COMMUNITY_Allergens & Foods Loaders|Allergens & Foods Loaders]]
- [[_COMMUNITY_Reaction Widgets|Reaction Widgets]]
- [[_COMMUNITY_Server Auth & GDPR Cleanup|Server Auth & GDPR Cleanup]]
- [[_COMMUNITY_Database Schema & Catalogs|Database Schema & Catalogs]]
- [[_COMMUNITY_Hooks & Auth Tests|Hooks & Auth Tests]]
- [[_COMMUNITY_Login, Logout, Mentions Légales|Login, Logout, Mentions Légales]]
- [[_COMMUNITY_Dashboard Data Loaders|Dashboard Data Loaders]]
- [[_COMMUNITY_SEO JSON-LD Helpers|SEO JSON-LD Helpers]]
- [[_COMMUNITY_Account & Root Layout|Account & Root Layout]]
- [[_COMMUNITY_GDPR Data Export|GDPR Data Export]]
- [[_COMMUNITY_Diversification Guidance Content|Diversification Guidance Content]]
- [[_COMMUNITY_Cleanup & Rate Limiting|Cleanup & Rate Limiting]]
- [[_COMMUNITY_Age Stages & Tips|Age Stages & Tips]]
- [[_COMMUNITY_Child Settings, New, Guide|Child Settings, New, Guide]]
- [[_COMMUNITY_Database Backup & Migrations|Database Backup & Migrations]]
- [[_COMMUNITY_Invitation Codes|Invitation Codes]]
- [[_COMMUNITY_Allergen Education Components|Allergen Education Components]]
- [[_COMMUNITY_Food Log & Suggestions|Food Log & Suggestions]]
- [[_COMMUNITY_Sitemap & Sources Routes|Sitemap & Sources Routes]]
- [[_COMMUNITY_Legal Identity Module|Legal Identity Module]]
- [[_COMMUNITY_Theme System|Theme System]]
- [[_COMMUNITY_Security Headers & Hooks|Security Headers & Hooks]]
- [[_COMMUNITY_SEO Source of Truth|SEO Source of Truth]]
- [[_COMMUNITY_Date Utilities|Date Utilities]]
- [[_COMMUNITY_Public Header & Footer|Public Header & Footer]]
- [[_COMMUNITY_Search Routes|Search Routes]]
- [[_COMMUNITY_Rate-Limit Internals|Rate-Limit Internals]]
- [[_COMMUNITY_Invite Code Format|Invite Code Format]]
- [[_COMMUNITY_Export & Throttle Rationales|Export & Throttle Rationales]]
- [[_COMMUNITY_Sources Module|Sources Module]]
- [[_COMMUNITY_Allergens Helpers|Allergens Helpers]]
- [[_COMMUNITY_Categories Helpers|Categories Helpers]]
- [[_COMMUNITY_cn (classnames) Util|cn (classnames) Util]]
- [[_COMMUNITY_Reactions Helpers|Reactions Helpers]]
- [[_COMMUNITY_Passkey Browser Wiring|Passkey Browser Wiring]]
- [[_COMMUNITY_JsonLd & Seo Components|JsonLd & Seo Components]]
- [[_COMMUNITY_Child Nav Helpers|Child Nav Helpers]]
- [[_COMMUNITY_Fuzzy Search Helpers|Fuzzy Search Helpers]]
- [[_COMMUNITY_Cookies Page & Login Bucket|Cookies Page & Login Bucket]]
- [[_COMMUNITY_Robots.txt|Robots.txt]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]
- [[_COMMUNITY_Community 77|Community 77]]
- [[_COMMUNITY_Community 78|Community 78]]
- [[_COMMUNITY_Community 79|Community 79]]
- [[_COMMUNITY_Community 80|Community 80]]
- [[_COMMUNITY_Community 109|Community 109]]
- [[_COMMUNITY_Community 110|Community 110]]
- [[_COMMUNITY_Community 111|Community 111]]
- [[_COMMUNITY_Community 112|Community 112]]
- [[_COMMUNITY_Community 113|Community 113]]
- [[_COMMUNITY_Community 114|Community 114]]
- [[_COMMUNITY_Community 115|Community 115]]
- [[_COMMUNITY_Community 116|Community 116]]
- [[_COMMUNITY_Community 117|Community 117]]
- [[_COMMUNITY_Community 118|Community 118]]
- [[_COMMUNITY_Community 119|Community 119]]
- [[_COMMUNITY_Community 120|Community 120]]
- [[_COMMUNITY_Community 121|Community 121]]
- [[_COMMUNITY_Community 122|Community 122]]
- [[_COMMUNITY_Community 123|Community 123]]

## God Nodes (most connected - your core abstractions)
1. `makeRouteEvent()` - 30 edges
2. `resetTestDb()` - 28 edges
3. `seedChild()` - 18 edges
4. `captureFlow()` - 17 edges
5. `safeUser()` - 17 edges
6. `POST()` - 14 edges
7. `Diversification guidance content (FR)` - 14 edges
8. `requireUser()` - 13 edges
9. `seedUser()` - 13 edges
10. `seedMembership()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `seedUser()` --calls--> `hashPassword()`  [INFERRED]
  hooks.server.test.ts → lib/server/auth.ts
- `load()` --calls--> `resolveOrigin()`  [INFERRED]
  routes/+layout.server.ts → lib/seo.ts
- `seed()` --calls--> `hashPassword()`  [INFERRED]
  routes/account/page.server.test.ts → lib/server/auth.ts
- `seedTestUser()` --calls--> `hashPassword()`  [INFERRED]
  routes/login/page.server.test.ts → lib/server/auth.ts
- `seedUserAndKey()` --calls--> `hashPassword()`  [INFERRED]
  routes/passkeys/authentication/verify/server.test.ts → lib/server/auth.ts

## Hyperedges (group relationships)
- **JSON-LD generators sharing absoluteUrl + SITE** — seo_breadcrumbjsonld, seo_organizationjsonld, seo_websitejsonld, seo_webapplicationjsonld, seo_articlejsonld, seo_faqpagejsonld, seo_absoluteurl, seo_site [EXTRACTED 1.00]
- **Child-scoped navigation shell (responsive)** — appshell_component, bottomnav_component, guidestaticsections_component [INFERRED 0.85]
- **Early allergen introduction evidence chain (LEAP/EAT -> guidance UI)** — leap_study, eat_study, early_allergen_introduction_principle, allergeninfodialog_component, guidestaticsections_component [EXTRACTED 1.00]
- **Public site chrome (header/footer/legal links)** — publicheader_component, publicfooter_component, legallinks_component [INFERRED 0.85]
- **SEO metadata stack (Seo + JsonLd + seo lib)** — seo_component, jsonld_component, seo_lib [INFERRED 0.85]
- **Reaction UI widgets (badge/picker/reactions module)** — reactionbadge_component, reactionpicker_component, reactions_module [EXTRACTED 1.00]
- **Landing page sections composed together** — landinghero_svelte, landingfeatures_svelte, landingtrust_svelte, landingclosingcta_svelte [INFERRED 0.85]
- **UI primitive component kit** — button_svelte, card_svelte, badge_svelte, input_svelte, label_svelte, dialog_svelte [INFERRED 0.85]
- **Accessible modal dialog pattern** — dialog_svelte, concept_wcag_sc_2_4_3, concept_focus_trap, welcomedialog_svelte [INFERRED 0.85]
- **Form input primitives sharing cn() styling** — select_svelte_component, textarea_svelte_component, cn_util [INFERRED 0.85]
- **Session lifecycle: create, validate/renew, expire** — auth_module, cleanup_module, guards_module [INFERRED 0.85]
- **RGPD compliance: deletion, export, retention** — gdpr_module, cleanup_module, legal_module [INFERRED 0.75]
- **Early-allergen-introduction evidence base** — study_leap_2015, study_eat_2016, study_espghan_2017 [INFERRED 0.95]
- **WebAuthn passkey registration/auth flow** — passkeys_module, auth_module, db_schema [INFERRED 0.85]
- **Pre-migration safety: backup + FK-off during migrate + FK check after** — db_get_db, backup_before_migrate, schema_memberships [INFERRED 0.85]
- **Guidance pipeline: queries feed reminder rule engine with dismissals** — guidance_load_recent_entries, guidance_load_dismissals, reminders_compute [INFERRED 0.85]
- **Food catalog taxonomy: foods table populated from FOODS_SEED tagged by categories and allergens** — schema_foods, seed_foods_seed_data, categories_module [EXTRACTED 1.00]
- **Theme storage/resolve/apply pipeline** — theme_get_stored_theme, theme_resolve_theme, theme_apply_theme [EXTRACTED 1.00]
- **Invite generate-validate-rollout** — invites_generate_invite_code_raw, invites_is_valid_invite_code_format, rationale_legacy_invite_acceptance [INFERRED 0.85]
- **Account self-service: profile, password, deletion** — account_page_server, account_page_svelte, account_deleted_page_svelte [INFERRED 0.85]
- **Child dashboard load chain** — child_layout_server_load, child_page_server_load, child_page_svelte [INFERRED 0.85]
- **Child subroutes (allergens, foods, guide)** — child_allergens_page_server_load, child_foods_page_server_load, child_guide_page_server_load [INFERRED 0.75]
- **Account export GDPR endpoint with throttle + oversize** — account_export_server_get, account_export_throttle_rationale, account_export_oversize_rationale [EXTRACTED 0.85]
- **Invitation creation, join consumption, and settings management** — child_id_settings_page_server, join_code_page_server, child_id_settings_page_svelte [INFERRED 0.85]
- **Food log creation and edit/delete CRUD flow** — child_id_log_page_svelte, child_id_log_entryid_page_server, child_id_log_entryid_page_svelte [INFERRED 0.85]
- **Child-scoped routes (settings, suggestions, log)** — child_id_settings_page_server, child_id_suggestions_page_server, child_id_log_entryid_page_server [INFERRED 0.75]
- **Passkey authentication flow** — login_sign_in_with_passkey, passkeys_auth_options_server, passkeys_auth_verify_server [INFERRED 0.95]
- **Passkey registration flow** — passkeys_reg_options_server, passkeys_reg_verify_server [INFERRED 0.95]
- **RGPD legal pages bundle** — mentions_legales_page_svelte, politique_page_svelte, signup_page_svelte [INFERRED 0.85]
- **Shared test harness for SvelteKit routes** — test_db, test_route, test_app_stubs [INFERRED 0.85]
- **Sources route (server load + svelte page + test)** — sources_page_server, sources_page_svelte, sources_page_server_test [EXTRACTED 1.00]

## Communities (124 total, 32 thin omitted)

### Community 0 - "Test Seed Helpers"
Cohesion: 0.12
Nodes (15): setup(), setup(), setup(), setup(), setup(), setup(), resetTestDb(), captureFlow() (+7 more)

### Community 1 - "App Shell & Navigation"
Cohesion: 0.07
Nodes (6): #each(), #each(), setPagePathname(), textSnippet(), getChildNavItems(), isNavItemActive()

### Community 2 - "Passkey / WebAuthn"
Cohesion: 0.13
Nodes (21): POST(), base64UrlToBuffer(), bufferToBase64Url(), buildAuthenticationOptions(), buildRegistrationOptions(), consumeChallenge(), createChallenge(), deletePasskey() (+13 more)

### Community 3 - "Route Loaders & Guards"
Cohesion: 0.11
Nodes (14): load(), load(), loadEntry(), parseEntryId(), load(), load(), load(), load() (+6 more)

### Community 4 - "UI Primitives"
Cohesion: 0.08
Nodes (5): 12 priority allergens, Focus trap (Tab cycling), Food diversification 4 months to 3 years, LEAP & EAT studies (early allergen introduction), WCAG SC 2.4.3 focus management for modals

### Community 5 - "Allergens & Foods Loaders"
Cohesion: 0.09
Nodes (24): load(), allergens load test, allergens public landing page, child/[id]/allergens load (per-allergen status), child/[id]/allergens load tests, child/[id]/allergens view, child/[id]/foods load (filters + repeat), child/[id]/foods load tests (+16 more)

### Community 6 - "Reaction Widgets"
Cohesion: 0.11
Nodes (11): $components/ui/Badge.svelte, $lib/utils/cn, $lib/content/guidance, $lib/utils/reactions, $lib/server/guidance/reminders, Select.svelte UI component, Select component tests, $lib/content/sources (+3 more)

### Community 7 - "Server Auth & GDPR Cleanup"
Cohesion: 0.11
Nodes (25): Server auth (sessions, passwords), Session validation tests, Auth tests, db/backup.ts, Periodic cleanup of expired rows, Cleanup tests, RGPD Article 15 (right of access), RGPD Article 17 (right to erasure) (+17 more)

### Community 8 - "Database Schema & Catalogs"
Cohesion: 0.11
Nodes (25): utils/allergens.ts (ALLERGENS catalog), backupBeforeMigrate (VACUUM INTO snapshot + rotation), resolveBackupKeep, utils/categories.ts (CATEGORIES catalog), getDb, db/schema.ts (Drizzle schema), dismissReminder, loadDismissals (+17 more)

### Community 9 - "Hooks & Auth Tests"
Cohesion: 0.12
Nodes (18): seed(), seedTestUser(), POST(), seed(), createSession(), findUserByEmail(), hashPassword(), invalidateAllUserSessions() (+10 more)

### Community 10 - "Login, Logout, Mentions Légales"
Cohesion: 0.1
Nodes (24): login page.server.test.ts, Login Page (Svelte), signInWithPasskey, Logout POST handler, logout server.test.ts, mentions-legales +page.server.ts, mentions-legales page.server.test.ts, Mentions Légales page (+16 more)

### Community 11 - "Dashboard Data Loaders"
Cohesion: 0.14
Nodes (12): dismissReminder(), loadDismissals(), loadDiversityMetrics(), loadRecentEntries(), loadRepeatCandidates(), ttlForReminderKey(), categoryLabel(), computeReminders() (+4 more)

### Community 12 - "SEO JSON-LD Helpers"
Cohesion: 0.17
Nodes (11): absoluteUrl(), articleJsonLd(), breadcrumbJsonLd(), faqPageJsonLd(), organizationJsonLd(), resolveOrigin(), webApplicationJsonLd(), websiteJsonLd() (+3 more)

### Community 13 - "Account & Root Layout"
Cohesion: 0.14
Nodes (16): src/routes/account/deleted/+page.svelte, src/routes/account/+page.server.ts, src/routes/account/page.server.test.ts, src/routes/account/+page.svelte, src/routes/+error.svelte, src/routes/+layout.server.ts, src/routes/layout.server.test.ts, src/routes/+layout.svelte (+8 more)

### Community 14 - "GDPR Data Export"
Cohesion: 0.17
Nodes (6): GET(), deleteUserAccount(), ExportTooLargeError, exportUserData(), isoOrNull(), isoOrThrow()

### Community 15 - "Diversification Guidance Content"
Cohesion: 0.15
Nodes (15): Allergen taxonomy, Food category taxonomy, Diversification guidance content (FR), Guidance integrity tests, 1000 premiers jours, ANSES Repères alimentaires nourrissons, HCSP 2020 repères alimentaires <3 ans, SFP DME position (+7 more)

### Community 16 - "Cleanup & Rate Limiting"
Cohesion: 0.27
Nodes (9): runCleanup(), startCleanupTimer(), stopCleanupTimer(), bucketKey(), checkRateLimit(), _clearAllRateLimits(), clientKey(), evictExpiredRateLimits() (+1 more)

### Community 17 - "Age Stages & Tips"
Cohesion: 0.2
Nodes (7): getStageForAgeMonths(), getTipsFor(), pickRotatingTip(), load(), load(), ageInMonths(), formatAge()

### Community 18 - "Child Settings, New, Guide"
Cohesion: 0.14
Nodes (14): child/[id]/settings +page.server.ts, child/[id]/settings page.server.test.ts, child/[id]/settings +page.svelte, child/new +page.server.ts, child/new page.server.test.ts, child/new +page.svelte, guide +page.server.ts, guide page.server.test.ts (+6 more)

### Community 19 - "Database Backup & Migrations"
Cohesion: 0.27
Nodes (6): backupBeforeMigrate(), resolveBackupKeep(), ensureDir(), getDb(), resolveDbPath(), seedFoods()

### Community 20 - "Invitation Codes"
Cohesion: 0.27
Nodes (6): findActiveInvitation(), load(), userHasMembership(), generateUniqueInviteCode(), generateInviteCodeRaw(), isValidInviteCodeFormat()

### Community 21 - "Allergen Education Components"
Cohesion: 0.22
Nodes (9): AllergenInfoDialog component, AllergenProgress component, DiversityCard component, Early allergen introduction principle (4-11 months), EAT study (early allergen introduction), GuideStaticSections component, STATIC_NAV_SECTIONS, LEAP study (peanut allergy) (+1 more)

### Community 22 - "Food Log & Suggestions"
Cohesion: 0.22
Nodes (10): child/[id]/log/[entryId] +page.server.ts, child/[id]/log/[entryId] page.server.test.ts, child/[id]/log/[entryId] +page.svelte, child/[id]/log page.server.test.ts, child/[id]/log +page.svelte (Logguer un aliment), child/[id]/suggestions +page.server.ts, child/[id]/suggestions page.server.test.ts, child/[id]/suggestions +page.svelte (+2 more)

### Community 23 - "Sitemap & Sources Routes"
Cohesion: 0.27
Nodes (10): Rationale: FK off during migrate, on after, with foreign_key_check, Rationale: stable per-page lastmod prevents crawler distrust, signup +page.server tests, sitemap.xml GET handler, sitemap.xml GET tests, sources +page.server load, sources +page.server tests, sources +page.svelte (+2 more)

### Community 24 - "Legal Identity Module"
Cohesion: 0.28
Nodes (5): load(), load(), getLegalIdentity(), isPlaceholder(), read()

### Community 25 - "Theme System"
Cohesion: 0.33
Nodes (4): handler(), applyTheme(), getStoredTheme(), resolveTheme()

### Community 26 - "Security Headers & Hooks"
Cohesion: 0.25
Nodes (9): App.Locals, handle (SvelteKit Handle hook), PERMISSIONS_POLICY constant, Security headers strategy (CSP/HSTS/Referrer/Frame-Options), Sliding session-cookie renewal, makeEvent (test helper), seedUser (test helper), X-Robots-Tag noindex invariant for auth/account (+1 more)

### Community 27 - "SEO Source of Truth"
Cohesion: 0.33
Nodes (9): absoluteUrl, articleJsonLd, breadcrumbJsonLd, Centralised SEO/JSON-LD source-of-truth pattern, organizationJsonLd, resolveOrigin, SITE config (centralised SEO), webApplicationJsonLd (+1 more)

### Community 28 - "Date Utilities"
Cohesion: 0.48
Nodes (5): formatDateInputValue(), formatDateTime(), formatRelative(), isValidBirthDate(), parseDateTimeLocal()

### Community 30 - "Search Routes"
Cohesion: 0.47
Nodes (3): load(), fuzzyMatch(), normalize()

### Community 31 - "Rate-Limit Internals"
Cohesion: 0.33
Nodes (6): server/cleanup.ts (periodic cleanup), db/index.ts (Drizzle SQLite client), checkRateLimit, clientKey, evictExpiredRateLimits, resetRateLimit

### Community 33 - "Invite Code Format"
Cohesion: 0.4
Nodes (5): generateInviteCodeRaw, isValidInviteCodeFormat, src/lib/utils/invites.test.ts, Invite codes bumped from 4 to 6 chars for entropy, Accept legacy 4-char codes during 7-day TTL rollout

### Community 34 - "Export & Throttle Rationales"
Cohesion: 0.4
Nodes (5): Refuse oversize export instead of truncating (Article 15), GET /account/export, account export GET tests, Atomic throttle prevents concurrent exports, Conditions générales d'utilisation page

### Community 46 - "Child Nav Helpers"
Cohesion: 0.67
Nodes (3): getChildNavItems, isNavItemActive, src/lib/utils/nav.test.ts

### Community 47 - "Fuzzy Search Helpers"
Cohesion: 1.0
Nodes (3): fuzzyMatch, normalize, src/lib/utils/search.test.ts

### Community 48 - "Cookies Page & Login Bucket"
Cohesion: 0.67
Nodes (3): cookies +page.svelte (Cookies info page), login +page.server.ts, Do NOT reset rate-limit bucket on successful login to prevent attacker bypass

### Community 49 - "Robots.txt"
Cohesion: 0.67
Nodes (3): Disallow private surfaces from crawlers, robots.txt GET, robots.txt test

## Ambiguous Edges - Review These
- `Diversification guidance content (FR)` → `RGPD Article 15 (right of access)`  [AMBIGUOUS]
  src/lib/content/guidance.ts · relation: conceptually_related_to

## Knowledge Gaps
- **150 isolated node(s):** `app.html (HTML shell)`, `theme-init.js inline loader`, `PERMISSIONS_POLICY constant`, `Security headers strategy (CSP/HSTS/Referrer/Frame-Options)`, `X-Robots-Tag noindex invariant for auth/account` (+145 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **32 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `Diversification guidance content (FR)` and `RGPD Article 15 (right of access)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `resetTestDb()` connect `Test Seed Helpers` to `Passkey / WebAuthn`, `Hooks & Auth Tests`, `Dashboard Data Loaders`, `GDPR Data Export`, `Cleanup & Rate Limiting`, `Database Backup & Migrations`?**
  _High betweenness centrality (0.044) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `Route Loaders & Guards` to `Passkey / WebAuthn`, `Dashboard Data Loaders`, `GDPR Data Export`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Why does `makeRouteEvent()` connect `Test Seed Helpers` to `SEO JSON-LD Helpers`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `seedChild()` (e.g. with `setup()` and `setup()`) actually correct?**
  _`seedChild()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `app.html (HTML shell)`, `theme-init.js inline loader`, `PERMISSIONS_POLICY constant` to the rest of the system?**
  _150 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Test Seed Helpers` be split into smaller, more focused modules?**
  _Cohesion score 0.12 - nodes in this community are weakly interconnected._
# Phase 7 — Cleanup & Flag Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Flip the `bentoEnabled` feature flag default-on for everyone by deleting it, its callers, every legacy branch it gated, the legacy AppShell/BottomNav, the BentoOptInBanner + its action, the `/child/[id]/allergens` redirect-only route, and every bento-cookie manipulation in e2e tests.

**Architecture:** The bento UI is the only UI. `data.bento` and `bentoEnabled()` cease to exist. Every `{#if data.bento}` … `{:else}` block collapses to the bento branch; the legacy AppShell, BottomNav, allergens route, opt-in banner, and cookie writes are deleted.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, TailwindCSS 3, paraglide-js, vitest, Playwright.

---

## Task 1: Layout server — drop `bentoEnabled` from the root load

**Files:**

- Modify: `src/routes/+layout.server.ts:7,29,35-36,51-53`
- Modify: `src/routes/layout.server.test.ts` (remove `cookies.set('bento', '1')` setup + any `bento`-related assertions)

- [ ] **Step 1: Delete the import and the flag computation**

In `src/routes/+layout.server.ts`:

- Remove `import { bentoEnabled } from '$lib/feature-flags';`
- Remove `const bento = bentoEnabled(locals.user?.email, cookies);`
- Replace `if (bento && currentChildIdNum && !Number.isNaN(currentChildIdNum) && locals.user) {` with `if (currentChildIdNum && !Number.isNaN(currentChildIdNum) && locals.user) {`
- Rename `bentoFoods` → `foods` if it was renamed only for the bento variant; otherwise keep as-is
- In the returned object, replace `bento, ..., foods: bentoFoods` with `..., foods` (no `bento` field)

- [ ] **Step 2: Update `src/routes/layout.server.test.ts`**

- Remove every `event.cookies.set('bento', '1', ...)` (4 occurrences observed at lines 77, 97, 108, 116)
- Remove any assertion on `result.bento` or `data.bento`
- Keep all other test logic intact

- [ ] **Step 3: Run vitest on the layout test**

Run: `npx vitest run src/routes/layout.server.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/routes/+layout.server.ts src/routes/layout.server.test.ts
git commit -m "chore(layout): drop bentoEnabled from root server load (#90 follow-up)"
```

---

## Task 2: Account server — drop the flag

**Files:**

- Modify: `src/routes/account/+page.server.ts:7,39`
- Modify: `src/routes/account/page.server.test.ts` (remove `event.cookies.set('bento', '1', {})` calls — observed at lines 93, 124, 133, 143)

- [ ] **Step 1: Remove import + caller**

In `src/routes/account/+page.server.ts`:

- Remove `import { bentoEnabled } from '$lib/feature-flags';`
- Remove `const bento = bentoEnabled(user.email, cookies);`
- Remove `bento` from the returned object

- [ ] **Step 2: Strip bento cookie setup from `account/page.server.test.ts`**

Delete every `event.cookies.set('bento', '1', {})` line. Update any assertion that referenced `data.bento`.

- [ ] **Step 3: Run vitest**

Run: `npx vitest run src/routes/account/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/routes/account/+page.server.ts src/routes/account/page.server.test.ts
git commit -m "chore(account): drop bentoEnabled from /account server load"
```

---

## Task 3: Guide server — drop the flag

**Files:**

- Modify: `src/routes/child/[id]/guide/+page.server.ts:3,21`
- Modify: `src/routes/child/[id]/guide/page.server.test.ts` (if it sets the bento cookie or asserts `data.bento`)

- [ ] **Step 1: Remove the import and caller**

In `src/routes/child/[id]/guide/+page.server.ts`:

- Remove `import { bentoEnabled } from '$lib/feature-flags';`
- Remove `const bento = bentoEnabled(locals.user?.email, cookies);`
- Remove `bento` from the returned object

- [ ] **Step 2: Update the matching test file if it references the flag**

Search the test file for `bento` usage and remove cookie setup / assertions.

- [ ] **Step 3: Run vitest**

Run: `npx vitest run src/routes/child/\[id\]/guide/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/routes/child/[id]/guide/
git commit -m "chore(guide): drop bentoEnabled from guide server load"
```

---

## Task 4: Inline the bento branch in `+layout.svelte`

**Files:**

- Modify: `src/routes/+layout.svelte:130`

- [ ] **Step 1: Read the current conditional**

Lines around 130 read `{#if data.bento && (isChildRoute || isAccountRoute)} ... {:else} ... {/if}`. The truthy branch wraps content in the bento AppShellBento with BottomNavBento.

- [ ] **Step 2: Inline the truthy branch and drop the else**

Replace the `{#if data.bento && ...}` … `{:else}` … `{/if}` block with:

- The previous truthy branch, gated only on `(isChildRoute || isAccountRoute)`
- The previous else branch deleted

Remove any helper variables that referenced `data.bento` (e.g., `const showBento = data.bento && ...`).

Drop the legacy `import AppShell from '$lib/components/AppShell.svelte';` and `import BottomNav from '$lib/components/BottomNav.svelte';` lines if they exist.

- [ ] **Step 3: Run vitest on the layout component**

Run: `npx vitest run src/routes/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/routes/+layout.svelte
git commit -m "chore(layout): inline bento branch, drop legacy AppShell wrapper"
```

---

## Task 5: Inline `child/[id]/+layout.svelte`

**Files:**

- Modify: `src/routes/child/[id]/+layout.svelte:12`

- [ ] **Step 1: Inline truthy + remove else**

Read the file. Replace `{#if data.bento} ... {:else} ... {/if}` with the truthy branch only. Drop imports of any legacy-only component referenced solely inside the deleted else.

- [ ] **Step 2: Run vitest**

Run: `npx vitest run src/routes/child/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/routes/child/[id]/+layout.svelte
git commit -m "chore(layout): inline bento branch in /child/[id]"
```

---

## Task 6: Inline `child/[id]/+page.svelte` and remove BentoOptInBanner mount

**Files:**

- Modify: `src/routes/child/[id]/+page.svelte:167-181`

- [ ] **Step 1: Inline + drop BentoOptInBanner**

Replace `{#if data.bento} <AujourdhuiBento ... /> {:else} <BentoOptInBanner ... /> <div class="container ..."> <legacy hero/stats/etc> </div> {/if}` with the bento branch only:

- Keep `<AujourdhuiBento .../>`
- Delete the entire else branch (BentoOptInBanner mount + legacy dashboard)

Drop the now-unused `import BentoOptInBanner from '$lib/components/bento/BentoOptInBanner.svelte';` line.

- [ ] **Step 2: Run vitest on the page test**

Run: `npx vitest run src/routes/child/\[id\]/page.server.test.ts`
Expected: PASS (any `data.bento`-dependent assertions should have been pruned in Task 1)

- [ ] **Step 3: Commit**

```bash
git add src/routes/child/[id]/+page.svelte
git commit -m "chore(dashboard): inline bento Aujourd'hui, remove legacy hero + opt-in banner"
```

---

## Task 7: Inline `child/[id]/foods/+page.svelte` and `child/[id]/guide/+page.svelte`

**Files:**

- Modify: `src/routes/child/[id]/foods/+page.svelte:57-60`
- Modify: `src/routes/child/[id]/guide/+page.svelte:29`

- [ ] **Step 1: For each file**

Inline the `{#if data.bento}` truthy branch and delete the else. Strip imports of legacy-only components referenced inside the deleted else.

If `data.bentoFoods` was referenced, rename to `data.foods` (matching the Task 1 rename) or drop the conditional entirely.

- [ ] **Step 2: Run vitest**

Run: `npx vitest run src/routes/child/\[id\]/foods/ src/routes/child/\[id\]/guide/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/routes/child/[id]/foods/+page.svelte src/routes/child/[id]/guide/+page.svelte
git commit -m "chore(carnet/guide): inline bento branches"
```

---

## Task 8: Inline `account/+page.svelte`

**Files:**

- Modify: `src/routes/account/+page.svelte:114`

- [ ] **Step 1: Inline + delete legacy account form layout**

Replace `{#if data.bento} <ProfilBento ... /> {:else} <legacy account UI> {/if}` with the bento branch only:

- Keep `<ProfilBento .../>`
- Delete the entire else branch (legacy account UI, including the deletion form, passkey list, password change form, etc.)

BUT — the delete account form, password change form, and passkey list must move into ProfilBento if they aren't already. Verify before deletion. If ProfilBento doesn't expose the delete form, this task needs to either (a) port the delete form into ProfilBento or (b) keep the legacy form rendered below ProfilBento.

- [ ] **Step 2: Audit ProfilBento for delete-account coverage**

Open `src/lib/components/bento/ProfilBento.svelte`. Confirm it includes:

- Account deletion form (or links to it)
- Password change form (or links to it)
- Passkey registration + list

If any of those are missing, ProfilBento's spec drift would be a blocker. In that case, the simplest unblock is: render ProfilBento AND keep the legacy sections below it (no `{#if}`), then file a follow-up to absorb the remaining legacy sections into ProfilBento. Document this in the commit message.

- [ ] **Step 3: Drop bento-conditional imports**

In `account/+page.svelte`, remove `import ProfilBento from ...` only if the inline is `{#if data.bento}` exclusively gated on ProfilBento.

- [ ] **Step 4: Run vitest + the existing account e2e test**

Run: `npx vitest run src/routes/account/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/routes/account/+page.svelte
git commit -m "chore(account): inline bento ProfilBento (keep legacy sections if drift)"
```

---

## Task 9: Remove bento cookie writes

**Files:**

- Modify: `src/routes/signup/+page.server.ts:238-243`
- Modify: `src/routes/child/[id]/+page.server.ts:239-251` (the `optInBento` action)
- Modify: `src/routes/child/[id]/page.server.test.ts` (delete the `?/optInBento action` describe block at line 432)

- [ ] **Step 1: Strip the signup cookie write**

Delete the `cookies.set('bento', '1', { ... })` block (5 lines) in `src/routes/signup/+page.server.ts`.

- [ ] **Step 2: Delete the `optInBento` action**

In `src/routes/child/[id]/+page.server.ts`:

- Remove the entire `optInBento: async ({ cookies, params, locals }) => { ... }` action (lines 240–251)
- Keep the `actions` object — just remove the one property

- [ ] **Step 3: Drop the `?/optInBento` test describe block**

In `src/routes/child/[id]/page.server.test.ts`, delete the entire `describe('?/optInBento action', ...)` block around line 432.

- [ ] **Step 4: Run vitest**

Run: `npx vitest run src/routes/signup/ src/routes/child/\[id\]/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/routes/signup/+page.server.ts src/routes/child/[id]/+page.server.ts src/routes/child/[id]/page.server.test.ts
git commit -m "chore(auth): remove bento cookie writes + optInBento action"
```

---

## Task 10: Delete BentoOptInBanner

**Files:**

- Delete: `src/lib/components/bento/BentoOptInBanner.svelte`
- Delete: `src/lib/components/bento/BentoOptInBanner.test.ts`
- Delete: `e2e/bento-optin-banner.spec.ts`

- [ ] **Step 1: Delete the three files**

```bash
rm src/lib/components/bento/BentoOptInBanner.svelte src/lib/components/bento/BentoOptInBanner.test.ts e2e/bento-optin-banner.spec.ts
```

- [ ] **Step 2: Confirm no remaining imports**

Run: `grep -rn "BentoOptInBanner" src/ e2e/`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add -A src/lib/components/bento/BentoOptInBanner.svelte src/lib/components/bento/BentoOptInBanner.test.ts e2e/bento-optin-banner.spec.ts
git commit -m "chore(banner): delete BentoOptInBanner — flag is default-on"
```

---

## Task 11: Delete legacy AppShell + BottomNav

**Files:**

- Delete: `src/lib/components/AppShell.svelte`
- Delete: `src/lib/components/AppShell.test.ts`
- Delete: `src/lib/components/BottomNav.svelte`
- Delete: `src/lib/components/BottomNav.test.ts`

- [ ] **Step 1: Confirm no remaining imports**

Run: `grep -rn "import AppShell\b\|from.*AppShell'\|import BottomNav\b\|from.*BottomNav'" src/ e2e/ | grep -v "Bento"`
Expected: no output (only AppShellBento and BottomNavBento should remain)

- [ ] **Step 2: Delete**

```bash
rm src/lib/components/AppShell.svelte src/lib/components/AppShell.test.ts src/lib/components/BottomNav.svelte src/lib/components/BottomNav.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add -A src/lib/components/AppShell.svelte src/lib/components/AppShell.test.ts src/lib/components/BottomNav.svelte src/lib/components/BottomNav.test.ts
git commit -m "chore(shell): delete legacy AppShell + BottomNav"
```

---

## Task 12: Delete `/child/[id]/allergens/` redirect-only route

**Files:**

- Delete: `src/routes/child/[id]/allergens/+page.server.ts`
- Delete: `src/routes/child/[id]/allergens/+page.svelte`
- Delete: `src/routes/child/[id]/allergens/page.server.test.ts`

- [ ] **Step 1: Confirm no internal links to the legacy URL**

Run: `grep -rn 'href.*allergens\|/child/.*\/allergens' src/ | grep -v 'foods?segment=allergens\|/allergens"$\|public-allergens'`
Expected: no internal `<a href>` pointing at `/child/[id]/allergens`. (External links / search-engine hits will 404 after this — that's the chosen tradeoff.)

- [ ] **Step 2: Delete the three files**

```bash
rm src/routes/child/[id]/allergens/+page.server.ts src/routes/child/[id]/allergens/+page.svelte src/routes/child/[id]/allergens/page.server.test.ts
rmdir src/routes/child/[id]/allergens
```

- [ ] **Step 3: Commit**

```bash
git add -A src/routes/child/[id]/allergens/
git commit -m "chore(routes): delete /child/[id]/allergens legacy redirect"
```

---

## Task 13: Delete `feature-flags.ts`

**Files:**

- Delete: `src/lib/feature-flags.ts`
- Delete: `src/lib/feature-flags.test.ts`

- [ ] **Step 1: Confirm no remaining imports**

Run: `grep -rn "from .\$lib/feature-flags'\|bentoEnabled" src/`
Expected: no output (the constant `BENTO_ALLOW_LIST` is also removed)

- [ ] **Step 2: Delete**

```bash
rm src/lib/feature-flags.ts src/lib/feature-flags.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add -A src/lib/feature-flags.ts src/lib/feature-flags.test.ts
git commit -m "chore(flags): delete feature-flags.ts (last consumer removed)"
```

---

## Task 14: Clean up E2E specs — remove bento cookie manipulations

**Files:**

- Modify: `e2e/bento-shell.spec.ts` (every `context.addCookies([{ name: 'bento', value: '1', ... }])`)
- Modify: `e2e/bento-discover.spec.ts` (same)
- Modify: `e2e/bento-profil.spec.ts` (same)
- Modify: `e2e/bento-reaction-detail.spec.ts` (same)
- Modify: `e2e/bento-auth-onboarding.spec.ts` (cookie assertion at line 27)
- Modify: `e2e/gdpr.spec.ts` (the bento=0 flip introduced in PR #90)

- [ ] **Step 1: Remove every `context.addCookies` line that sets `bento`**

For each file, delete the `await context.addCookies([{ name: 'bento', value: '1', url: BASE_URL }])` calls. The default UI is bento now.

In `gdpr.spec.ts`, also delete the bento=0 override block introduced in PR #90 (the legacy `/account` delete form is gone; the test now uses ProfilBento — or moves to test the new delete flow if ProfilBento exposes one. If ProfilBento has no delete UI, mark this spec `test.skip` with a TODO referencing a follow-up issue).

In `bento-auth-onboarding.spec.ts`, delete the cookies assertion (`expect(cookies.find((c) => c.name === 'bento')?.value).toBe('1')`) and the surrounding `context.cookies()` call. The test now just verifies the signup → onboarding flow lands on the bento Aujourd'hui directly.

- [ ] **Step 2: Run the full e2e suite locally if possible**

If you have a Postgres running, run: `npm run test:e2e`
Expected: PASS, ~30 tests (after BentoOptInBanner spec deletion).

Otherwise rely on CI.

- [ ] **Step 3: Commit**

```bash
git add e2e/
git commit -m "test(e2e): drop bento cookie manipulations after flag removal"
```

---

## Task 15: Final sweep — run the whole local test suite + paraglide compile

- [ ] **Step 1: Compile paraglide (in case any messages were touched)**

Run: `npm run paraglide`
Expected: clean compile.

- [ ] **Step 2: Lint + typecheck**

Run: `npm run lint && npm run check`
Expected: PASS.

- [ ] **Step 3: Full vitest run with coverage**

Run: `npm run test:coverage`
Expected: PASS at 100% coverage thresholds.

- [ ] **Step 4: Commit any auto-formatted output**

If the prior commits left out paraglide-compiled files, stage and commit them now:

```bash
git add src/lib/paraglide/
git commit -m "chore(paraglide): recompile after flag removal" || echo "no changes"
```

---

## Task 16: Open PR + watch CI

- [ ] **Step 1: Push the branch**

```bash
git push -u origin HEAD
```

- [ ] **Step 2: Open the PR**

```bash
gh pr create --title "feat(bento): Phase 7 — flag removal, legacy AppShell/BottomNav/allergens deletion" --body "$(cat <<'EOF'
## Summary
- Deletes \`bentoEnabled\` and \`src/lib/feature-flags.ts\` — bento is the only UI now.
- Inlines the bento branch in every layout/page that conditioned on \`data.bento\`; deletes the else-legacy branches.
- Deletes legacy \`AppShell\`, \`BottomNav\`, \`/child/[id]/allergens\` redirect-only route, and \`BentoOptInBanner\`.
- Removes the \`bento\` cookie writes in signup + \`optInBento\` action.
- Strips \`context.addCookies([{ name: 'bento', ... }])\` from every e2e spec.

## Test plan
- [x] vitest at 100% coverage
- [x] Playwright (E2E suite)
- [ ] Reviewer spot-checks /child/<id>, /foods, /guide, /account in browser

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Watch CI and merge when green**

Run: `gh pr checks <PR#>` periodically. When all three checks pass, merge via:

```bash
gh pr merge <PR#> --squash --delete-branch
```

- [ ] **Step 4: Refresh graphify on main**

```bash
git checkout main && git pull
graphify update .
git add graphify-out/GRAPH_REPORT.md graphify-out/graph.json graphify-out/graph.html graphify-out/manifest.json
git commit -m "chore(graph): refresh after Phase 7 cleanup"
git push
```

---

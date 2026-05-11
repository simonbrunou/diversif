# Phase 6 — Auth + Onboarding + Landing + Legal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the four remaining bento surfaces (auth, onboarding, landing, legal), flip the feature flag default-on for new signups by setting the `bento=1` cookie in the signup action, and surface an opt-in banner on legacy Aujourd'hui for existing users.

**Architecture:** Six new bento components (`BentoAuthLayout`, `BentoMark`, `BentoOptInBanner`, `OnboardingForm`, four `Landing*Bento` variants), one extracted server helper (`src/lib/server/invitations.ts::createInvitationForChild`), and a new `?/optInBento` action on the legacy `/child/[id]` route. No DB migration. Existing form actions extended; no behavior changes to user/membership/passkey logic.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, TailwindCSS 3 bento tokens (peach / butter / mint / sky / lilac, Fraunces + Inter), Drizzle ORM + Postgres (pg-mem for tests), Paraglide-js, Vitest + happy-dom + @testing-library/svelte, Playwright e2e (mobile viewport pinned 414×896).

---

## Pre-flight context

Read these once before starting (patterns every task reuses):

- `src/lib/components/bento/StatTiles.svelte` + `.test.ts` — canonical bento component shape.
- `src/routes/signup/+page.server.ts:200-235` — existing signup action, session cookie pattern.
- `src/routes/child/[id]/settings/+page.server.ts:25-60` — existing `insertInviteWithUniqueCode` inline helper to extract.
- `src/lib/feature-flags.ts` — `bentoEnabled(userEmail, cookies)` signature.
- `src/lib/components/landing/LandingHero.svelte` — existing landing hero for context.
- `e2e/bento-shell.spec.ts` — canonical Playwright pattern (mobile viewport, `signUpAndCreateChild`, `dismissWelcomeIfPresent`).

Every task ends with `git commit`. All commits land on the `worktree-feat-phase6-auth-onboarding-landing` branch.

---

## File structure

**New files:**

- `src/lib/components/bento/BentoMark.svelte` (+ `.test.ts`)
- `src/lib/components/bento/BentoAuthLayout.svelte` (+ `.test.ts`)
- `src/lib/components/bento/BentoOptInBanner.svelte` (+ `.test.ts`)
- `src/lib/components/bento/OnboardingForm.svelte` (+ `.test.ts`)
- `src/lib/components/landing/LandingHeroBento.svelte` (+ `.test.ts`)
- `src/lib/components/landing/LandingFeaturesBento.svelte` (+ `.test.ts`)
- `src/lib/components/landing/LandingTrustBento.svelte` (+ `.test.ts`)
- `src/lib/components/landing/LandingClosingCtaBento.svelte` (+ `.test.ts`)
- `src/lib/server/invitations.ts` (+ `.test.ts`)
- `e2e/bento-auth-onboarding.spec.ts`
- `e2e/bento-optin-banner.spec.ts`

**Modified files:**

- `messages/fr.json` + `messages/en.json` — Phase 6 paraglide keys
- `src/routes/signup/+page.svelte` — wrap in `BentoAuthLayout`
- `src/routes/signup/+page.server.ts` — set `bento=1` cookie on successful signup
- `src/routes/signup/page.server.test.ts` — assert cookie set
- `src/routes/login/+page.svelte` — wrap in `BentoAuthLayout`, passkey-first promotion
- `src/routes/child/new/+page.svelte` — render `OnboardingForm`
- `src/routes/child/new/+page.server.ts` — accept `inviteCoparent`, call `createInvitationForChild`
- `src/routes/child/new/page.server.test.ts` — assert invitation behavior
- `src/routes/+page.svelte` — swap landing components for bento variants
- `src/routes/cgu/+page.svelte` — bento restyle
- `src/routes/mentions-legales/+page.svelte` — bento restyle
- `src/routes/politique-confidentialite/+page.svelte` — bento restyle
- `src/routes/cookies/+page.svelte` — bento restyle
- `src/routes/child/[id]/+page.svelte` — render `BentoOptInBanner` in legacy branch
- `src/routes/child/[id]/+page.server.ts` — add `?/optInBento` action
- `src/routes/child/[id]/settings/+page.server.ts` — switch to shared `createInvitationForChild` helper

---

## Tasks

### Task 1: Paraglide message keys for Phase 6

**Files:**

- Modify: `messages/fr.json`
- Modify: `messages/en.json`

These feed every Phase 6 surface. Add up front so subsequent tasks compile.

- [ ] **Step 1: Add FR keys (append before the closing `}` in `messages/fr.json`)**

```json
"authSignupTitleBento": "Bienvenue",
"authSignupSubtitleBento": "Diversifiez en confiance, à votre rythme.",
"authLoginTitleBento": "Bienvenue de retour",
"authLoginPasskeyPrimaryCta": "🔑 Continuer avec une passkey",
"authLoginPasswordReveal": "Ou avec mot de passe",
"authLoginPasskeySecondary": "🔑 Avec une passkey",
"authSignupFooterLogin": "J'ai déjà un compte · Se connecter",
"authLoginFooterSignup": "Pas encore de compte · S'inscrire",
"authSignupDivider": "ou",
"authSignupPasskeyCta": "🔑 Continuer avec une passkey",

"onboardingTitle": "Bébé.",
"onboardingSubtitle": "Quelques infos pour commencer le carnet.",
"onboardingFirstNameLabel": "Prénom",
"onboardingBirthDateLabel": "Date de naissance",
"onboardingInviteSectionHeader": "Co-parent (optionnel)",
"onboardingInviteCheckbox": "Inviter un co-parent maintenant",
"onboardingInviteCaption": "Générer un code à partager — vous pourrez aussi le faire plus tard depuis Profil.",
"onboardingSubmit": "Commencer",

"landingFeaturesTitle": "Pourquoi Diversif",
"landingTrustTitle": "De la confiance, par construction",
"landingTrustPillarNoTelemetry": "Sans télémétrie",
"landingTrustPillarSources": "Sources scientifiques citées",
"landingTrustPillarOwnership": "Vos données vous appartiennent",
"landingClosingCtaTitle": "Prêt à commencer ?",
"landingClosingCtaButton": "Créer mon compte",

"optInBannerTitle": "Le nouveau design est prêt.",
"optInBannerSubtitle": "Voulez-vous l'essayer ?",
"optInBannerCta": "Essayer le nouveau design ✨",
"optInBannerDismissAria": "Fermer le panneau",

"onboardingInviteCodeToastTitle": "Code d'invitation généré",
"onboardingInviteCodeToastBody": "Partagez ce code avec votre co-parent.",
"onboardingInviteCodeCopy": "Copier",
"onboardingInviteFailedToast": "Code non généré. Réessayez depuis Profil."
```

- [ ] **Step 2: Add EN keys in `messages/en.json`**

```json
"authSignupTitleBento": "Welcome",
"authSignupSubtitleBento": "Diversify with confidence, at your own pace.",
"authLoginTitleBento": "Welcome back",
"authLoginPasskeyPrimaryCta": "🔑 Continue with a passkey",
"authLoginPasswordReveal": "Or with password",
"authLoginPasskeySecondary": "🔑 With a passkey",
"authSignupFooterLogin": "I already have an account · Sign in",
"authLoginFooterSignup": "Don't have an account · Sign up",
"authSignupDivider": "or",
"authSignupPasskeyCta": "🔑 Continue with a passkey",

"onboardingTitle": "Baby.",
"onboardingSubtitle": "A few details to start the notebook.",
"onboardingFirstNameLabel": "First name",
"onboardingBirthDateLabel": "Date of birth",
"onboardingInviteSectionHeader": "Co-parent (optional)",
"onboardingInviteCheckbox": "Invite a co-parent now",
"onboardingInviteCaption": "Generate a shareable code — you can also do this later from Profile.",
"onboardingSubmit": "Get started",

"landingFeaturesTitle": "Why Diversif",
"landingTrustTitle": "Trust by design",
"landingTrustPillarNoTelemetry": "No telemetry",
"landingTrustPillarSources": "Cited scientific sources",
"landingTrustPillarOwnership": "Your data belongs to you",
"landingClosingCtaTitle": "Ready to start?",
"landingClosingCtaButton": "Create my account",

"optInBannerTitle": "The new design is ready.",
"optInBannerSubtitle": "Want to try it?",
"optInBannerCta": "Try the new design ✨",
"optInBannerDismissAria": "Dismiss panel",

"onboardingInviteCodeToastTitle": "Invitation code generated",
"onboardingInviteCodeToastBody": "Share this code with your co-parent.",
"onboardingInviteCodeCopy": "Copy",
"onboardingInviteFailedToast": "Code not generated. Try again from Profile."
```

- [ ] **Step 3: Recompile paraglide and verify**

Run: `npm run paraglide`
Expected: `[paraglide] Successfully compiled the project.`

- [ ] **Step 4: Commit**

```bash
git add messages/fr.json messages/en.json
git commit -m "feat(i18n): paraglide keys for Phase 6 surfaces"
```

---

### Task 2: Extract `createInvitationForChild` server helper

**Files:**

- Create: `src/lib/server/invitations.ts`
- Create: `src/lib/server/invitations.test.ts`

The existing `insertInviteWithUniqueCode` lives inline at `src/routes/child/[id]/settings/+page.server.ts:25-60`. We extract it to a shared module so `/child/new` and `/child/[id]/settings` both consume the same logic.

- [ ] **Step 1: Read the existing inline helper**

Read `src/routes/child/[id]/settings/+page.server.ts:25-65` for the canonical retry-on-23505 logic and `generateInviteCodeRaw` import path.

- [ ] **Step 2: Write the failing test**

Create `src/lib/server/invitations.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../test/db';
import { seedChild, seedUser, seedMembership } from '../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

import { invitations } from './db/schema';
import { createInvitationForChild } from './invitations';

beforeEach(async () => {
  await resetTestDb();
});

describe('createInvitationForChild', () => {
  it('inserts a new invitation row and returns the code', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id });
    await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const code = await createInvitationForChild({ childId: c.id, createdBy: u.id });
    expect(code).toBeTruthy();
    expect(typeof code).toBe('string');
    expect(code!.length).toBeGreaterThanOrEqual(6);
    const rows = await testDb.select().from(invitations);
    expect(rows).toHaveLength(1);
    expect(rows[0].code).toBe(code);
    expect(rows[0].childId).toBe(c.id);
    expect(rows[0].createdBy).toBe(u.id);
    expect(rows[0].usedAt).toBeNull();
  });

  it('sets an expires_at ~7 days in the future', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id });
    await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const before = Date.now();
    await createInvitationForChild({ childId: c.id, createdBy: u.id });
    const [row] = await testDb.select().from(invitations);
    const expiresAtMs = row.expiresAt.getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(expiresAtMs - before).toBeGreaterThan(sevenDaysMs - 60_000);
    expect(expiresAtMs - before).toBeLessThan(sevenDaysMs + 60_000);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run src/lib/server/invitations.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement the helper**

Create `src/lib/server/invitations.ts`:

```ts
import { db } from './db';
import { invitations } from './db/schema';
import { generateInviteCodeRaw } from './invite-codes';
import { isUniqueViolation } from './db/errors';

const INVITE_DURATION_MS = 1000 * 60 * 60 * 24 * 7;

export async function createInvitationForChild(input: {
  childId: number;
  createdBy: number;
}): Promise<string | null> {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + INVITE_DURATION_MS);
  for (let i = 0; i < 5; i++) {
    const code = generateInviteCodeRaw();
    try {
      await db.insert(invitations).values({
        code,
        childId: input.childId,
        createdBy: input.createdBy,
        createdAt,
        expiresAt,
        usedAt: null,
        usedBy: null
      });
      return code;
    } catch (err) {
      /* v8 ignore start — defensive: any non-23505 error bubbles up unchanged */
      if (!isUniqueViolation(err)) throw err;
      /* v8 ignore stop */
    }
  }
  return null;
}
```

> If `generateInviteCodeRaw` lives at a different path, run `grep -rn 'export.*generateInviteCodeRaw' src/` to find it and adjust the import.

- [ ] **Step 5: Run the test**

Run: `npx vitest run src/lib/server/invitations.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Switch the existing settings route to use the shared helper**

Edit `src/routes/child/[id]/settings/+page.server.ts`:

1. Remove the inline `insertInviteWithUniqueCode` function (lines 25-60 ish).
2. Replace its call sites with `await createInvitationForChild({ childId, createdBy: user.id })`.
3. Add `import { createInvitationForChild } from '$lib/server/invitations';` at the top.

Run `npx vitest run src/routes/child/[id]/settings/page.server.test.ts` to verify the existing settings tests still pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/server/invitations.ts src/lib/server/invitations.test.ts src/routes/child/[id]/settings/+page.server.ts
git commit -m "refactor(invitations): extract createInvitationForChild helper"
```

---

### Task 3: `BentoMark` component

**Files:**

- Create: `src/lib/components/bento/BentoMark.svelte`
- Create: `src/lib/components/bento/BentoMark.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/BentoMark.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import BentoMark from './BentoMark.svelte';

afterEach(() => cleanup());

describe('BentoMark', () => {
  it('renders a 44x44 rounded square with aria-label', () => {
    const { container } = render(BentoMark);
    const mark = container.querySelector('[aria-label="Diversif"]');
    expect(mark).toBeTruthy();
  });

  it('accepts a size override prop', () => {
    const { container } = render(BentoMark, { props: { size: 64 } });
    const mark = container.querySelector('[aria-label="Diversif"]') as HTMLElement;
    expect(mark.style.width).toBe('64px');
    expect(mark.style.height).toBe('64px');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/bento/BentoMark.test.ts`
Expected: FAIL — component missing.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/bento/BentoMark.svelte`:

```svelte
<script lang="ts">
  let { size = 44, class: className = '' }: { size?: number; class?: string } = $props();
</script>

<div
  aria-label="Diversif"
  role="img"
  class="relative inline-block overflow-hidden rounded-2xl shadow-soft {className}"
  style="width: {size}px; height: {size}px"
>
  <div class="absolute inset-y-0 left-0 w-1/2 bg-primary"></div>
  <div class="absolute inset-y-0 right-0 w-1/2 bg-tile-peach"></div>
</div>
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/lib/components/bento/BentoMark.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/bento/BentoMark.svelte src/lib/components/bento/BentoMark.test.ts
git commit -m "feat(bento): BentoMark — 44x44 sage/peach split brand mark"
```

---

### Task 4: `BentoAuthLayout` component

**Files:**

- Create: `src/lib/components/bento/BentoAuthLayout.svelte`
- Create: `src/lib/components/bento/BentoAuthLayout.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/BentoAuthLayout.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import BentoAuthLayout from './BentoAuthLayout.svelte';

afterEach(() => cleanup());

describe('BentoAuthLayout', () => {
  function makeSnippet(html: string) {
    return createRawSnippet(() => ({ render: () => html }));
  }

  it('renders the bento mark and title slot', () => {
    render(BentoAuthLayout, {
      props: {
        title: 'Bienvenue',
        subtitle: 'Sub',
        children: makeSnippet('<p>form content</p>')
      }
    });
    expect(screen.getByLabelText('Diversif')).toBeTruthy();
    expect(screen.getByText('Bienvenue')).toBeTruthy();
    expect(screen.getByText('Sub')).toBeTruthy();
    expect(screen.getByText('form content')).toBeTruthy();
  });

  it('applies the gradient backdrop class', () => {
    const { container } = render(BentoAuthLayout, {
      props: { title: 'X', subtitle: 'Y', children: makeSnippet('<p></p>') }
    });
    const backdrop = container.querySelector('.bg-gradient-to-b');
    expect(backdrop).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/bento/BentoAuthLayout.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/bento/BentoAuthLayout.svelte`:

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  import BentoMark from './BentoMark.svelte';

  let {
    title,
    subtitle,
    children
  }: { title: string; subtitle: string; children: Snippet } = $props();
</script>

<main
  class="flex min-h-[100dvh] flex-col items-center justify-center bg-gradient-to-b from-tile-peach via-tile-butter to-canvas px-4 py-12"
>
  <article
    class="w-full max-w-md rounded-hero bg-surface px-6 py-8 shadow-lifted"
  >
    <BentoMark size={44} class="mb-5" />
    <h1 class="font-display text-3xl italic leading-tight">{title}</h1>
    <p class="mt-2 text-sm text-ink-soft">{subtitle}</p>
    <div class="mt-6">
      {@render children()}
    </div>
  </article>
</main>
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/lib/components/bento/BentoAuthLayout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/bento/BentoAuthLayout.svelte src/lib/components/bento/BentoAuthLayout.test.ts
git commit -m "feat(bento): BentoAuthLayout — gradient + mark + centered card"
```

---

### Task 5: Wire `BentoAuthLayout` into `/signup` (page Svelte)

**Files:**

- Modify: `src/routes/signup/+page.svelte`

- [ ] **Step 1: Read the existing signup page**

`src/routes/signup/+page.svelte` is ~117 lines. Note the form structure (display-name, email, password, three checkboxes, submit), the `data.inviteCode` branch, and the existing `Seo` import.

- [ ] **Step 2: Restructure the page**

Replace the body with:

```svelte
<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Label from '$components/ui/Label.svelte';
  import BentoAuthLayout from '$lib/components/bento/BentoAuthLayout.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let submitting = $state(false);
</script>

<Seo title={m.authSignupTitle()} path="/signup" noindex alternateLocales={['en']} />

<BentoAuthLayout title={m.authSignupTitleBento()} subtitle={data.inviteCode ? m.authSignupSubheadingInvited() : m.authSignupSubtitleBento()}>
  <form
    method="POST"
    class="grid gap-4"
    use:enhance={() => {
      submitting = true;
      return async ({ update }) => {
        await update();
        submitting = false;
      };
    }}
  >
    <!-- preserve existing input + checkbox markup verbatim from the previous page -->
    <!-- (display name, email, password, age/cgu/policy checkboxes, submit) -->
  </form>
  <div class="mt-4 text-center text-xs uppercase tracking-wider text-ink-soft">{m.authSignupDivider()}</div>
  <a
    href={localizedHref('/passkeys/registration/options')}
    class="mt-4 block w-full rounded-full border border-dashed border-primary px-4 py-3 text-center text-sm font-bold text-primary"
  >
    {m.authSignupPasskeyCta()}
  </a>
  <a href={localizedHref('/login')} class="mt-4 block text-center text-sm text-primary underline">
    {m.authSignupFooterLogin()}
  </a>
</BentoAuthLayout>
```

Copy the existing input + checkbox + submit markup verbatim from the previous `+page.svelte` into the `<form>` body — DO NOT change input names, validation hooks, or `form?.…` error pattern matching. Only the surrounding chrome changes.

- [ ] **Step 3: Run the signup tests**

Run: `npx vitest run src/routes/signup/`
Expected: PASS (existing tests). If any test fails because the markup structure changed, fix the selector — do not change the form behavior.

- [ ] **Step 4: Commit**

```bash
git add src/routes/signup/+page.svelte
git commit -m "feat(auth): wrap /signup in BentoAuthLayout"
```

---

### Task 6: Extend `/signup` action to set `bento=1` cookie

**Files:**

- Modify: `src/routes/signup/+page.server.ts`
- Modify: `src/routes/signup/page.server.test.ts`

- [ ] **Step 1: Write the failing test**

In `src/routes/signup/page.server.test.ts`, after the existing successful-signup test (or create a new `describe('bento cookie', () => {...})` block):

```ts
it('sets the bento=1 cookie after successful account creation', async () => {
  const cookies = makeCookies();
  const event = makeRouteEvent({
    request: new Request('http://localhost/signup', {
      method: 'POST',
      body: new URLSearchParams({
        email: `e2e-${Date.now()}@example.com`,
        password: 'hunter2-very-long',
        displayName: 'Parent',
        ageOk: 'on',
        cguOk: 'on',
        policyOk: 'on'
      }),
      headers: { 'content-type': 'application/x-www-form-urlencoded' }
    }),
    cookies
  });
  await expect(
    actions.default(event as unknown as Parameters<typeof actions.default>[0])
  ).rejects.toMatchObject({ status: 303 });
  expect(cookies.get('bento')).toBe('1');
});
```

Adapt the form fields to match your project's existing `signupSchema` input names. The existing test should have a template you can mirror.

- [ ] **Step 2: Run to verify the new test fails**

Run: `npx vitest run src/routes/signup/page.server.test.ts -t 'bento cookie'`
Expected: FAIL — cookie isn't set yet.

- [ ] **Step 3: Edit the signup action**

In `src/routes/signup/+page.server.ts`, find the spot where the session cookie is set (around line 222 in the existing file):

```ts
cookies.set(SESSION_COOKIE, session.id, {
  path: '/',
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: Math.floor(SESSION_DURATION_MS / 1000)
});
```

Add immediately after:

```ts
cookies.set('bento', '1', {
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 365
});
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/routes/signup/page.server.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/signup/+page.server.ts src/routes/signup/page.server.test.ts
git commit -m "feat(auth): signup sets bento=1 cookie on successful account creation"
```

---

### Task 7: Wire `BentoAuthLayout` into `/login` with passkey-first promotion

**Files:**

- Modify: `src/routes/login/+page.svelte`

- [ ] **Step 1: Read the existing login page**

`src/routes/login/+page.svelte` (~136 lines). Note the `data.passkeyDiscoveryAvailable` flag (or whatever it's called — `grep -n "passkey" src/routes/login/+page.svelte` to find).

- [ ] **Step 2: Restructure the page**

Replace the body with:

```svelte
<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Label from '$components/ui/Label.svelte';
  import BentoAuthLayout from '$lib/components/bento/BentoAuthLayout.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let submitting = $state(false);
  let passwordRevealed = $state(false);
</script>

<Seo title={m.authLoginTitle()} path="/login" noindex alternateLocales={['en']} />

<BentoAuthLayout title={m.authLoginTitleBento()} subtitle="">
  {#if data.passkeyDiscoveryAvailable}
    <button
      type="button"
      onclick={() => {
        /* trigger existing passkey discovery flow — reuse the helper the previous page used */
      }}
      class="w-full rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-soft"
    >
      {m.authLoginPasskeyPrimaryCta()}
    </button>
    <button
      type="button"
      onclick={() => (passwordRevealed = !passwordRevealed)}
      class="mt-3 block w-full text-center text-xs uppercase tracking-wider text-ink-soft"
    >
      {m.authLoginPasswordReveal()}
    </button>
    {#if passwordRevealed}
      <form method="POST" class="mt-4 grid gap-4" use:enhance={...}>
        <!-- preserve existing email + password + submit markup verbatim -->
      </form>
    {/if}
  {:else}
    <form method="POST" class="grid gap-4" use:enhance={...}>
      <!-- preserve existing email + password + submit markup verbatim -->
    </form>
    <a
      href={localizedHref('/passkeys/...')}
      class="mt-4 block w-full rounded-full border border-dashed border-primary px-4 py-3 text-center text-sm font-bold text-primary"
    >
      {m.authLoginPasskeySecondary()}
    </a>
  {/if}
  <a href={localizedHref('/signup')} class="mt-4 block text-center text-sm text-primary underline">
    {m.authLoginFooterSignup()}
  </a>
</BentoAuthLayout>
```

Preserve the existing `data.passkeyDiscoveryAvailable` access and existing passkey-discovery handler. Copy the existing email + password form markup verbatim. The `use:enhance={...}` placeholder should be filled with whatever exists in the current login page.

- [ ] **Step 3: Run the login tests**

Run: `npx vitest run src/routes/login/`
Expected: PASS. If selectors changed, update them.

- [ ] **Step 4: Commit**

```bash
git add src/routes/login/+page.svelte
git commit -m "feat(auth): wrap /login in BentoAuthLayout, promote passkey when keys exist"
```

---

### Task 8: `OnboardingForm` component

**Files:**

- Create: `src/lib/components/bento/OnboardingForm.svelte`
- Create: `src/lib/components/bento/OnboardingForm.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/OnboardingForm.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import OnboardingForm from './OnboardingForm.svelte';

afterEach(() => cleanup());

describe('OnboardingForm', () => {
  it('renders prénom, date de naissance, invite checkbox, and submit', () => {
    render(OnboardingForm, { props: { errors: null } });
    expect(screen.getByLabelText('Prénom')).toBeTruthy();
    expect(screen.getByLabelText('Date de naissance')).toBeTruthy();
    expect(screen.getByLabelText('Inviter un co-parent maintenant')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Commencer' })).toBeTruthy();
  });

  it('renders inline errors when provided', () => {
    render(OnboardingForm, {
      props: { errors: { firstName: 'Required' } }
    });
    expect(screen.getByText('Required')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/bento/OnboardingForm.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/bento/OnboardingForm.svelte`:

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';

  type Errors = { firstName?: string; birthDate?: string } | null;
  let { errors }: { errors: Errors } = $props();
</script>

<form method="POST" class="rounded-hero bg-surface px-6 py-7 shadow-soft">
  <h1 class="font-display text-3xl italic">{m.onboardingTitle()}</h1>
  <p class="mt-1 text-sm text-ink-soft">{m.onboardingSubtitle()}</p>

  <label class="mt-6 block text-xs font-semibold uppercase tracking-wider text-ink-soft" for="firstName">
    {m.onboardingFirstNameLabel()}
  </label>
  <input
    id="firstName"
    name="firstName"
    type="text"
    required
    class="mt-1 w-full rounded-tile border border-border bg-canvas px-3 py-2 text-sm"
  />
  {#if errors?.firstName}
    <p class="mt-1 text-xs text-severe">{errors.firstName}</p>
  {/if}

  <label class="mt-4 block text-xs font-semibold uppercase tracking-wider text-ink-soft" for="birthDate">
    {m.onboardingBirthDateLabel()}
  </label>
  <input
    id="birthDate"
    name="birthDate"
    type="date"
    required
    class="mt-1 w-full rounded-tile border border-border bg-canvas px-3 py-2 text-sm"
  />
  {#if errors?.birthDate}
    <p class="mt-1 text-xs text-severe">{errors.birthDate}</p>
  {/if}

  <hr class="my-5 border-border" />

  <p class="text-xs font-semibold uppercase tracking-wider text-ink-soft">
    {m.onboardingInviteSectionHeader()}
  </p>
  <label class="mt-2 flex items-start gap-2 text-sm">
    <input type="checkbox" name="inviteCoparent" value="1" class="mt-0.5" />
    <span>
      {m.onboardingInviteCheckbox()}
      <span class="block text-xs text-ink-soft">{m.onboardingInviteCaption()}</span>
    </span>
  </label>

  <button
    type="submit"
    class="mt-6 w-full rounded-full bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-soft transition-transform duration-base ease-soft active:scale-[0.99]"
  >
    {m.onboardingSubmit()}
  </button>
</form>
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/lib/components/bento/OnboardingForm.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/bento/OnboardingForm.svelte src/lib/components/bento/OnboardingForm.test.ts
git commit -m "feat(bento): OnboardingForm — child + optional invite checkbox"
```

---

### Task 9: Wire `OnboardingForm` into `/child/new` page

**Files:**

- Modify: `src/routes/child/new/+page.svelte`

- [ ] **Step 1: Read the existing page** to see how `form?.errors` is shaped.

- [ ] **Step 2: Restructure the page**

Replace the body with:

```svelte
<script lang="ts">
  import OnboardingForm from '$lib/components/bento/OnboardingForm.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import * as m from '$lib/paraglide/messages';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  void data;
</script>

<Seo title={m.onboardingTitle()} path="/child/new" noindex alternateLocales={['en']} />

<main class="flex min-h-[100dvh] flex-col items-center bg-canvas px-4 py-10">
  <div class="w-full max-w-md">
    <OnboardingForm errors={form?.errors ?? null} />
  </div>
</main>
```

If the existing `form?.errors` shape doesn't match `{ firstName?, birthDate? }`, adapt the test fixture in Task 8 to match the real shape — don't invent a new error contract.

- [ ] **Step 3: Run the tests**

Run: `npx vitest run src/routes/child/new/`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/routes/child/new/+page.svelte
git commit -m "feat(onboarding): wire OnboardingForm into /child/new"
```

---

### Task 10: Extend `/child/new` action — call `createInvitationForChild` when checkbox set

**Files:**

- Modify: `src/routes/child/new/+page.server.ts`
- Modify: `src/routes/child/new/page.server.test.ts`

- [ ] **Step 1: Read the existing action** to understand the current child-creation + redirect logic.

- [ ] **Step 2: Write the failing tests**

Append to `src/routes/child/new/page.server.test.ts`:

```ts
import { createInvitationForChild } from '$lib/server/invitations';
import { invitations } from '$lib/server/db/schema';

describe('child/new action — invite-coparent flow', () => {
  it('skips invitation when checkbox is not checked', async () => {
    const u = await seedUser();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [],
      request: makeFormRequest({ firstName: 'Léo', birthDate: '2025-10-01' })
    });
    await expect(
      actions.default(event as unknown as Parameters<typeof actions.default>[0])
    ).rejects.toMatchObject({
      status: 303
    });
    const invites = await testDb.select().from(invitations);
    expect(invites).toHaveLength(0);
  });

  it('creates an invitation when inviteCoparent=1 is sent', async () => {
    const u = await seedUser();
    let redirectLocation: string | undefined;
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [],
      request: makeFormRequest({
        firstName: 'Léo',
        birthDate: '2025-10-01',
        inviteCoparent: '1'
      })
    });
    await expect(
      actions.default(event as unknown as Parameters<typeof actions.default>[0])
    ).rejects.toMatchObject({ status: 303 });
    const invites = await testDb.select().from(invitations);
    expect(invites).toHaveLength(1);
  });
});
```

(Adapt `makeFormRequest` to whatever helper your test suite uses for building POST events. Check the existing tests in the same file for the right shape.)

- [ ] **Step 3: Run the new tests to verify they fail**

Run: `npx vitest run src/routes/child/new/page.server.test.ts -t 'invite-coparent'`
Expected: FAIL — invitation isn't generated.

- [ ] **Step 4: Edit the action**

In `src/routes/child/new/+page.server.ts`, after the existing child + membership inserts, add:

```ts
import { createInvitationForChild } from '$lib/server/invitations';
// ...
const inviteCoparent = formData.get('inviteCoparent') === '1';
let redirectQuery = '';
if (inviteCoparent) {
  const code = await createInvitationForChild({ childId: newChild.id, createdBy: user.id });
  redirectQuery = code ? `?inviteCode=${code}` : '?invite=failed';
}
throw redirect(303, localizedRedirect(locals.locale, `/child/${newChild.id}${redirectQuery}`));
```

Adapt the variable names (`newChild.id`, `user.id`, `localizedRedirect`) to match what exists in the file.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/routes/child/new/page.server.test.ts`
Expected: PASS (all tests).

- [ ] **Step 6: Commit**

```bash
git add src/routes/child/new/+page.server.ts src/routes/child/new/page.server.test.ts
git commit -m "feat(onboarding): generate invitation code when inviteCoparent is checked"
```

---

### Task 11: `BentoOptInBanner` component

**Files:**

- Create: `src/lib/components/bento/BentoOptInBanner.svelte`
- Create: `src/lib/components/bento/BentoOptInBanner.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/bento/BentoOptInBanner.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import BentoOptInBanner from './BentoOptInBanner.svelte';

afterEach(() => cleanup());

describe('BentoOptInBanner', () => {
  it('renders title, subtitle, CTA, and dismiss button', () => {
    render(BentoOptInBanner, { props: { childId: 'abc' } });
    expect(screen.getByText(/nouveau design est prêt/i)).toBeTruthy();
    expect(screen.getByText(/Voulez-vous l'essayer/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Essayer le nouveau design/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fermer le panneau' })).toBeTruthy();
  });

  it('CTA submits to ?/optInBento via form POST', () => {
    render(BentoOptInBanner, { props: { childId: 'abc' } });
    const form = screen.getByRole('button', { name: /Essayer le nouveau design/ }).closest('form');
    expect(form?.getAttribute('action')).toBe('/child/abc?/optInBento');
    expect(form?.getAttribute('method')).toBe('POST');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/components/bento/BentoOptInBanner.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the component**

Create `src/lib/components/bento/BentoOptInBanner.svelte`:

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { X } from 'lucide-svelte';
  import { onMount } from 'svelte';

  let { childId }: { childId: string } = $props();
  let dismissed = $state(false);

  onMount(() => {
    if (typeof document !== 'undefined' && document.cookie.includes('bento-opt-in-dismissed=1')) {
      dismissed = true;
    }
  });

  function dismiss() {
    dismissed = true;
    document.cookie = 'bento-opt-in-dismissed=1; path=/; max-age=' + 60 * 60 * 24 * 365 + '; samesite=lax';
  }
</script>

{#if !dismissed}
  <aside class="mb-4 flex items-start gap-3 rounded-tile bg-tile-butter px-4 py-3 shadow-soft">
    <div class="flex-1">
      <p class="text-sm font-bold leading-tight">{m.optInBannerTitle()}</p>
      <p class="text-xs text-ink-soft">{m.optInBannerSubtitle()}</p>
      <form method="POST" action={`/child/${childId}?/optInBento`} class="mt-2">
        <button
          type="submit"
          class="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-soft transition-transform duration-fast ease-soft active:scale-[0.97]"
        >
          {m.optInBannerCta()}
        </button>
      </form>
    </div>
    <button
      type="button"
      onclick={dismiss}
      aria-label={m.optInBannerDismissAria()}
      class="rounded-full p-1 text-ink-soft transition-colors hover:text-foreground"
    >
      <X size={16} aria-hidden="true" />
    </button>
  </aside>
{/if}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run src/lib/components/bento/BentoOptInBanner.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/bento/BentoOptInBanner.svelte src/lib/components/bento/BentoOptInBanner.test.ts
git commit -m "feat(bento): BentoOptInBanner — butter dismissible opt-in"
```

---

### Task 12: Add `?/optInBento` action on `/child/[id]` + wire `BentoOptInBanner` in legacy branch

**Files:**

- Modify: `src/routes/child/[id]/+page.server.ts`
- Modify: `src/routes/child/[id]/+page.svelte`
- Modify: `src/routes/child/[id]/page.server.test.ts`

- [ ] **Step 1: Write the failing action test**

Append to `src/routes/child/[id]/page.server.test.ts`:

```ts
describe('?/optInBento action', () => {
  it('sets bento=1 cookie and 303 redirects back', async () => {
    const u = await seedUser();
    const c = await seedChild({ createdBy: u.id });
    const m_row = await seedMembership({ userId: u.id, childId: c.id, role: 'owner' });
    const cookies = makeCookies();
    const event = makeRouteEvent({
      user: safeUser(u),
      memberships: [m_row],
      params: { id: String(c.id) },
      cookies,
      request: new Request('http://localhost/', { method: 'POST' })
    });
    await expect(
      actions.optInBento(event as unknown as Parameters<typeof actions.optInBento>[0])
    ).rejects.toMatchObject({ status: 303 });
    expect(cookies.get('bento')).toBe('1');
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `npx vitest run src/routes/child/[id]/page.server.test.ts -t 'optInBento'`
Expected: FAIL — action doesn't exist.

- [ ] **Step 3: Add the action**

In `src/routes/child/[id]/+page.server.ts`, find the `actions` export (or add one if it doesn't exist) and append:

```ts
import { redirect } from '@sveltejs/kit';
import { requireMembership } from '$lib/server/guards';

export const actions: Actions = {
  // ...existing actions
  optInBento: async ({ cookies, params, locals }) => {
    requireMembership(locals, Number(params.id));
    cookies.set('bento', '1', {
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 365
    });
    throw redirect(303, `/child/${params.id}`);
  }
};
```

- [ ] **Step 4: Wire the banner into the page Svelte**

In `src/routes/child/[id]/+page.svelte`, identify the legacy-branch render block (the `{:else}` of the `{#if data.bento}`). At the top of that block, add:

```svelte
<BentoOptInBanner childId={String($page.params.id)} />
```

And import at the top:

```svelte
import BentoOptInBanner from '$lib/components/bento/BentoOptInBanner.svelte';
import { page } from '$app/stores';
```

- [ ] **Step 5: Run the tests**

Run: `npx vitest run src/routes/child/[id]/page.server.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/routes/child/[id]/+page.server.ts src/routes/child/[id]/+page.svelte src/routes/child/[id]/page.server.test.ts
git commit -m "feat(bento): opt-in banner on legacy Aujourd'hui with ?/optInBento action"
```

---

### Task 13: `LandingHeroBento` component

**Files:**

- Create: `src/lib/components/landing/LandingHeroBento.svelte`
- Create: `src/lib/components/landing/LandingHeroBento.test.ts`

- [ ] **Step 1: Read the existing `LandingHero.svelte`** to confirm what props it takes (likely `child` or none) and what the signed-in CTA logic is.

- [ ] **Step 2: Write the failing test**

Create `src/lib/components/landing/LandingHeroBento.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import LandingHeroBento from './LandingHeroBento.svelte';

afterEach(() => cleanup());

describe('LandingHeroBento', () => {
  it('renders the bento mark, headline, and signup CTA for signed-out visitors', () => {
    render(LandingHeroBento, { props: { child: null } });
    expect(screen.getByLabelText('Diversif')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Cr.er mon compte/i })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Se connecter/i })).toBeTruthy();
  });

  it('renders the continue-CTA for signed-in visitors with a child', () => {
    render(LandingHeroBento, {
      props: { child: { id: '1', name: 'Léo' } }
    });
    expect(screen.getByRole('link', { name: /Léo/i })).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/components/landing/LandingHeroBento.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement the component**

Create `src/lib/components/landing/LandingHeroBento.svelte`:

```svelte
<script lang="ts">
  import BentoMark from '$lib/components/bento/BentoMark.svelte';
  import { localizedHref } from '$lib/utils/localized-href';
  import * as m from '$lib/paraglide/messages';

  let { child }: { child: { id: string; name: string } | null } = $props();
</script>

<section class="bg-tile-peach px-6 py-16 sm:px-10">
  <div class="mx-auto max-w-3xl">
    <BentoMark size={48} class="mb-6" />
    <h1 class="font-display text-4xl italic leading-tight sm:text-5xl">
      Diversifier en confiance, à votre rythme.
    </h1>
    <p class="mt-4 max-w-xl text-base text-tile-peach-foreground">
      Un carnet calme pour suivre l'introduction des aliments, à deux parents si vous voulez. Sans
      télémétrie, avec des sources scientifiques citées.
    </p>
    <div class="mt-6 flex flex-wrap items-center gap-3">
      {#if child}
        <a
          href={localizedHref(`/child/${child.id}`)}
          class="rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-soft"
        >
          Continuer avec {child.name}
        </a>
      {:else}
        <a
          href={localizedHref('/signup')}
          class="rounded-full bg-primary px-5 py-3 text-sm font-bold text-primary-foreground shadow-soft"
        >
          Créer mon compte
        </a>
        <a
          href={localizedHref('/login')}
          class="text-sm font-semibold text-primary underline"
        >
          Se connecter
        </a>
      {/if}
    </div>
  </div>
</section>
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run src/lib/components/landing/LandingHeroBento.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/landing/LandingHeroBento.svelte src/lib/components/landing/LandingHeroBento.test.ts
git commit -m "feat(landing): LandingHeroBento — peach hero with bento mark"
```

---

### Task 14: `LandingFeaturesBento` component

**Files:**

- Create: `src/lib/components/landing/LandingFeaturesBento.svelte`
- Create: `src/lib/components/landing/LandingFeaturesBento.test.ts`

- [ ] **Step 1: Read existing `LandingFeatures.svelte`** to see what features are listed and their copy.

- [ ] **Step 2: Write the failing test**

Create `src/lib/components/landing/LandingFeaturesBento.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import LandingFeaturesBento from './LandingFeaturesBento.svelte';

afterEach(() => cleanup());

describe('LandingFeaturesBento', () => {
  it('renders the section title and four feature tiles', () => {
    render(LandingFeaturesBento);
    expect(screen.getByText('Pourquoi Diversif')).toBeTruthy();
    // Each tile has its own heading or label - assert four are rendered
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings.length).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/components/landing/LandingFeaturesBento.test.ts`
Expected: FAIL.

- [ ] **Step 4: Implement the component**

Create `src/lib/components/landing/LandingFeaturesBento.svelte`:

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { Apple, Clock, ShieldCheck, BookOpen } from 'lucide-svelte';

  const FEATURES = [
    {
      tile: 'bg-tile-mint',
      icon: Apple,
      title: 'Carnet d\'aliments',
      body: 'Notez chaque essai en 4 taps, suivez ce qui a été tenté et ce qui reste à découvrir.'
    },
    {
      tile: 'bg-tile-butter',
      icon: Clock,
      title: 'Allergènes prioritaires',
      body: '14 allergènes suivis selon les recommandations HCSP, LEAP et EAT.'
    },
    {
      tile: 'bg-tile-sky',
      icon: ShieldCheck,
      title: 'Co-parents',
      body: 'Partagez le suivi avec votre partenaire ou un proche, sans copier-coller.'
    },
    {
      tile: 'bg-tile-lilac',
      icon: BookOpen,
      title: 'Guide par étape',
      body: 'Conseils contextualisés selon l\'âge — toujours avec leurs sources citées.'
    }
  ];
</script>

<section class="bg-canvas px-6 py-14 sm:px-10">
  <div class="mx-auto max-w-3xl">
    <h2 class="font-display text-2xl italic">{m.landingFeaturesTitle()}</h2>
    <div class="mt-6 grid gap-3 sm:grid-cols-2">
      {#each FEATURES as f, i (i)}
        <article class="rounded-tile {f.tile} p-5 shadow-soft">
          <f.icon size={20} class="text-ink" aria-hidden="true" />
          <h3 class="mt-3 text-base font-bold leading-tight">{f.title}</h3>
          <p class="mt-1 text-sm text-ink-soft">{f.body}</p>
        </article>
      {/each}
    </div>
  </div>
</section>
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run src/lib/components/landing/LandingFeaturesBento.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/landing/LandingFeaturesBento.svelte src/lib/components/landing/LandingFeaturesBento.test.ts
git commit -m "feat(landing): LandingFeaturesBento — 4-tile cluster"
```

---

### Task 15: `LandingTrustBento` component

**Files:**

- Create: `src/lib/components/landing/LandingTrustBento.svelte`
- Create: `src/lib/components/landing/LandingTrustBento.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/components/landing/LandingTrustBento.test.ts`:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import LandingTrustBento from './LandingTrustBento.svelte';

afterEach(() => cleanup());

describe('LandingTrustBento', () => {
  it('renders the three trust pillars', () => {
    render(LandingTrustBento);
    expect(screen.getByText('Sans télémétrie')).toBeTruthy();
    expect(screen.getByText('Sources scientifiques citées')).toBeTruthy();
    expect(screen.getByText('Vos données vous appartiennent')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify fail**

Run: `npx vitest run src/lib/components/landing/LandingTrustBento.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/components/landing/LandingTrustBento.svelte`:

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { EyeOff, BookOpen, Lock } from 'lucide-svelte';

  const PILLARS = [
    { icon: EyeOff, key: 'landingTrustPillarNoTelemetry' },
    { icon: BookOpen, key: 'landingTrustPillarSources' },
    { icon: Lock, key: 'landingTrustPillarOwnership' }
  ] as const;
</script>

<section class="bg-tile-sky px-6 py-14 sm:px-10">
  <div class="mx-auto max-w-3xl">
    <h2 class="font-display text-2xl italic text-tile-sky-foreground">
      {m.landingTrustTitle()}
    </h2>
    <ul class="mt-6 grid gap-3 sm:grid-cols-3">
      {#each PILLARS as p (p.key)}
        <li class="flex items-start gap-3 rounded-tile bg-surface p-4 shadow-soft">
          <p.icon size={18} class="mt-0.5 text-primary" aria-hidden="true" />
          <span class="text-sm font-bold leading-tight">{m[p.key]()}</span>
        </li>
      {/each}
    </ul>
  </div>
</section>
```

- [ ] **Step 4: Run + commit**

Run: `npx vitest run src/lib/components/landing/LandingTrustBento.test.ts`
Expected: PASS.

```bash
git add src/lib/components/landing/LandingTrustBento.svelte src/lib/components/landing/LandingTrustBento.test.ts
git commit -m "feat(landing): LandingTrustBento — 3 trust pillars on sky"
```

---

### Task 16: `LandingClosingCtaBento` component

**Files:**

- Create: `src/lib/components/landing/LandingClosingCtaBento.svelte`
- Create: `src/lib/components/landing/LandingClosingCtaBento.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import LandingClosingCtaBento from './LandingClosingCtaBento.svelte';

afterEach(() => cleanup());

describe('LandingClosingCtaBento', () => {
  it('renders the closing title and signup CTA', () => {
    render(LandingClosingCtaBento);
    expect(screen.getByText(/Pr.t à commencer/)).toBeTruthy();
    const cta = screen.getByRole('link', { name: /Cr.er mon compte/ });
    expect(cta.getAttribute('href')).toBe('/signup');
  });
});
```

- [ ] **Step 2: Run + verify fail**

Run: `npx vitest run src/lib/components/landing/LandingClosingCtaBento.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/lib/components/landing/LandingClosingCtaBento.svelte`:

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';
</script>

<section class="bg-primary px-6 py-14 text-primary-foreground sm:px-10">
  <div class="mx-auto max-w-3xl text-center">
    <h2 class="font-display text-2xl italic">{m.landingClosingCtaTitle()}</h2>
    <a
      href={localizedHref('/signup')}
      class="mt-6 inline-block rounded-full bg-surface px-6 py-3 text-sm font-bold text-primary shadow-soft transition-transform duration-base ease-soft active:scale-[0.99]"
    >
      {m.landingClosingCtaButton()}
    </a>
  </div>
</section>
```

- [ ] **Step 4: Run + commit**

```bash
git add src/lib/components/landing/LandingClosingCtaBento.svelte src/lib/components/landing/LandingClosingCtaBento.test.ts
git commit -m "feat(landing): LandingClosingCtaBento — sage closing CTA"
```

---

### Task 17: Wire bento landing components into `/+page.svelte`

**Files:**

- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Read the existing `/+page.svelte`** to preserve `Seo`, `JsonLd`, FAQ, and locale-banner imports.

- [ ] **Step 2: Swap imports + body**

Replace `LandingHero` / `LandingFeatures` / `LandingTrust` / `LandingClosingCta` imports with the bento variants. The FAQ section's `<details>` markup stays inline — just apply bento tokens to it (cream canvas, sage links).

```svelte
<script lang="ts">
  import LandingHeroBento from '$lib/components/landing/LandingHeroBento.svelte';
  import LandingFeaturesBento from '$lib/components/landing/LandingFeaturesBento.svelte';
  import LandingTrustBento from '$lib/components/landing/LandingTrustBento.svelte';
  import LandingClosingCtaBento from '$lib/components/landing/LandingClosingCtaBento.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import JsonLd from '$lib/components/JsonLd.svelte';
  // ...rest of imports (faq data, $page, SITE, faqPageJsonLd, webApplicationJsonLd) kept verbatim

  let { data }: { data: PageData } = $props();
  // existing $derived siteUrl, landingFaq kept
</script>

<Seo .../>
<JsonLd json={webApplicationJsonLd(siteUrl)} />
<JsonLd json={faqPageJsonLd(landingFaq)} />

<LandingHeroBento child={data.firstChild ?? null} />
<LandingFeaturesBento />
<LandingTrustBento />
<LandingClosingCtaBento />

<section id="faq" class="bg-canvas px-6 py-14 sm:px-10">
  <!-- preserve existing FAQ markup, restyled with bento tokens -->
</section>
```

Keep the FAQ markup's existing structure (the JSON-LD relies on it semantically). Just apply tailwind bento classes.

- [ ] **Step 3: Run the page test**

Run: `npx vitest run src/routes/page.server.test.ts`
Expected: PASS. If the test asserts on specific element class names, update them.

- [ ] **Step 4: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat(landing): swap landing body for bento variants, SEO/JSON-LD untouched"
```

---

### Task 18: Restyle `/cgu`

**Files:**

- Modify: `src/routes/cgu/+page.svelte`

- [ ] **Step 1: Read the page** (~109 lines) and identify the structure: `<h1>` page title, multiple `<section>` blocks with `<h2>` headings, paragraphs and lists.

- [ ] **Step 2: Apply bento restyle inline**

Update the body wrapper to `bg-canvas` and the typography:

```svelte
<main class="mx-auto max-w-3xl px-6 py-10 text-ink sm:px-10">
  <h1 class="font-display text-3xl italic">Conditions générales d'utilisation</h1>
  <section class="mt-8 space-y-3">
    <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">1. Objet</h2>
    <p class="text-sm leading-relaxed">…existing paragraph…</p>
    <!-- continue with all sections -->
  </section>
  <!-- repeat for each section -->
</main>
```

In-content `<a>` links: add `class="text-primary underline"`.

Copy stays unchanged. Headings keep the same text. Only the `class=` attributes change.

- [ ] **Step 3: Verify the page renders without errors**

Run: `npm run check` (svelte-check).
Expected: 0 errors related to `/cgu`.

- [ ] **Step 4: Commit**

```bash
git add src/routes/cgu/+page.svelte
git commit -m "feat(legal): restyle /cgu with bento typography"
```

---

### Task 19: Restyle `/mentions-legales`

**Files:**

- Modify: `src/routes/mentions-legales/+page.svelte`

- [ ] **Step 1: Apply the same restyle pattern as Task 18**

Body: `bg-canvas`, max-width container, Fraunces italic h1, uppercase-tracking-wider h2, body text with `leading-relaxed`, sage underlined in-content links.

Copy stays unchanged.

- [ ] **Step 2: Verify + commit**

Run: `npm run check`. Expected: clean.

```bash
git add src/routes/mentions-legales/+page.svelte
git commit -m "feat(legal): restyle /mentions-legales with bento typography"
```

---

### Task 20: Restyle `/politique-confidentialite`

**Files:**

- Modify: `src/routes/politique-confidentialite/+page.svelte`

Same pattern as Tasks 18-19. Copy unchanged.

```bash
git add src/routes/politique-confidentialite/+page.svelte
git commit -m "feat(legal): restyle /politique-confidentialite with bento typography"
```

---

### Task 21: Restyle `/cookies`

**Files:**

- Modify: `src/routes/cookies/+page.svelte`

Same pattern. Copy unchanged.

```bash
git add src/routes/cookies/+page.svelte
git commit -m "feat(legal): restyle /cookies with bento typography"
```

---

### Task 22: E2E spec — signup-to-bento happy path

**Files:**

- Create: `e2e/bento-auth-onboarding.spec.ts`

- [ ] **Step 1: Implement the spec**

```ts
import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 414, height: 896 } });

const BASE_URL = `http://localhost:${process.env.PORT ?? '4173'}`;

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

test("signup sets bento cookie and lands on bento Aujourd'hui", async ({ page, context }) => {
  const email = `${unique('phase6')}@example.com`;
  await page.goto('/signup');
  await page.getByLabel('Votre prénom').fill('Parent');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('hunter2-very-long');
  await page.getByLabel(/au moins 15 ans/i).check();
  await page.getByLabel(/conditions générales/i).check();
  await page.getByLabel(/politique de confidentialité/i).check();
  await page.getByRole('button', { name: /créer mon compte/i }).click();

  await expect(page).toHaveURL(/\/child\/new/);

  // Bento cookie should have been set
  const cookies = await context.cookies();
  expect(cookies.find((c) => c.name === 'bento')?.value).toBe('1');

  // Onboarding renders bento layout
  await expect(page.getByLabel('Prénom')).toBeVisible();
  await expect(page.getByLabel('Inviter un co-parent maintenant')).toBeVisible();

  // Complete onboarding without invite
  await page.getByLabel('Prénom').fill('Léo');
  await page.getByLabel('Date de naissance').fill('2025-10-01');
  await page.getByRole('button', { name: 'Commencer' }).click();

  await expect(page).toHaveURL(/\/child\/\d+$/);

  // Bento app shell renders (FAB + bottom nav)
  await expect(page.getByRole('button', { name: 'Enregistrer un aliment' })).toBeVisible();
});

test('onboarding with inviteCoparent generates a code visible in the redirect query', async ({
  page,
  context
}) => {
  const email = `${unique('phase6')}@example.com`;
  await page.goto('/signup');
  await page.getByLabel('Votre prénom').fill('Parent');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('hunter2-very-long');
  await page.getByLabel(/au moins 15 ans/i).check();
  await page.getByLabel(/conditions générales/i).check();
  await page.getByLabel(/politique de confidentialité/i).check();
  await page.getByRole('button', { name: /créer mon compte/i }).click();

  await page.getByLabel('Prénom').fill('Léo');
  await page.getByLabel('Date de naissance').fill('2025-10-01');
  await page.getByLabel('Inviter un co-parent maintenant').check();
  await page.getByRole('button', { name: 'Commencer' }).click();

  await expect(page).toHaveURL(/\/child\/\d+\?inviteCode=[A-Z0-9]+$/i);
});
```

- [ ] **Step 2: Commit**

```bash
git add e2e/bento-auth-onboarding.spec.ts
git commit -m "test(e2e): signup-to-bento + onboarding-with-invite happy paths"
```

---

### Task 23: E2E spec — legacy opt-in banner

**Files:**

- Create: `e2e/bento-optin-banner.spec.ts`

- [ ] **Step 1: Implement the spec**

```ts
import { test, expect, type Page } from '@playwright/test';

test.use({ viewport: { width: 414, height: 896 } });

const BASE_URL = `http://localhost:${process.env.PORT ?? '4173'}`;

function unique(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

async function signUpAndCreateChild(page: Page, name: string, birthDate: string): Promise<string> {
  const email = `${unique('optin')}@example.com`;
  await page.goto('/signup');
  await page.getByLabel('Votre prénom').fill('Parent');
  await page.getByLabel('Adresse e-mail').fill(email);
  await page.getByLabel('Mot de passe').fill('hunter2-very-long');
  await page.getByLabel(/au moins 15 ans/i).check();
  await page.getByLabel(/conditions générales/i).check();
  await page.getByLabel(/politique de confidentialité/i).check();
  await page.getByRole('button', { name: /créer mon compte/i }).click();
  await expect(page).toHaveURL(/\/child\/new/);

  await page.getByLabel('Prénom').fill(name);
  await page.getByLabel('Date de naissance').fill(birthDate);
  await page.getByRole('button', { name: 'Commencer' }).click();
  await expect(page).toHaveURL(/\/child\/\d+$/);

  const match = page.url().match(/\/child\/(\d+)$/);
  if (!match) throw new Error('expected /child/<id>');
  return match[1];
}

test('legacy user sees opt-in banner; clicking CTA switches to bento', async ({
  page,
  context
}) => {
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');

  // Force legacy: clear the bento cookie set by signup
  await context.clearCookies();
  // Reload to sign-in flow — sign in again
  await page.goto('/login');
  // ...sign in flow using the same email/password (extract the email from the test).
  // OR: just manually set bento=0 to simulate legacy state without re-signing in:
  await context.addCookies([{ name: 'bento', value: '0', url: BASE_URL }]);
  await page.goto(`/child/${childId}`);

  // Banner is visible (would not be in bento branch)
  await expect(page.getByText(/nouveau design est prêt/i)).toBeVisible();

  // Click the CTA
  await page.getByRole('button', { name: /Essayer le nouveau design/ }).click();
  await expect(page).toHaveURL(new RegExp(`/child/${childId}$`));

  // Bento chrome is now visible
  await expect(page.getByRole('button', { name: 'Enregistrer un aliment' })).toBeVisible();
});

test('dismissing the opt-in banner hides it without changing the design', async ({
  page,
  context
}) => {
  const childId = await signUpAndCreateChild(page, 'Léo', '2025-10-01');
  await context.addCookies([{ name: 'bento', value: '0', url: BASE_URL }]);
  await page.goto(`/child/${childId}`);

  await page.getByRole('button', { name: 'Fermer le panneau' }).click();
  await expect(page.getByText(/nouveau design est prêt/i)).not.toBeVisible();

  // Reload — banner stays dismissed
  await page.reload();
  await expect(page.getByText(/nouveau design est prêt/i)).not.toBeVisible();
});
```

The `signUpAndCreateChild` helper is repeated from Task 22 — fine; e2e specs each carry their own copy for isolation.

> The "force legacy" approach via `addCookies({ name: 'bento', value: '0', ... })` works because `bentoEnabled` returns false when the cookie isn't `'1'`. The owner-email allow-list still triggers true for the seeded user if their email matches `BENTO_ALLOW_LIST`. Use a fresh email (the `unique()` helper guarantees this), so the user is NOT in the allow-list and `bentoEnabled` falls back to the cookie check.

- [ ] **Step 2: Commit**

```bash
git add e2e/bento-optin-banner.spec.ts
git commit -m "test(e2e): legacy opt-in banner shows, opt-in works, dismiss persists"
```

---

## Final verification (no separate task, run before pushing)

```bash
npm run check                 # typecheck
npm run lint                  # eslint + prettier
npm run test:coverage         # 100% coverage gate
npx playwright test           # local-only smoke; full e2e runs in CI
```

If any gate fails, address it in a follow-up task before opening the PR.

---

## Self-review summary

Spec coverage:

- ✅ Auth (signup, login) → Tasks 3, 4, 5, 6, 7
- ✅ Onboarding form + invite → Tasks 8, 9, 10
- ✅ Shared invitation helper → Task 2
- ✅ Landing components → Tasks 13, 14, 15, 16
- ✅ Landing page wired → Task 17
- ✅ Legal pages restyle → Tasks 18, 19, 20, 21
- ✅ Opt-in banner + action → Tasks 11, 12
- ✅ I18n keys → Task 1
- ✅ E2E coverage → Tasks 22, 23

Type consistency:

- `createInvitationForChild({ childId, createdBy })` signature used consistently across Tasks 2, 10
- `BentoOptInBanner.childId: string` used consistently across Tasks 11, 12
- `LandingHeroBento.child: { id, name } | null` used consistently across Tasks 13, 17
- `OnboardingForm.errors: { firstName?, birthDate? } | null` matches the test fixture in Task 8 and the form-error pattern referenced in Task 9

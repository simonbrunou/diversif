# i18n Scaffolding (paraglide-sveltekit, FR + EN) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire `@inlang/paraglide-sveltekit` for FR + EN, translate a representative slice (chrome + auth + dashboard headings) end-to-end, leave long-form expert content (`guidance.ts`, legal pages) FR-only with explicit annotation.

**Architecture:** Default locale `fr` is unprefixed (existing URLs unchanged). `en` gets `/en/` prefix. Paraglide's `reroute` hook normalises the path; `paraglideMiddleware` sets `event.locals.locale`. Messages live in `messages/{fr,en}.json`, compiled to `src/lib/paraglide/` by the vite plugin. Components import `m.X()` from the generated module.

**Tech Stack:** SvelteKit 2, `@inlang/paraglide-js` v1.x, `@inlang/paraglide-sveltekit` v0.x, Vitest, Playwright. Spec: `docs/superpowers/specs/2026-05-07-i18n-scaffolding-design.md`.

---

## Message-key naming convention

To keep `messages/fr.json` browseable as it grows:

- Dot-namespaced: `chrome.publicHeader.brand`, `auth.login.title`, `errors.invalidCredentials`.
- Top-level namespaces: `chrome`, `auth`, `dashboard`, `dialogs`, `errors`, `legal`, `common`.
- Use ICU MessageFormat for placeholders: `"{name, select, * {Bonjour {name}!}}"` style is overkill for this scope; plain `"Bonjour {name} !"` works for the cases we have.
- Keys with placeholders: name them with the placeholder hint (`dashboard.greetingWithName`).

---

## File map

| Path                                                                                                         | Status | Responsibility                                                                                        |
| ------------------------------------------------------------------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------- |
| `package.json`                                                                                               | edit   | Add `@inlang/paraglide-js` (dep), `@inlang/paraglide-sveltekit` (devDep).                             |
| `project.inlang/settings.json`                                                                               | new    | Locale declaration + message-format plugin config.                                                    |
| `messages/fr.json`                                                                                           | new    | French source-of-truth. Grows across tasks.                                                           |
| `messages/en.json`                                                                                           | new    | English translations. Mirror keys exactly.                                                            |
| `src/app.html`                                                                                               | edit   | `lang="fr"` → `lang="%paraglide.lang%"`.                                                              |
| `src/lib/i18n.ts`                                                                                            | new    | `export const i18n = createI18n(runtime)` — single source of truth for the paraglide adapter helpers. |
| `src/hooks.ts`                                                                                               | new    | `export const reroute = i18n.reroute()`.                                                              |
| `src/hooks.server.ts`                                                                                        | edit   | Compose `paraglideMiddleware` with the existing `handle`.                                             |
| `vite.config.ts`                                                                                             | edit   | Add `paraglide(...)` plugin; add `src/lib/paraglide/**` and `src/hooks.ts` to `coverage.exclude`.     |
| `.gitignore`                                                                                                 | edit   | Add `src/lib/paraglide/`.                                                                             |
| `src/lib/components/LocaleSwitcher.svelte`                                                                   | new    | "FR / EN" pill with `data-active`.                                                                    |
| `src/lib/components/PublicHeader.svelte`                                                                     | edit   | Strings → `m.X()`; mount `LocaleSwitcher`.                                                            |
| `src/lib/components/PublicFooter.svelte`                                                                     | edit   | Strings → `m.X()`.                                                                                    |
| `src/lib/components/LegalLinks.svelte`                                                                       | edit   | Link labels.                                                                                          |
| `src/lib/components/AppShell.svelte`                                                                         | edit   | Strings → `m.X()`; mount `LocaleSwitcher`.                                                            |
| `src/lib/components/BottomNav.svelte`                                                                        | edit   | Strings → `m.X()`.                                                                                    |
| `src/lib/components/WelcomeDialog.svelte`                                                                    | edit   | Strings → `m.X()`.                                                                                    |
| `src/routes/+error.svelte`                                                                                   | edit   | Strings → `m.X()`.                                                                                    |
| `src/routes/cookies/+page.svelte`                                                                            | edit   | Strings → `m.X()`.                                                                                    |
| `src/routes/login/+page.svelte`, `+page.server.ts`                                                           | edit   | UI strings; actions return `errorKey`.                                                                |
| `src/routes/signup/+page.svelte`, `+page.server.ts`                                                          | edit   | Same.                                                                                                 |
| `src/routes/account/+page.svelte`, `+page.server.ts`                                                         | edit   | Same.                                                                                                 |
| `src/routes/account/deleted/+page.svelte`                                                                    | edit   | Strings → `m.X()`.                                                                                    |
| `src/routes/child/[id]/+page.svelte`                                                                         | edit   | Headings, button labels, badge labels, welcome banner.                                                |
| `src/routes/child/[id]/guide/+page.svelte`                                                                   | edit   | FR-only banner if `languageTag()==='en'`; wrap content in `<section lang="fr">`.                      |
| `src/routes/mentions-legales/+page.svelte`, `politique-confidentialite/+page.svelte`, `sources/+page.svelte` | edit   | Same FR-only banner pattern.                                                                          |
| `src/lib/components/Seo.svelte`                                                                              | edit   | Add `alternateLocales?: string[]` prop; emit `<link rel="alternate" hreflang="...">`.                 |
| `src/routes/sitemap.xml/+server.ts`                                                                          | edit   | Emit `/en/...` for translated routes.                                                                 |
| `tests/i18n.spec.ts`                                                                                         | new    | Playwright smoke.                                                                                     |

Existing tests for the touched routes/components keep running unchanged (the inline-string → `m.X()` swap is 1:1; tests assert behaviour, not literal copy). New tests are added for `LocaleSwitcher` and the `errorKey` pattern.

---

## Task 1 — Infrastructure pilot

Wire everything end-to-end with **one** translated string. Goal: prove the build/dev/test pipeline works with paraglide before doing bulk extraction. Subsequent tasks just add more keys.

**Files:**

- `package.json` (edit)
- `project.inlang/settings.json` (new)
- `messages/fr.json`, `messages/en.json` (new)
- `src/app.html` (edit)
- `src/lib/i18n.ts` (new)
- `src/hooks.ts` (new)
- `src/hooks.server.ts` (edit — compose `paraglideMiddleware`)
- `vite.config.ts` (edit)
- `.gitignore` (edit)
- `src/lib/components/PublicHeader.svelte` (edit — pilot string only: brand label)

- [ ] **Step 1: Install deps**

```bash
npm install @inlang/paraglide-js
npm install -D @inlang/paraglide-sveltekit
```

Use the latest 1.x of `paraglide-js` and 0.x of `paraglide-sveltekit` available on npm. Run `npm view @inlang/paraglide-js version` and `npm view @inlang/paraglide-sveltekit version` if unsure.

DO NOT run `npm audit fix`. CI's older npm doesn't tolerate the lockfile changes that produces.

- [ ] **Step 2: Create `project.inlang/settings.json`**

```json
{
  "$schema": "https://inlang.com/schema/project-settings",
  "sourceLanguageTag": "fr",
  "languageTags": ["fr", "en"],
  "modules": [
    "https://cdn.jsdelivr.net/npm/@inlang/message-lint-rule-empty-pattern@latest/dist/index.js",
    "https://cdn.jsdelivr.net/npm/@inlang/message-lint-rule-missing-translation@latest/dist/index.js",
    "https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@latest/dist/index.js"
  ],
  "plugin.inlang.messageFormat": {
    "pathPattern": "./messages/{languageTag}.json"
  }
}
```

- [ ] **Step 3: Create `messages/fr.json` and `messages/en.json`**

`messages/fr.json`:

```json
{
  "$schema": "https://inlang.com/schema/inlang-message-format",
  "chrome.publicHeader.brand": "Diversif"
}
```

`messages/en.json`:

```json
{
  "$schema": "https://inlang.com/schema/inlang-message-format",
  "chrome.publicHeader.brand": "Diversif"
}
```

(The brand name doesn't translate, but it's still a real `m.X()` call at the end of this task.)

- [ ] **Step 4: Add `paraglide` vite plugin**

Edit `vite.config.ts`. Add the import (alphabetised with existing imports):

```ts
import { paraglide } from '@inlang/paraglide-sveltekit/vite';
```

Add the plugin to the `plugins` array (after `sveltekit()` and before `SvelteKitPWA(...)`):

```ts
    paraglide({
      project: './project.inlang',
      outdir: './src/lib/paraglide'
    }),
```

In the `coverage.exclude` array, add (with comment):

```ts
        // Paraglide-generated runtime + messages — regenerated on every
        // build by @inlang/paraglide-sveltekit/vite. No point measuring.
        'src/lib/paraglide/**',
        // Universal hook (one-line re-export of paraglide's reroute helper).
        'src/hooks.ts',
```

- [ ] **Step 5: Add `src/lib/paraglide/` to `.gitignore`**

Append to `.gitignore`:

```
# Paraglide-generated runtime — vite plugin regenerates on build/dev.
src/lib/paraglide/
```

- [ ] **Step 6: Create `src/lib/i18n.ts`**

```ts
import { createI18n } from '@inlang/paraglide-sveltekit';
import * as runtime from '$lib/paraglide/runtime';

/**
 * Single source of truth for paraglide-sveltekit's runtime helpers.
 * Used by `src/hooks.ts` (reroute), `src/hooks.server.ts` (handle),
 * and components needing to build alternate-locale URLs.
 */
export const i18n = createI18n(runtime);
```

- [ ] **Step 7: Create `src/hooks.ts`**

```ts
import { i18n } from '$lib/i18n';

export const reroute = i18n.reroute();
```

- [ ] **Step 8: Update `src/app.html`**

Replace `<html lang="fr">` with `<html lang="%paraglide.lang%">`. Single line change.

- [ ] **Step 9: Compose `paraglideMiddleware` in `src/hooks.server.ts`**

Existing `hooks.server.ts` exports `handle` (with session loading + security headers) and `handleError` (with Sentry). Wrap `handle` with paraglide.

Add the import (after existing imports):

```ts
import { i18n } from '$lib/i18n';
```

Then change the `handle` export. The existing single-`Handle` export becomes a `sequence` of paraglide's handle and the existing one. Use SvelteKit's `sequence` helper.

Add this import alongside the existing `import type { Handle, HandleServerError } from '@sveltejs/kit';`:

```ts
import { sequence } from '@sveltejs/kit/hooks';
```

Rename the existing `handle` export to `appHandle` (a local function, not exported), and replace the export with:

```ts
export const handle: Handle = sequence(i18n.handle(), appHandle);
```

The `appHandle` is the existing function body — only the name changes. The existing tests in `hooks.server.test.ts` that call `handle({...})` continue to pass because `sequence([a, b])({event, resolve})` calls `a` first, which then calls `b` via its `resolve`. Paraglide's handle just sets the locale and forwards.

- [ ] **Step 10: Use the pilot message in `PublicHeader.svelte`**

Find the existing brand label in `src/lib/components/PublicHeader.svelte`. Replace the literal "Diversif" string with `{m['chrome.publicHeader.brand']()}`.

Add the import at the top of the `<script>` block:

```ts
import * as m from '$lib/paraglide/messages';
```

(The dotted-namespace key style requires bracket access — `m['chrome.publicHeader.brand']()` rather than `m.chrome.publicHeader.brand()`. Paraglide compiles all keys to flat top-level exports; the dot is part of the export name string. TypeScript types via `keyof typeof m` keep this safe.)

- [ ] **Step 11: First build — generates `src/lib/paraglide/`**

```bash
npm run build 2>&1 | tail -10
```

Expected: build succeeds. The vite plugin regenerates `src/lib/paraglide/messages/index.js`, `src/lib/paraglide/runtime.js`, and a few support files. `ls src/lib/paraglide/` should now show several files.

If the build fails with a paraglide error, the most common cause is a misconfigured `project.inlang/settings.json` — re-check Step 2.

- [ ] **Step 12: Run all gates**

```bash
npm run check 2>&1 | tail -3
npm run test 2>&1 | tail -5
npm run test:coverage 2>&1 | grep -E "All files|ERROR" | head -3
```

Expected: 0 typecheck errors, 704+ tests pass, 100% coverage. The pilot string change is behaviour-equivalent to the previous literal "Diversif" — existing tests assert structure, not literal text.

- [ ] **Step 13: Manual smoke**

```bash
npm run dev &
sleep 3
curl -s http://localhost:5173/ | grep -E '<html|Diversif' | head -3
curl -s http://localhost:5173/en/ | grep -E '<html|Diversif' | head -3
kill %1
```

Expected: the FR URL returns `<html lang="fr">` and the EN URL returns `<html lang="en">`. The brand label "Diversif" appears in both responses.

- [ ] **Step 14: Commit**

```bash
git add package.json package-lock.json project.inlang messages .gitignore vite.config.ts src/app.html src/lib/i18n.ts src/hooks.ts src/hooks.server.ts src/lib/components/PublicHeader.svelte
git commit -m "Wire paraglide-sveltekit pilot: FR default, /en/ prefix, one shared key"
```

---

## Task 2 — LocaleSwitcher component (TDD)

A small component used in `PublicHeader` and `AppShell` (later tasks mount it).

**Files:**

- Create: `src/lib/components/LocaleSwitcher.svelte`
- Create: `src/lib/components/LocaleSwitcher.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import LocaleSwitcher from './LocaleSwitcher.svelte';

vi.mock('$app/state', () => ({
  page: { url: { pathname: '/login' } }
}));

vi.mock('$lib/paraglide/runtime', () => ({
  languageTag: vi.fn(() => 'fr'),
  availableLanguageTags: ['fr', 'en'] as const
}));

vi.mock('$lib/i18n', () => ({
  i18n: {
    route: (path: string, locale: string) => (locale === 'fr' ? path : `/${locale}${path}`)
  }
}));

describe('LocaleSwitcher', () => {
  it('renders both FR and EN as anchors', () => {
    render(LocaleSwitcher);
    const fr = screen.getByRole('link', { name: /fr/i });
    const en = screen.getByRole('link', { name: /en/i });
    expect(fr).toHaveAttribute('href', '/login');
    expect(en).toHaveAttribute('href', '/en/login');
  });

  it('marks the current locale with data-active', async () => {
    render(LocaleSwitcher);
    const fr = screen.getByRole('link', { name: /fr/i });
    const en = screen.getByRole('link', { name: /en/i });
    expect(fr).toHaveAttribute('data-active', 'true');
    expect(en).not.toHaveAttribute('data-active');
  });

  it('flips data-active when languageTag is en', async () => {
    const runtime = await import('$lib/paraglide/runtime');
    vi.mocked(runtime.languageTag).mockReturnValue('en');

    render(LocaleSwitcher);
    const fr = screen.getByRole('link', { name: /fr/i });
    const en = screen.getByRole('link', { name: /en/i });
    expect(fr).not.toHaveAttribute('data-active');
    expect(en).toHaveAttribute('data-active', 'true');
  });
});
```

- [ ] **Step 2: Run tests, expect failure**

```bash
npx vitest run src/lib/components/LocaleSwitcher.test.ts
```

Expected: fails (`Cannot find module './LocaleSwitcher.svelte'`).

- [ ] **Step 3: Implement the component**

```svelte
<script lang="ts">
  import { page } from '$app/state';
  import { languageTag, availableLanguageTags } from '$lib/paraglide/runtime';
  import { i18n } from '$lib/i18n';

  const labels: Record<string, string> = { fr: 'FR', en: 'EN' };
</script>

<nav class="locale-switcher" aria-label="Choix de la langue">
  {#each availableLanguageTags as locale}
    <a
      href={i18n.route(page.url.pathname, locale)}
      data-active={languageTag() === locale ? 'true' : undefined}
      hreflang={locale}
      lang={locale}
    >
      {labels[locale] ?? locale.toUpperCase()}
    </a>
  {/each}
</nav>

<style>
  .locale-switcher {
    display: inline-flex;
    gap: 0.25rem;
    font-size: 0.75rem;
  }
  .locale-switcher a {
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    color: hsl(var(--muted-foreground));
    text-decoration: none;
  }
  .locale-switcher a[data-active='true'] {
    color: hsl(var(--foreground));
    font-weight: 600;
  }
  .locale-switcher a:hover:not([data-active='true']) {
    color: hsl(var(--foreground));
  }
</style>
```

- [ ] **Step 4: Run tests, expect pass**

```bash
npx vitest run src/lib/components/LocaleSwitcher.test.ts
```

- [ ] **Step 5: Coverage check**

```bash
npm run test:coverage 2>&1 | grep "LocaleSwitcher"
```

Expected: 100% on the new component (the tests exercise both `languageTag === 'fr'` and `=== 'en'` branches).

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/LocaleSwitcher.svelte src/lib/components/LocaleSwitcher.test.ts
git commit -m "Add LocaleSwitcher component with FR/EN toggle"
```

---

## Task 3 — Chrome + dialogs + error + cookies (string extraction)

Extract strings from the public chrome (`PublicHeader`, `PublicFooter`, `LegalLinks`), app chrome (`AppShell`, `BottomNav`), `WelcomeDialog`, `+error.svelte`, and `cookies/+page.svelte`. Mount `LocaleSwitcher` inside `PublicHeader` and `AppShell`. Add new keys to both `messages/fr.json` and `messages/en.json`.

**Files:** all of the above.

- [ ] **Step 1: Read each touched component to inventory its strings**

Open each file. List every user-facing string: aria-labels, button text, link labels, headings, helper text. Skip data-driven strings (e.g. `child.name`).

For each, choose a key under the appropriate namespace (`chrome.publicHeader.*`, `chrome.appShell.*`, `chrome.bottomNav.*`, `dialogs.welcome.*`, `errors.generic.*`, `legal.cookies.*`).

There is no automatic extractor — this is a manual inventory + write the JSON.

- [ ] **Step 2: Add keys to `messages/fr.json` and `messages/en.json`**

Append the inventoried keys to both files. Keep them dot-namespaced and grouped by file. Example structure (the exact keys depend on what the components contain):

```json
{
  "$schema": "https://inlang.com/schema/inlang-message-format",
  "chrome.publicHeader.brand": "Diversif",
  "chrome.publicHeader.navHome": "Accueil",
  "chrome.publicHeader.navSignup": "Créer un compte",
  "chrome.publicHeader.navLogin": "Se connecter",
  "chrome.publicHeader.localeSwitcherLabel": "Choix de la langue",
  "chrome.publicFooter.builtBy": "Diversif est un projet open-source.",
  "chrome.publicFooter.legalLinksLabel": "Mentions légales et confidentialité",
  "chrome.legalLinks.mentionsLegales": "Mentions légales",
  "chrome.legalLinks.politiqueConfidentialite": "Politique de confidentialité",
  "chrome.legalLinks.cookies": "Cookies",
  "chrome.legalLinks.sources": "Sources",
  "chrome.appShell.skipToContent": "Aller au contenu principal",
  "chrome.appShell.brand": "Diversif",
  "chrome.appShell.openMenu": "Ouvrir le menu",
  "chrome.appShell.closeMenu": "Fermer le menu",
  "chrome.appShell.signOut": "Se déconnecter",
  "chrome.bottomNav.dashboard": "Tableau de bord",
  "chrome.bottomNav.log": "Journal",
  "chrome.bottomNav.guide": "Guide",
  "chrome.bottomNav.settings": "Réglages",
  "dialogs.welcome.title": "Bienvenue !",
  "dialogs.welcome.body": "Logguez le premier aliment de bébé pour commencer.",
  "dialogs.welcome.cta": "C'est parti",
  "dialogs.welcome.dismissLabel": "Fermer",
  "errors.generic.title": "Une erreur s'est produite",
  "errors.generic.body": "Un identifiant a été enregistré dans nos journaux pour cette erreur :",
  "errors.generic.cta": "Retourner à l'accueil",
  "legal.cookies.title": "Cookies",
  "legal.cookies.intro": "Diversif n'utilise que les cookies strictement nécessaires :"
}
```

EN values follow the same keys, with English text. Where the brand or a proper noun doesn't translate, copy the FR value verbatim.

- [ ] **Step 3: Replace strings in each component**

For each component, swap inline strings for `m['<key>']()`. Add `import * as m from '$lib/paraglide/messages';` to the `<script>` block.

Example diff for `PublicFooter.svelte`:

```diff
-<p class="text-sm">Diversif est un projet open-source.</p>
+<p class="text-sm">{m['chrome.publicFooter.builtBy']()}</p>
```

- [ ] **Step 4: Mount `LocaleSwitcher` in `PublicHeader.svelte` and `AppShell.svelte`**

In `PublicHeader.svelte`, in the right-hand nav cluster (after the existing nav links, before any close-menu button), add:

```svelte
<LocaleSwitcher />
```

Add the import at the top of `<script>`:

```ts
import LocaleSwitcher from './LocaleSwitcher.svelte';
```

Same in `AppShell.svelte`, mounted somewhere visible in the top bar (next to the sign-out button is fine).

- [ ] **Step 5: Run all tests**

```bash
npm run test 2>&1 | tail -5
```

Expected: all existing tests for these components pass unchanged. The literal-text → `m.X()` swap doesn't change DOM structure or roles, so component tests asserting on `getByRole`, `getByText` (with regex), and structure all keep working. If any test asserts on a literal French string that we renamed, update it to the EN-or-FR variant produced by `languageTag()` in tests (defaults to `fr` in vitest, so the FR string still appears).

- [ ] **Step 6: Coverage**

```bash
npm run test:coverage 2>&1 | grep -E "All files|ERROR" | head -3
```

Expected: 100/100/100/100.

- [ ] **Step 7: Lint + check + build**

```bash
npm run lint && npm run check && npm run build
```

All clean.

- [ ] **Step 8: Commit**

```bash
git add messages/ src/lib/components/PublicHeader.svelte src/lib/components/PublicFooter.svelte src/lib/components/LegalLinks.svelte src/lib/components/AppShell.svelte src/lib/components/BottomNav.svelte src/lib/components/WelcomeDialog.svelte src/routes/+error.svelte src/routes/cookies/+page.svelte
git commit -m "Translate chrome + dialogs + error page; mount LocaleSwitcher"
```

---

## Task 4 — Auth pages with `errorKey` pattern

Translate `login`, `signup`, `account`, `account/deleted`. The harder part: server `actions` currently `return fail(400, { error: 'Identifiants invalides' })` — change to `return fail(400, { errorKey: 'errors.auth.invalidCredentials' })` and have the page render `m[result.form?.errorKey]?.() ?? m['errors.generic.fallback']()`.

**Files:** all auth pages and their `+page.server.ts` files.

- [ ] **Step 1: Add `errors.*` keys to messages**

Append to `messages/fr.json` and `messages/en.json` (with EN translations):

```json
{
  "errors.auth.invalidCredentials": "Identifiants invalides.",
  "errors.auth.userExists": "Un compte existe déjà avec cet email.",
  "errors.auth.weakPassword": "Mot de passe trop faible (minimum 12 caractères).",
  "errors.auth.invalidInvite": "Code d'invitation invalide ou expiré.",
  "errors.auth.rateLimited": "Trop de tentatives. Réessayez plus tard.",
  "errors.auth.unknown": "Une erreur s'est produite. Réessayez.",
  "errors.generic.fallback": "Une erreur s'est produite.",
  "auth.login.title": "Connexion",
  "auth.login.emailLabel": "Adresse email",
  "auth.login.passwordLabel": "Mot de passe",
  "auth.login.submit": "Se connecter",
  "auth.login.passkeyButton": "Se connecter avec une clé d'accès",
  "auth.login.signupCta": "Pas encore de compte ?",
  "auth.login.signupLink": "Créer un compte",
  "auth.signup.title": "Créer un compte",
  "auth.signup.displayNameLabel": "Nom d'usage",
  "auth.signup.emailLabel": "Adresse email",
  "auth.signup.passwordLabel": "Mot de passe (12 caractères minimum)",
  "auth.signup.inviteLabel": "Code d'invitation (optionnel)",
  "auth.signup.tosLabel": "J'accepte les CGU et la politique de confidentialité",
  "auth.signup.submit": "Créer mon compte",
  "auth.signup.loginCta": "Déjà un compte ?",
  "auth.signup.loginLink": "Se connecter",
  "auth.account.title": "Mon compte",
  "auth.account.profileSection": "Profil",
  "auth.account.passwordSection": "Mot de passe",
  "auth.account.passkeySection": "Clés d'accès",
  "auth.account.exportSection": "Exporter mes données",
  "auth.account.deleteSection": "Supprimer mon compte",
  "auth.account.exportButton": "Télécharger mon export (JSON)",
  "auth.account.deleteButton": "Supprimer mon compte définitivement",
  "auth.deleted.title": "Compte supprimé",
  "auth.deleted.body": "Votre compte et toutes les données associées ont été supprimés."
}
```

(Adjust the exact set to match what the existing pages actually render. The above is the expected shape.)

- [ ] **Step 2: Refactor `login/+page.server.ts` (and equivalents)**

Find every `return fail(<status>, { error: '<French string>' })`. Replace with `return fail(<status>, { errorKey: 'errors.auth.<id>' as const })`. Pick the `<id>` to match the situation.

Example:

```diff
- return fail(400, { error: 'Identifiants invalides.' });
+ return fail(400, { errorKey: 'errors.auth.invalidCredentials' });

- return fail(429, { error: 'Trop de tentatives. Réessayez plus tard.' });
+ return fail(429, { errorKey: 'errors.auth.rateLimited' });
```

Keep success-path return shapes unchanged.

- [ ] **Step 3: Refactor `login/+page.svelte` (and equivalents)**

In `<script>`, add:

```ts
import * as m from '$lib/paraglide/messages';
type MessageKey = keyof typeof m;
```

Replace literal labels/placeholders with `m['auth.login.X']()`.

For the form-error render block, replace the existing `{form?.error}` with:

```svelte
{#if form?.errorKey}
  {@const k = form.errorKey as MessageKey}
  <p class="error" role="alert">{m[k]?.() ?? m['errors.generic.fallback']()}</p>
{/if}
```

- [ ] **Step 4: Update existing `login.page.server.test.ts` (and equivalents)**

The tests asserting on literal `error` strings now flip to `errorKey`. Example:

```diff
- expect(result.data?.error).toBe('Identifiants invalides.');
+ expect(result.data?.errorKey).toBe('errors.auth.invalidCredentials');
```

This is mechanical. Find every test that reads `result.data.error` and rewrite the assertion to `errorKey`.

- [ ] **Step 5: Add a fallback test**

In one of the auth `*.page.server.test.ts` files, add:

```ts
it('falls back to errors.generic.fallback when errorKey is missing', () => {
  // Component-level test; render the page with a synthetic form prop
  // having an empty/unknown errorKey, assert the rendered text matches
  // the fallback message.
  // (Adapt to the existing test pattern in this file — likely a
  // component test using @testing-library/svelte.)
});
```

If component-rendering this is awkward in the existing test file, skip this Step 5 — it's covered indirectly by the e2e in Task 7.

- [ ] **Step 6: Run tests, gates**

```bash
npm run test 2>&1 | tail -5
npm run test:coverage 2>&1 | grep -E "All files|ERROR" | head -3
npm run check 2>&1 | tail -3
npm run build 2>&1 | tail -3
```

All clean.

- [ ] **Step 7: Commit**

```bash
git add messages/ src/routes/login src/routes/signup src/routes/account
git commit -m "Translate auth pages; switch form actions to errorKey pattern"
```

---

## Task 5 — Dashboard headings

Translate the dashboard's static UI strings (headings, button labels, badge labels, welcome banner, milestone toast). Loaders' returned data (recent entries, allergen names, reminder bodies) stays as-is.

**Files:** `src/routes/child/[id]/+page.svelte` only.

- [ ] **Step 1: Add dashboard keys**

Append to `messages/fr.json` and `messages/en.json`:

```json
{
  "dashboard.greetingWithName": "Bonjour {name} !",
  "dashboard.recentSection": "Activité récente",
  "dashboard.statsSection": "Statistiques",
  "dashboard.foodsIntroducedLabel": "aliments découverts",
  "dashboard.weekCountLabel": "cette semaine",
  "dashboard.allergensLabel": "allergènes introduits",
  "dashboard.diversitySection": "Diversité",
  "dashboard.streakLabel": "{days, plural, one {# jour de suivi} other {# jours de suivi}}",
  "dashboard.weeklyRecapTitle": "Récapitulatif hebdomadaire",
  "dashboard.coparentActivityTitle": "Activité du co-parent",
  "dashboard.starterFoodsTitle": "Pour commencer",
  "dashboard.logCta": "Logguer un aliment",
  "dashboard.guideCta": "Lire le guide",
  "dashboard.welcomeAgainCta": "Continuer la diversification"
}
```

(Adjust exact set to match what the existing template renders.)

- [ ] **Step 2: Replace strings in `+page.svelte`**

Add to `<script>`:

```ts
import * as m from '$lib/paraglide/messages';
```

Replace headings, button labels, badge labels with `m['dashboard.X']()` calls.

For the streak badge with plural rules:

```svelte
<span>{m['dashboard.streakLabel']({ days: streak })}</span>
```

For the welcome greeting with the child's name:

```svelte
<h2>{m['dashboard.greetingWithName']({ name: child.name })}</h2>
```

- [ ] **Step 3: Update existing `child/[id]/page.server.test.ts`**

If any test asserts on dashboard strings, update them. Most likely the existing tests assert on data shape, not literal strings, so nothing changes.

- [ ] **Step 4: Tests + gates**

```bash
npm run test 2>&1 | tail -5
npm run test:coverage 2>&1 | grep -E "All files|ERROR"
npm run check 2>&1 | tail -3
```

All clean.

- [ ] **Step 5: Commit**

```bash
git add messages/ src/routes/child/[id]/+page.svelte
git commit -m "Translate child dashboard headings and badges"
```

---

## Task 6 — FR-only banners (guide, legal, sources)

For `child/[id]/guide`, `mentions-legales`, `politique-confidentialite`, `sources`: when `languageTag() === 'en'`, render a small banner explaining the page is currently French-only. Wrap the existing content in `<section lang="fr">` so screen readers and translation tools handle it correctly.

**Files:** the 4 routes' `+page.svelte` files; `messages/{fr,en}.json` for the banner keys.

- [ ] **Step 1: Add banner keys**

Append:

```json
{
  "common.frOnlyBanner.guide": "Le guide n'est pour l'instant disponible qu'en français. La traduction nécessite une relecture par un·e expert·e en pédiatrie.",
  "common.frOnlyBannerEn.guide": "The guide is currently only available in French. A translation requires review by a paediatrics expert.",
  "common.frOnlyBanner.legal": "Cette page concerne le droit français et n'est disponible qu'en français.",
  "common.frOnlyBannerEn.legal": "This page concerns French law and is only available in French.",
  "common.frOnlyBanner.sources": "Bibliographie en français.",
  "common.frOnlyBannerEn.sources": "Bibliography in French."
}
```

Wait — the EN value of an FR-only-banner key should be the English text saying "this is in French". So the FR-side `messages/fr.json` has the FR value of the banner ("disponible qu'en français"); the EN-side `messages/en.json` for the same key has the EN value ("only available in French").

Re-read: ONE key per banner. Its FR value is what FR users would see (which is "no banner needed" — but we still render the banner unconditionally? No — the banner is gated on `languageTag() === 'en'`). So the FR value of the banner key is only ever read if someone misuses the key.

Cleanest: the banner is shown only when `languageTag === 'en'`, so we only need the EN string. But messages/fr.json must still have the key (paraglide insists on full coverage). Set the FR value to the English text (or to a "[fr placeholder]") — it never renders.

Even cleaner: define the FR value as **the FR equivalent of what the banner says**, as a documentation gesture, but the banner is wrapped in `{#if languageTag() === 'en'}` so the FR value is unread.

Resolved messages:

`messages/fr.json` additions:

```json
{
  "common.frOnlyBanner.guide": "Le guide n'est pour l'instant disponible qu'en français.",
  "common.frOnlyBanner.legal": "Cette page concerne le droit français et n'est disponible qu'en français.",
  "common.frOnlyBanner.sources": "Bibliographie en français."
}
```

`messages/en.json` additions:

```json
{
  "common.frOnlyBanner.guide": "The guide is currently only available in French. A translation requires review by a paediatrics expert.",
  "common.frOnlyBanner.legal": "This page concerns French law and is only available in French.",
  "common.frOnlyBanner.sources": "Bibliography in French."
}
```

- [ ] **Step 2: Add the banner to each page**

Pattern (apply to `child/[id]/guide/+page.svelte`):

```svelte
<script lang="ts">
  import { languageTag } from '$lib/paraglide/runtime';
  import * as m from '$lib/paraglide/messages';
  // ... existing imports
</script>

<!-- existing page content -->

{#if languageTag() === 'en'}
  <aside class="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
    {m['common.frOnlyBanner.guide']()}
  </aside>
{/if}

<section lang="fr">
  <!-- the existing French content goes inside this wrapper -->
</section>
```

Apply analogously to `mentions-legales/+page.svelte` (key `common.frOnlyBanner.legal`), `politique-confidentialite/+page.svelte` (same `legal` key — both use it), and `sources/+page.svelte` (`common.frOnlyBanner.sources`).

- [ ] **Step 3: Tests + gates**

```bash
npm run test 2>&1 | tail -5
npm run test:coverage 2>&1 | grep -E "All files|ERROR"
npm run check 2>&1 | tail -3
```

Existing tests assert page structure; the added `<aside>` + `<section>` shouldn't break them, but if any test asserts on direct child of the page wrapper, update.

- [ ] **Step 4: Commit**

```bash
git add messages/ src/routes/child/[id]/guide src/routes/mentions-legales src/routes/politique-confidentialite src/routes/sources
git commit -m "Add FR-only banners to guide, legal, sources pages"
```

---

## Task 7 — SEO alternateLocales + sitemap + e2e smoke

Three small changes wrapping up the slice.

**Files:**

- `src/lib/components/Seo.svelte` (add `alternateLocales` prop)
- The translated routes' page files (opt into the prop where appropriate)
- `src/routes/sitemap.xml/+server.ts` (emit `/en/...` for translated routes)
- `tests/i18n.spec.ts` (Playwright smoke)

- [ ] **Step 1: Add `alternateLocales` prop to `Seo.svelte`**

Read `src/lib/components/Seo.svelte`. Add a new prop:

```ts
let { ..., alternateLocales = [] }: { ...; alternateLocales?: string[] } = $props();
```

In the SSR `<svelte:head>` content, after the existing canonical link, emit the alternate hreflang tags:

```svelte
{#if alternateLocales.length > 0}
  <link rel="alternate" hreflang="fr" href={absoluteUrl(path)} />
  {#each alternateLocales as locale}
    <link rel="alternate" hreflang={locale} href={absoluteUrl(`/${locale}${path}`)} />
  {/each}
  <link rel="alternate" hreflang="x-default" href={absoluteUrl(path)} />
{/if}
```

(`absoluteUrl` is the existing helper used for canonical; if it has a different name, use whatever the existing canonical line uses.)

- [ ] **Step 2: Opt translated pages into `alternateLocales`**

For `login/+page.svelte`, `signup/+page.svelte`, `account/+page.svelte`, `account/deleted/+page.svelte`, `cookies/+page.svelte`, dashboard, and the public landing page: add `alternateLocales={['en']}` to the `<Seo ... />` invocation.

For `mentions-legales`, `politique-confidentialite`, `sources`, `guide`: do NOT add `alternateLocales`. Those pages are FR-only and signalling EN availability would be a false claim to crawlers.

- [ ] **Step 3: Update `sitemap.xml/+server.ts`**

Read the current sitemap. It enumerates the public routes with their `lastmod`. For each entry that's a translated route, emit a second `<url>` block with `<loc>` = `/en/<path>`.

Concrete diff: where the current code has something like:

```ts
const entries = [
  { path: '/', lastmod: ... },
  { path: '/login', lastmod: ... },
  // ...
];
```

Add a list of translated routes:

```ts
const translated = new Set(['/', '/login', '/signup', '/cookies']);
```

When emitting `<url>` for a path, if `translated.has(path)`, emit a second `<url>` with `/en${path}` (or `/en/` for root).

- [ ] **Step 4: Update sitemap test**

The existing `sitemap.xml/server.test.ts` asserts the emitted XML contains expected paths. Add assertions for the new EN paths and the absence of EN paths for `/mentions-legales` (etc.).

- [ ] **Step 5: Write the e2e smoke**

Create `tests/i18n.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test.describe('i18n smoke', () => {
  test('FR is default, EN switcher flips lang attribute and copy', async ({ page }) => {
    await page.goto('/');

    // Default locale renders fr
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');

    // Switcher exists; EN link goes to /en/
    const enLink = page.getByRole('link', { name: /^en$/i }).first();
    await expect(enLink).toBeVisible();
    await expect(enLink).toHaveAttribute('href', '/en/');

    await enLink.click();
    await expect(page).toHaveURL(/\/en\/?$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });

  test('FR-only banner appears on /en/mentions-legales', async ({ page }) => {
    await page.goto('/en/mentions-legales');
    // The page itself should show a banner saying it's FR-only.
    await expect(page.locator('aside')).toContainText(/only available in French|french law/i);
  });
});
```

- [ ] **Step 6: Run all gates including e2e**

```bash
npm run test 2>&1 | tail -3
npm run test:coverage 2>&1 | grep -E "All files|ERROR"
npm run check 2>&1 | tail -3
npm run build 2>&1 | tail -3
npx playwright test tests/i18n.spec.ts 2>&1 | tail -10
```

All clean. The e2e may need `npm run test:e2e:install` first if Playwright browsers aren't installed.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/Seo.svelte src/routes/login src/routes/signup src/routes/account src/routes/cookies src/routes/child/[id]/+page.svelte src/routes/+page.svelte src/routes/sitemap.xml tests/i18n.spec.ts
git commit -m "Add hreflang to translated pages, EN sitemap entries, i18n e2e smoke"
```

---

## Final verification

After Task 7:

```bash
npm run lint && npm run check && npm run test:coverage && npm run build
npx playwright test 2>&1 | tail -10
```

All clean. If anything fails, fix forward in the relevant prior task — do NOT push to main with a red gate.

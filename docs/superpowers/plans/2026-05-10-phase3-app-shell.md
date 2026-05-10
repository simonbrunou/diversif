# Phase 3: App Shell + FAB Log Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Every implementer subagent prompt MUST start with a `cd <worktree>` guard** — see [feedback memory](file:///home/sbrn/.claude/projects/-home-sbrn-Projects-diversif/memory/feedback_subagent_cwd_guard.md). Without it, ~⅔ of subagents commit to the wrong branch.

**Goal:** Replace the current top-level chrome with the bento app shell — a 4-tab bottom bar (Aujourd'hui · Carnet · Découvrir · Profil) with a center FAB that opens a `Sheet` for logging, a multi-child header pill above the page content, and a left-rail variant for desktop. Routes stay where they are (`/child/[id]`, `/child/[id]/foods`, etc.); the new shell just rewires how users navigate between them. The existing `/child/[id]/log` form action is reused — the FAB Sheet POSTs to it, then closes.

**Architecture:** New shell ships behind a per-user feature flag (`bento_redesign_enabled`). The legacy `AppShell.svelte` + `BottomNav.svelte` stay in place for opted-out users; the new components live alongside as `AppShellBento.svelte` + `BottomNavBento.svelte`, selected by a conditional in `src/routes/+layout.svelte`. No DB schema changes; the flag is computed from a hardcoded allow-list of user emails (the owner only, for now) and a cookie override for QA.

**Tech Stack:** SvelteKit 2 · Svelte 5 (runes) · TailwindCSS 3 with bento tokens (already shipped) · bits-ui v2 (already shipped) · primitives Sheet / Drawer / Tabs / Command / ReactionPicker (already shipped) · Vitest + happy-dom + @testing-library/svelte · Playwright.

**Spec reference:** `docs/superpowers/specs/2026-05-10-ui-ux-redesign-design.md` — sections "Information architecture", "Aujourd'hui (home)", "Log sheet (FAB)", "Responsive strategy", and migration phase 3.

**Foundation reference:** Phase 1 + 2 just merged in [PR #86](https://github.com/simonbrunou/diversif/pull/86) — tokens, brand, 22 primitives.

---

## File Structure

### Created (new files)

| Path                                             | Purpose                                                                                                                                                                                                                      |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/feature-flags.ts`                       | `bentoEnabled(userEmail, cookies)` — checks an allow-list of opted-in emails plus a `bento=1` cookie override for QA.                                                                                                        |
| `src/lib/feature-flags.test.ts`                  | Allow-list, cookie override, defaults-off behaviour.                                                                                                                                                                         |
| `src/lib/components/AppShellBento.svelte`        | New shell. Wraps `<slot/>` with a multi-child header pill, the page content, and (mobile) the new bottom nav + FAB cutout, or (desktop) the left rail.                                                                       |
| `src/lib/components/AppShellBento.test.ts`       | Renders kids when not authed, renders chrome when authed, switches mobile/desktop layout via a class hook (we don't simulate viewport — assert on `data-variant` attr).                                                      |
| `src/lib/components/BottomNavBento.svelte`       | 4 tabs + FAB cutout. The FAB itself is rendered separately by `AppShellBento` so it can sit centered atop the nav.                                                                                                           |
| `src/lib/components/BottomNavBento.test.ts`      | Tab labels render, active tab matches current pathname, ARIA `aria-current="page"` on active.                                                                                                                                |
| `src/lib/components/FabLog.svelte`               | The sage circle button (60×60) with `+`, `aria-label="Logger un aliment"`. Calls a passed `onclick` prop.                                                                                                                    |
| `src/lib/components/FabLog.test.ts`              | Renders, fires onclick, has the right ARIA label.                                                                                                                                                                            |
| `src/lib/components/ChildHeaderPill.svelte`      | Avatar + name + age + "changer ▾". Tap opens the `ChildSwitcherDrawer`.                                                                                                                                                      |
| `src/lib/components/ChildHeaderPill.test.ts`     | Renders child name + age, fires open event.                                                                                                                                                                                  |
| `src/lib/components/ChildSwitcherDrawer.svelte`  | `Drawer` (right side, mobile-friendly) listing all the user's children + "Ajouter un enfant" row. Selecting a child navigates to `/child/<id>`.                                                                              |
| `src/lib/components/ChildSwitcherDrawer.test.ts` | Lists children, fires select event with new id, "Add" link points to `/child/new`.                                                                                                                                           |
| `src/lib/components/LogSheet.svelte`             | The bento Sheet that opens from the FAB. Wraps `Command` for food search + `ReactionPicker` + a `<form method="POST" action="/child/<currentChildId>/log?/log">` that closes the sheet on success via SvelteKit's `enhance`. |
| `src/lib/components/LogSheet.test.ts`            | Renders Command + ReactionPicker, hides when not open, submits to the right action URL.                                                                                                                                      |
| `src/routes/(bento)/+layout.svelte`              | Wraps the AppShellBento around all child routes that should use the new shell. (Optional — if the conditional in `+layout.svelte` is sufficient, skip this directory.)                                                       |
| `tests/e2e/bento-shell.spec.ts`                  | Playwright: tab navigation, FAB → log → save, multi-child switch, mobile + desktop layouts.                                                                                                                                  |

### Modified

| Path                            | Change                                                                                                                                                                                                                                                                                                                    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/+layout.svelte`     | Conditional: render `AppShellBento` if `bentoEnabled` for the current user, else legacy `AppShell`.                                                                                                                                                                                                                       |
| `src/routes/+layout.server.ts`  | Load `bentoEnabled` flag from `feature-flags.ts` and pass it on `data`.                                                                                                                                                                                                                                                   |
| `messages/fr.json`              | Add `chrome.tabs.aujourdhui`, `chrome.tabs.carnet`, `chrome.tabs.decouvrir`, `chrome.tabs.profil`, `chrome.fab.log`, `chrome.header.changeChild`, `chrome.childSwitcher.add`, `chrome.childSwitcher.title`, `chrome.logSheet.title`, `chrome.logSheet.placeholder`, `chrome.logSheet.save`, `chrome.logSheet.savedToast`. |
| `messages/en.json`              | Same keys, English translations.                                                                                                                                                                                                                                                                                          |
| `src/lib/components/Seo.svelte` | If a tab name is the current page, add `chrome.tabs.<name>()` to the title. (Tiny.)                                                                                                                                                                                                                                       |

### Untouched (deliberately)

- `/child/[id]/log/+page.server.ts` — the POST form action stays as-is. The FAB Sheet posts here.
- `/child/[id]/log/+page.svelte` — the GET still works for direct deep links; we add a small redirect to home with `?log=open` so the flow stays consistent. Optional fallback only.
- All loaders for the per-tab routes (`/child/[id]/+page.server.ts`, `/foods/+page.server.ts`, etc.) — the shell only changes navigation chrome, not page content.
- `src/lib/components/AppShell.svelte` + `BottomNav.svelte` — kept as legacy for opted-out users until Phase 7 cleanup.

---

## Conventions

- Working directory: subagents must `cd` to the assigned worktree path before any Bash command. See feedback memory.
- Commit cadence: one commit per task. Conventional Commits: `feat(shell): ...`, `feat(i18n): ...`, `feat(flags): ...`, `test(e2e): ...`.
- Tests: keep using project's `textSnippet` helper from `src/test/component.ts`. New components get unit tests + at least one e2e at the end.
- Feature flag: `bentoEnabled` returns `false` by default. Only the owner's email and `bento=1` cookie unlock it during phase 3.
- Routing: tab clicks navigate to existing routes (`/child/[id]`, `/foods`, `/guide`, etc.). The active tab is computed from `$page.url.pathname`.
- i18n: all chrome strings come from paraglide messages. No hardcoded French/English in components.
- Accessibility: tab bar uses `role="navigation"` + `aria-label`. Active tab has `aria-current="page"`. FAB has explicit `aria-label`. Sheet has `role="dialog"` (provided by bits-ui).

---

## Task 1: Feature flag scaffold

**Files:**

- Create: `src/lib/feature-flags.ts`
- Create: `src/lib/feature-flags.test.ts`

- [ ] **Step 1.1: Write the test (failing)**

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { bentoEnabled } from './feature-flags';

describe('bentoEnabled', () => {
  const owner = 'simon.brunou@proton.me';
  const otherUser = 'someone@example.com';

  it('returns false by default for non-owner', () => {
    expect(bentoEnabled(otherUser, new Map())).toBe(false);
  });

  it('returns true for the owner email', () => {
    expect(bentoEnabled(owner, new Map())).toBe(true);
  });

  it('returns true when the bento=1 cookie is set, regardless of email', () => {
    expect(bentoEnabled(otherUser, new Map([['bento', '1']]))).toBe(true);
  });

  it('returns false when bento cookie is anything other than "1"', () => {
    expect(bentoEnabled(otherUser, new Map([['bento', '0']]))).toBe(false);
    expect(bentoEnabled(otherUser, new Map([['bento', 'true']]))).toBe(false);
  });

  it('handles undefined email gracefully (anonymous visitor)', () => {
    expect(bentoEnabled(undefined, new Map())).toBe(false);
    expect(bentoEnabled(undefined, new Map([['bento', '1']]))).toBe(true);
  });
});
```

- [ ] **Step 1.2: Run (expect FAIL)**

```
cd <worktree> && npm test -- src/lib/feature-flags.test.ts
```

- [ ] **Step 1.3: Implement feature-flags.ts**

```ts
const BENTO_ALLOW_LIST = new Set<string>(['simon.brunou@proton.me']);

export function bentoEnabled(
  userEmail: string | undefined,
  cookies: Map<string, string> | { get(name: string): string | undefined }
): boolean {
  const cookieGet = (name: string): string | undefined =>
    cookies instanceof Map ? cookies.get(name) : cookies.get(name);

  if (cookieGet('bento') === '1') return true;
  if (!userEmail) return false;
  return BENTO_ALLOW_LIST.has(userEmail.toLowerCase());
}
```

- [ ] **Step 1.4: Run (expect PASS), commit**

```
cd <worktree> && npm test -- src/lib/feature-flags.test.ts
git add src/lib/feature-flags.ts src/lib/feature-flags.test.ts
git commit -m "feat(flags): bentoEnabled — owner allow-list + bento=1 cookie override"
```

---

## Task 2: i18n keys for chrome

**Files:**

- Modify: `messages/fr.json`, `messages/en.json`

- [ ] **Step 2.1: Add the FR keys**

Add to `messages/fr.json` (top-level keys; respect existing alphabetical/logical ordering):

```json
"chrome.tabs.aujourdhui": "Aujourd'hui",
"chrome.tabs.carnet": "Carnet",
"chrome.tabs.decouvrir": "Découvrir",
"chrome.tabs.profil": "Profil",
"chrome.fab.log": "Logger un aliment",
"chrome.header.changeChild": "changer",
"chrome.childSwitcher.title": "Vos enfants",
"chrome.childSwitcher.add": "Ajouter un enfant",
"chrome.logSheet.title": "Que mange {name} ?",
"chrome.logSheet.placeholder": "🔍 chercher un aliment…",
"chrome.logSheet.save": "Enregistrer",
"chrome.logSheet.savedToast": "Enregistré"
```

- [ ] **Step 2.2: Add the EN keys**

Add to `messages/en.json` with English translations:

```json
"chrome.tabs.aujourdhui": "Today",
"chrome.tabs.carnet": "Log",
"chrome.tabs.decouvrir": "Discover",
"chrome.tabs.profil": "Profile",
"chrome.fab.log": "Log a food",
"chrome.header.changeChild": "switch",
"chrome.childSwitcher.title": "Your children",
"chrome.childSwitcher.add": "Add a child",
"chrome.logSheet.title": "What is {name} eating?",
"chrome.logSheet.placeholder": "🔍 search a food…",
"chrome.logSheet.save": "Save",
"chrome.logSheet.savedToast": "Saved"
```

- [ ] **Step 2.3: Recompile paraglide + commit**

```
cd <worktree> && npm run paraglide && npm run lint && \
  git add messages/fr.json messages/en.json && \
  git commit -m "feat(i18n): chrome keys for tabs, FAB, child switcher, log sheet"
```

---

## Task 3: FabLog component

**Files:**

- Create: `src/lib/components/FabLog.svelte`
- Create: `src/lib/components/FabLog.test.ts`

- [ ] **Step 3.1: Write the test**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/svelte';
import FabLog from './FabLog.svelte';

afterEach(() => cleanup());

describe('FabLog', () => {
  it('renders a button with the expected aria-label', () => {
    render(FabLog, { props: { onclick: () => {} } });
    expect(screen.getByRole('button').getAttribute('aria-label')).toBe('Logger un aliment');
  });

  it('fires onclick when pressed', async () => {
    const onclick = vi.fn();
    render(FabLog, { props: { onclick } });
    await fireEvent.click(screen.getByRole('button'));
    expect(onclick).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3.2: Implement**

```svelte
<script lang="ts">
  import { Plus } from 'lucide-svelte';
  import * as m from '$lib/paraglide/messages';
  import { cn } from '$lib/utils/cn';

  let {
    onclick,
    class: className = ''
  }: {
    onclick: () => void;
    class?: string;
  } = $props();
</script>

<button
  type="button"
  {onclick}
  aria-label={m['chrome.fab.log']()}
  class={cn(
    'flex h-15 w-15 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-soft transition-transform duration-base ease-spring hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    className
  )}
  style="height: 60px; width: 60px;"
>
  <Plus size={28} aria-hidden="true" />
</button>
```

- [ ] **Step 3.3: Run + commit**

```
cd <worktree> && npm test -- src/lib/components/FabLog.test.ts && \
  git add src/lib/components/FabLog.svelte src/lib/components/FabLog.test.ts && \
  git commit -m "feat(shell): FabLog — sage 60x60 FAB for log sheet"
```

---

## Task 4: BottomNavBento component

**Files:**

- Create: `src/lib/components/BottomNavBento.svelte`
- Create: `src/lib/components/BottomNavBento.test.ts`

- [ ] **Step 4.1: Write the test**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import BottomNavBento from './BottomNavBento.svelte';

afterEach(() => cleanup());

describe('BottomNavBento', () => {
  function makeProps(currentPath: string) {
    return { currentChildId: 'abc', currentPath };
  }

  it('renders all four tab labels', () => {
    render(BottomNavBento, { props: makeProps('/child/abc') });
    expect(screen.getByText("Aujourd'hui")).toBeTruthy();
    expect(screen.getByText('Carnet')).toBeTruthy();
    expect(screen.getByText('Découvrir')).toBeTruthy();
    expect(screen.getByText('Profil')).toBeTruthy();
  });

  it("marks Aujourd'hui active when on /child/[id]", () => {
    render(BottomNavBento, { props: makeProps('/child/abc') });
    const aujourdhui = screen.getByText("Aujourd'hui").closest('a')!;
    expect(aujourdhui.getAttribute('aria-current')).toBe('page');
  });

  it('marks Carnet active when on /child/[id]/foods', () => {
    render(BottomNavBento, { props: makeProps('/child/abc/foods') });
    const carnet = screen.getByText('Carnet').closest('a')!;
    expect(carnet.getAttribute('aria-current')).toBe('page');
  });

  it('marks Découvrir active when on /child/[id]/guide', () => {
    render(BottomNavBento, { props: makeProps('/child/abc/guide') });
    expect(screen.getByText('Découvrir').closest('a')!.getAttribute('aria-current')).toBe('page');
  });

  it('marks Profil active when on /account', () => {
    render(BottomNavBento, { props: makeProps('/account') });
    expect(screen.getByText('Profil').closest('a')!.getAttribute('aria-current')).toBe('page');
  });
});
```

- [ ] **Step 4.2: Implement**

```svelte
<script lang="ts" module>
  import { Calendar, BookText, Sparkles, User } from 'lucide-svelte';

  type Tab = {
    href: (childId: string) => string;
    labelKey: 'chrome.tabs.aujourdhui' | 'chrome.tabs.carnet' | 'chrome.tabs.decouvrir' | 'chrome.tabs.profil';
    matcher: (path: string) => boolean;
    icon: typeof Calendar;
  };

  export const TABS: Tab[] = [
    {
      href: (id) => `/child/${id}`,
      labelKey: 'chrome.tabs.aujourdhui',
      matcher: (p) => /^\/child\/[^/]+$/.test(p),
      icon: Calendar
    },
    {
      href: (id) => `/child/${id}/foods`,
      labelKey: 'chrome.tabs.carnet',
      matcher: (p) => /^\/child\/[^/]+\/(foods|allergens|analytics)/.test(p),
      icon: BookText
    },
    {
      href: (id) => `/child/${id}/guide`,
      labelKey: 'chrome.tabs.decouvrir',
      matcher: (p) => /^\/child\/[^/]+\/(guide|suggestions)/.test(p) || p === '/sources',
      icon: Sparkles
    },
    {
      href: () => `/account`,
      labelKey: 'chrome.tabs.profil',
      matcher: (p) =>
        p.startsWith('/account') ||
        p.startsWith('/passkeys') ||
        p === '/cgu' ||
        p === '/mentions-legales' ||
        p === '/politique-confidentialite' ||
        p === '/cookies',
      icon: User
    }
  ];
</script>

<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { cn } from '$lib/utils/cn';

  let {
    currentChildId,
    currentPath
  }: { currentChildId: string; currentPath: string } = $props();
</script>

<nav
  aria-label="Navigation principale"
  class="fixed bottom-3 left-3 right-3 z-30 flex h-14 items-center rounded-full border border-border/40 bg-surface/95 px-2 shadow-soft backdrop-blur"
>
  {#each TABS as tab, i (tab.labelKey)}
    {@const active = tab.matcher(currentPath)}
    <a
      href={tab.href(currentChildId)}
      aria-current={active ? 'page' : undefined}
      class={cn(
        'flex flex-1 flex-col items-center gap-0.5 text-[10px] font-medium transition-colors duration-base ease-soft',
        active ? 'text-primary' : 'text-ink-soft hover:text-foreground'
      )}
    >
      <svelte:component this={tab.icon} size={18} aria-hidden="true" />
      {m[tab.labelKey]()}
    </a>
    {#if i === 1}
      <!-- spacer for FAB -->
      <div class="w-16" aria-hidden="true"></div>
    {/if}
  {/each}
</nav>
```

- [ ] **Step 4.3: Run + commit**

```
cd <worktree> && npm test -- src/lib/components/BottomNavBento.test.ts && \
  git add src/lib/components/BottomNavBento.svelte src/lib/components/BottomNavBento.test.ts && \
  git commit -m "feat(shell): BottomNavBento — 4 tabs with FAB cutout, aria-current on active"
```

---

## Task 5: ChildHeaderPill component

**Files:**

- Create: `src/lib/components/ChildHeaderPill.svelte`
- Create: `src/lib/components/ChildHeaderPill.test.ts`

- [ ] **Step 5.1: Write the test**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/svelte';
import ChildHeaderPill from './ChildHeaderPill.svelte';

afterEach(() => cleanup());

describe('ChildHeaderPill', () => {
  const child = { id: 'abc', name: 'Léo', birthMonth: '2025-11-01', avatarSeed: '🌱' };

  it('renders the child name', () => {
    render(ChildHeaderPill, { props: { child, onSwitch: () => {} } });
    expect(screen.getByText('Léo')).toBeTruthy();
  });

  it('fires onSwitch when the chevron is tapped', async () => {
    const onSwitch = vi.fn();
    render(ChildHeaderPill, { props: { child, onSwitch } });
    await fireEvent.click(screen.getByRole('button'));
    expect(onSwitch).toHaveBeenCalled();
  });
});
```

- [ ] **Step 5.2: Implement**

```svelte
<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { ChevronDown } from 'lucide-svelte';
  import { formatMonthsSince } from '$lib/utils/dates';

  type Child = {
    id: string;
    name: string;
    birthMonth: string;
    avatarSeed: string;
  };

  let {
    child,
    onSwitch
  }: { child: Child; onSwitch: () => void } = $props();

  const ageLabel = $derived(formatMonthsSince(child.birthMonth));
</script>

<button
  type="button"
  onclick={onSwitch}
  class="mx-auto mb-3 flex w-full max-w-md items-center gap-3 rounded-tile border border-border/60 bg-canvas px-3 py-2 text-left transition-colors duration-base ease-soft hover:bg-surface-2"
>
  <span
    class="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-tile-peach to-tile-butter text-base"
    aria-hidden="true"
  >
    {child.avatarSeed}
  </span>
  <span class="flex flex-col">
    <span class="text-sm font-bold leading-tight">{child.name}</span>
    <span class="text-xs text-ink-soft">{ageLabel}</span>
  </span>
  <span class="ml-auto flex items-center gap-1 text-xs text-primary">
    {m['chrome.header.changeChild']()}
    <ChevronDown size={14} aria-hidden="true" />
  </span>
</button>
```

The implementer should verify `formatMonthsSince` exists at `src/lib/utils/dates.ts`. If not, use a stub that returns `'6 mois · J+184'`-style strings — the test mocks anyway.

- [ ] **Step 5.3: Run + commit**

```
cd <worktree> && npm test -- src/lib/components/ChildHeaderPill.test.ts && \
  git add src/lib/components/ChildHeaderPill.svelte src/lib/components/ChildHeaderPill.test.ts && \
  git commit -m "feat(shell): ChildHeaderPill — avatar + name + age + switch chevron"
```

---

## Task 6: ChildSwitcherDrawer

**Files:**

- Create: `src/lib/components/ChildSwitcherDrawer.svelte`
- Create: `src/lib/components/ChildSwitcherDrawer.test.ts`

- [ ] **Step 6.1: Write the test**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import ChildSwitcherDrawer from './ChildSwitcherDrawer.svelte';

afterEach(() => cleanup());

describe('ChildSwitcherDrawer', () => {
  const children = [
    { id: 'a', name: 'Léo', birthMonth: '2025-11-01', avatarSeed: '🌱' },
    { id: 'b', name: 'Mia', birthMonth: '2024-04-01', avatarSeed: '🐝' }
  ];

  it('renders child names when open', () => {
    render(ChildSwitcherDrawer, {
      props: { open: true, children, currentChildId: 'a' }
    });
    expect(screen.getByText('Léo')).toBeTruthy();
    expect(screen.getByText('Mia')).toBeTruthy();
  });

  it('renders an Add child link when open', () => {
    render(ChildSwitcherDrawer, {
      props: { open: true, children, currentChildId: 'a' }
    });
    const add = screen.getByText(/Ajouter/);
    expect(add.closest('a')!.getAttribute('href')).toBe('/child/new');
  });

  it('hides everything when not open', () => {
    render(ChildSwitcherDrawer, {
      props: { open: false, children, currentChildId: 'a' }
    });
    expect(screen.queryByText('Léo')).toBeNull();
  });
});
```

- [ ] **Step 6.2: Implement**

```svelte
<script lang="ts">
  import Drawer from './ui/Drawer.svelte';
  import * as m from '$lib/paraglide/messages';
  import { Plus, Check } from 'lucide-svelte';

  type Child = { id: string; name: string; birthMonth: string; avatarSeed: string };

  let {
    open = $bindable(false),
    children,
    currentChildId
  }: { open: boolean; children: Child[]; currentChildId: string } = $props();
</script>

<Drawer bind:open side="right">
  <h2 class="text-xs font-semibold uppercase tracking-wider text-ink-soft">
    {m['chrome.childSwitcher.title']()}
  </h2>
  <ul class="mt-3 flex flex-col gap-2">
    {#each children as child (child.id)}
      <li>
        <a
          href={`/child/${child.id}`}
          class="flex items-center gap-3 rounded-tile border border-border/60 bg-canvas px-3 py-2 hover:bg-surface-2"
          aria-current={child.id === currentChildId ? 'page' : undefined}
          onclick={() => (open = false)}
        >
          <span class="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-tile-peach to-tile-butter">
            {child.avatarSeed}
          </span>
          <span class="flex-1 font-bold">{child.name}</span>
          {#if child.id === currentChildId}
            <Check size={16} class="text-primary" aria-hidden="true" />
          {/if}
        </a>
      </li>
    {/each}
    <li>
      <a
        href="/child/new"
        class="flex items-center gap-3 rounded-tile border border-dashed border-border bg-canvas px-3 py-2 text-ink-soft hover:bg-surface-2"
        onclick={() => (open = false)}
      >
        <span class="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2">
          <Plus size={16} aria-hidden="true" />
        </span>
        <span class="font-semibold">{m['chrome.childSwitcher.add']()}</span>
      </a>
    </li>
  </ul>
</Drawer>
```

- [ ] **Step 6.3: Run + commit**

```
cd <worktree> && npm test -- src/lib/components/ChildSwitcherDrawer.test.ts && \
  git add src/lib/components/ChildSwitcherDrawer.svelte src/lib/components/ChildSwitcherDrawer.test.ts && \
  git commit -m "feat(shell): ChildSwitcherDrawer — bento drawer for multi-child switching"
```

---

## Task 7: LogSheet component

**Files:**

- Create: `src/lib/components/LogSheet.svelte`
- Create: `src/lib/components/LogSheet.test.ts`

- [ ] **Step 7.1: Write the test**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import LogSheet from './LogSheet.svelte';

afterEach(() => cleanup());

describe('LogSheet', () => {
  const props = {
    open: true,
    childId: 'abc',
    childName: 'Léo',
    foods: [
      { id: 'pear', label: 'Poire' },
      { id: 'banana', label: 'Banane' }
    ]
  };

  it('renders the title with the child name when open', () => {
    render(LogSheet, { props });
    expect(screen.getByText(/Léo/)).toBeTruthy();
  });

  it('renders the food list', () => {
    render(LogSheet, { props });
    expect(screen.getByText('Poire')).toBeTruthy();
    expect(screen.getByText('Banane')).toBeTruthy();
  });

  it('hides when not open', () => {
    render(LogSheet, { props: { ...props, open: false } });
    expect(screen.queryByText('Poire')).toBeNull();
  });

  it('exposes a form posting to /child/{id}/log', () => {
    const { container } = render(LogSheet, { props });
    const form = document.querySelector('form');
    expect(form).not.toBeNull();
    expect(form!.getAttribute('action')).toMatch(/\/child\/abc\/log/);
    expect(form!.getAttribute('method')).toMatch(/post/i);
  });
});
```

- [ ] **Step 7.2: Implement**

```svelte
<script lang="ts">
  import Sheet from './ui/Sheet.svelte';
  import Command, { type CommandItem } from './ui/Command.svelte';
  import ReactionPicker from './ReactionPicker.svelte';
  import * as m from '$lib/paraglide/messages';
  import { enhance } from '$app/forms';
  import { toast } from './ui/Toast.svelte';

  let {
    open = $bindable(false),
    childId,
    childName,
    foods
  }: {
    open: boolean;
    childId: string;
    childName: string;
    foods: { id: string; label: string }[];
  } = $props();

  let selectedFood = $state('');
  let reaction = $state<'ras' | 'inconfort' | 'reaction'>('ras');

  const items: CommandItem[] = $derived(
    foods.map((f) => ({ value: f.id, label: f.label }))
  );
</script>

<Sheet bind:open title={m['chrome.logSheet.title']({ name: childName })} side="bottom">
  <form
    method="POST"
    action={`/child/${childId}/log?/log`}
    use:enhance={() => {
      return async ({ result, update }) => {
        if (result.type === 'success' || result.type === 'redirect') {
          toast.success(m['chrome.logSheet.savedToast']());
          open = false;
          selectedFood = '';
          reaction = 'ras';
        }
        await update();
      };
    }}
    class="flex flex-col gap-3"
  >
    <Command
      {items}
      bind:value={selectedFood}
      placeholder={m['chrome.logSheet.placeholder']()}
    />
    <input type="hidden" name="foodId" value={selectedFood} />
    <ReactionPicker bind:value={reaction} />
    <input type="hidden" name="reaction" value={reaction} />
    <button
      type="submit"
      disabled={!selectedFood}
      class="mt-2 w-full rounded-tile bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-soft transition-colors duration-base ease-soft disabled:opacity-50"
    >
      {m['chrome.logSheet.save']()}
    </button>
  </form>
</Sheet>
```

The exact prop API of `ReactionPicker` may differ from `bind:value` — implementer should check `src/lib/components/ReactionPicker.svelte` and adapt. Same for the form action's expected `name="foodId"` / `name="reaction"` field names — match what `/child/[id]/log/+page.server.ts` reads from `formData`.

- [ ] **Step 7.3: Run + commit**

```
cd <worktree> && npm test -- src/lib/components/LogSheet.test.ts && \
  git add src/lib/components/LogSheet.svelte src/lib/components/LogSheet.test.ts && \
  git commit -m "feat(shell): LogSheet — bento sheet wrapping Command + ReactionPicker, posts to /log"
```

---

## Task 8: AppShellBento

**Files:**

- Create: `src/lib/components/AppShellBento.svelte`
- Create: `src/lib/components/AppShellBento.test.ts`

- [ ] **Step 8.1: Write the test**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import AppShellBento from './AppShellBento.svelte';

afterEach(() => cleanup());

const text = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

describe('AppShellBento', () => {
  const baseProps = {
    user: { email: 'simon.brunou@proton.me' },
    children: [{ id: 'a', name: 'Léo', birthMonth: '2025-11-01', avatarSeed: '🌱' }],
    currentChildId: 'a',
    currentPath: '/child/a',
    foods: [{ id: 'pear', label: 'Poire' }],
    children: text('PAGE')
  };

  it('renders the page content', () => {
    render(AppShellBento, { props: baseProps });
    expect(screen.getByText('PAGE')).toBeTruthy();
  });

  it('renders the bottom nav when in a child route', () => {
    render(AppShellBento, { props: baseProps });
    expect(screen.getByLabelText('Navigation principale')).toBeTruthy();
  });

  it('renders the FAB with the right aria-label', () => {
    render(AppShellBento, { props: baseProps });
    expect(screen.getByLabelText('Logger un aliment')).toBeTruthy();
  });

  it('renders the child header pill with the current child name', () => {
    render(AppShellBento, { props: baseProps });
    expect(screen.getByText('Léo')).toBeTruthy();
  });

  it('does not render the FAB or tab bar on auth/landing routes', () => {
    render(AppShellBento, {
      props: { ...baseProps, currentPath: '/login', currentChildId: undefined }
    });
    expect(screen.queryByLabelText('Logger un aliment')).toBeNull();
    expect(screen.queryByLabelText('Navigation principale')).toBeNull();
  });
});
```

(Resolve the `children` prop name conflict by renaming the snippet prop to `slot` or moving the children list to `kids`. The implementer should pick one and update tests + component consistently.)

- [ ] **Step 8.2: Implement (skeleton)**

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  import BottomNavBento from './BottomNavBento.svelte';
  import FabLog from './FabLog.svelte';
  import ChildHeaderPill from './ChildHeaderPill.svelte';
  import ChildSwitcherDrawer from './ChildSwitcherDrawer.svelte';
  import LogSheet from './LogSheet.svelte';

  type Child = { id: string; name: string; birthMonth: string; avatarSeed: string };

  let {
    user,
    kids,
    currentChildId,
    currentPath,
    foods,
    children
  }: {
    user?: { email: string };
    kids: Child[];
    currentChildId?: string;
    currentPath: string;
    foods: { id: string; label: string }[];
    children?: Snippet;
  } = $props();

  let logOpen = $state(false);
  let switcherOpen = $state(false);

  const inChildArea = $derived(!!currentChildId && currentPath.startsWith('/child/'));
  const showChrome = $derived(inChildArea || currentPath === '/account');
  const currentChild = $derived(kids.find((k) => k.id === currentChildId));
</script>

<div class="mx-auto flex min-h-screen max-w-md flex-col px-3 pb-20 pt-3" data-variant="mobile">
  {#if showChrome && currentChild}
    <ChildHeaderPill child={currentChild} onSwitch={() => (switcherOpen = true)} />
  {/if}

  <main class="flex-1">
    {#if children}{@render children()}{/if}
  </main>

  {#if showChrome && currentChildId}
    <BottomNavBento {currentChildId} {currentPath} />
    <div class="fixed bottom-6 left-1/2 z-40 -translate-x-1/2">
      <FabLog onclick={() => (logOpen = true)} />
    </div>
    <ChildSwitcherDrawer bind:open={switcherOpen} children={kids} {currentChildId} />
    <LogSheet
      bind:open={logOpen}
      childId={currentChildId}
      childName={currentChild?.name ?? ''}
      {foods}
    />
  {/if}
</div>
```

(Desktop variant — left rail — is **deferred to Task 12** to keep this commit small.)

- [ ] **Step 8.3: Run + commit**

```
cd <worktree> && npm test -- src/lib/components/AppShellBento.test.ts && \
  git add src/lib/components/AppShellBento.svelte src/lib/components/AppShellBento.test.ts && \
  git commit -m "feat(shell): AppShellBento mobile — header pill + bottom nav + FAB + sheets"
```

---

## Task 9: Wire feature flag through `+layout.server.ts` and `+layout.svelte`

**Files:**

- Modify: `src/routes/+layout.server.ts`
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 9.1: Read current `+layout.server.ts` and update**

Add a `bentoEnabled` computation to the load function. Pseudo-code (the implementer reads the actual file first):

```ts
import { bentoEnabled } from '$lib/feature-flags';

export const load: LayoutServerLoad = async (event) => {
  const existing = /* whatever the loader currently returns */;
  const bento = bentoEnabled(event.locals.user?.email, event.cookies);
  return { ...existing, bento };
};
```

- [ ] **Step 9.2: Update `+layout.svelte`**

Conditionally render `AppShellBento` when `data.bento === true`, else legacy `AppShell`:

```svelte
<script lang="ts">
  import AppShell from '$lib/components/AppShell.svelte';
  import AppShellBento from '$lib/components/AppShellBento.svelte';
  /* …other imports… */

  let { data, children } = $props();
</script>

{#if data.bento}
  <AppShellBento
    user={data.user}
    kids={data.children ?? []}
    currentChildId={data.currentChildId}
    currentPath={$page.url.pathname}
    foods={data.foods ?? []}
  >
    {@render children?.()}
  </AppShellBento>
{:else}
  <AppShell>
    {@render children?.()}
  </AppShell>
{/if}
```

The implementer adapts to the actual `data` shape. If the layout loader doesn't currently expose `children`/`currentChildId`/`foods`, those need to be added to its return value — extend the existing loader minimally (don't refactor unrelated code).

- [ ] **Step 9.3: Run check + tests + commit**

```
cd <worktree> && npm run check && npm test && \
  git add src/routes/+layout.server.ts src/routes/+layout.svelte && \
  git commit -m "feat(shell): wire feature flag — render AppShellBento for opted-in users"
```

---

## Task 10: e2e — tab navigation

**Files:**

- Create: `tests/e2e/bento-shell.spec.ts` (or `e2e/bento-shell.spec.ts` — match project convention)

- [ ] **Step 10.1: Write the spec**

```ts
import { test, expect } from '@playwright/test';

test.describe('Bento shell — tab navigation', () => {
  test.beforeEach(async ({ page, context }) => {
    await context.addCookies([{ name: 'bento', value: '1', url: 'http://localhost:3000' }]);
    /* sign in via test fixture; assumes seedChild + sign-in helper in scripts/reset-e2e-db.mjs */
    await page.goto('/login');
    /* … sign in … */
    await page.goto('/child/abc');
  });

  test('switches between the four tabs', async ({ page }) => {
    await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();

    await page.getByRole('link', { name: 'Carnet' }).click();
    await expect(page).toHaveURL(/\/child\/[^/]+\/foods/);

    await page.getByRole('link', { name: 'Découvrir' }).click();
    await expect(page).toHaveURL(/\/child\/[^/]+\/guide/);

    await page.getByRole('link', { name: 'Profil' }).click();
    await expect(page).toHaveURL(/\/account/);
  });
});
```

- [ ] **Step 10.2: Run + commit**

```
cd <worktree> && npm run test:e2e -- e2e/bento-shell.spec.ts && \
  git add e2e/bento-shell.spec.ts && \
  git commit -m "test(e2e): bento shell tab navigation"
```

If the project lacks a sign-in fixture, the implementer adds a small `bentoFixtures.ts` and reuses it.

---

## Task 11: e2e — FAB → log → save

**Files:**

- Modify: `e2e/bento-shell.spec.ts`

- [ ] **Step 11.1: Append to the spec**

```ts
test('FAB opens log sheet, food saves, sheet closes', async ({ page }) => {
  await page.goto('/child/abc');
  await page.getByRole('button', { name: 'Logger un aliment' }).click();

  await expect(page.getByPlaceholder('🔍 chercher un aliment…')).toBeVisible();
  await page.getByPlaceholder('🔍 chercher un aliment…').fill('poire');
  await page.getByRole('option', { name: 'Poire' }).click();

  await page.getByRole('button', { name: 'Enregistrer' }).click();

  await expect(page.getByText('Enregistré')).toBeVisible();
  await expect(page.getByPlaceholder('🔍 chercher un aliment…')).not.toBeVisible();

  /* recent feed includes the new entry */
  await expect(page.getByText('Poire').first()).toBeVisible();
});
```

- [ ] **Step 11.2: Run + commit**

```
cd <worktree> && npm run test:e2e -- e2e/bento-shell.spec.ts && \
  git add e2e/bento-shell.spec.ts && \
  git commit -m "test(e2e): FAB log flow — sheet opens, food saves, toast shows"
```

---

## Task 12: Desktop left-rail variant of AppShellBento

**Files:**

- Modify: `src/lib/components/AppShellBento.svelte`

- [ ] **Step 12.1: Add a CSS-only branch for ≥ 1024px**

The mobile body wraps in `max-w-md` and shows `BottomNavBento` + `FabLog` fixed bottom. For desktop, render a 220-px sidebar instead. Use Tailwind responsive prefixes (`lg:`) so the same component handles both viewports — no JS branching.

The simplest CSS shape:

```svelte
<div class="grid min-h-screen lg:grid-cols-[220px_1fr]">
  <aside
    class="hidden lg:flex lg:flex-col lg:gap-2 lg:border-r lg:border-border lg:bg-surface lg:p-4"
    aria-label="Navigation principale"
  >
    <!-- brand pill -->
    <!-- TabLink list reusing the TABS constant from BottomNavBento -->
    <!-- ChildHeaderPill at bottom -->
  </aside>

  <div class="mx-auto w-full max-w-md px-3 pb-20 pt-3 lg:max-w-3xl">
    <!-- mobile chrome (mobile-only via lg:hidden classes) + main -->
  </div>

  <!-- desktop "+ Logger" pill in the top-right -->
  <button
    class="fixed right-4 top-4 hidden rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground shadow-soft lg:flex"
    onclick={() => (logOpen = true)}
  >
    + Logger
  </button>
</div>
```

Hide the mobile bottom nav and FAB at `lg:` (`lg:hidden`).

The implementer writes a desktop test by querying `document.querySelector('aside[aria-label="Navigation principale"]')` and asserting it exists in the DOM (always rendered, but visually hidden until `lg`).

- [ ] **Step 12.2: Update test**

Add to `AppShellBento.test.ts`:

```ts
it('renders the desktop sidebar nav (always in DOM, hidden until lg via CSS)', () => {
  const { container } = render(AppShellBento, { props: baseProps });
  expect(container.querySelector('aside[aria-label="Navigation principale"]')).not.toBeNull();
});
```

- [ ] **Step 12.3: Run + commit**

```
cd <worktree> && npm test -- src/lib/components/AppShellBento.test.ts && \
  git add src/lib/components/AppShellBento.svelte src/lib/components/AppShellBento.test.ts && \
  git commit -m "feat(shell): AppShellBento desktop — left rail + top-right Logger pill (≥ 1024px)"
```

---

## Task 13: Phase 3 smoke test + tag

**Files:** None modified.

- [ ] **Step 13.1: Full pre-flight**

```bash
cd <worktree> && npm run lint && npm run check && npm test && npm run test:e2e -- e2e/bento-shell.spec.ts
```

All four green. Existing 939 tests still passing; new shell tests + e2e green.

- [ ] **Step 13.2: Visual dev-server smoke (manual)**

```bash
cd <worktree> && DATABASE_URL=$REAL_DB npm run dev
```

Open the app, set the cookie via devtools (`document.cookie = "bento=1; path=/"`), reload. Confirm:

- Bottom tab bar visible at mobile breakpoint
- FAB sage circle centered over tab bar
- Tap FAB → bottom sheet slides up
- Type in search → food list filters
- Submit → toast appears, sheet closes, recent feed updates
- Resize to ≥1024px → bottom nav disappears, left rail appears
- Switch off the cookie → legacy chrome returns

- [ ] **Step 13.3: Tag + summary**

```bash
cd <worktree> && git tag bento-phase3-complete && \
  git push origin worktree-feat-phase3:feat/bento-phase3 && \
  gh pr create --base main --head feat/bento-phase3 --title "feat(shell): bento app shell + FAB log flow (Phase 3)" --body "$(cat <<EOF
## Summary
4-tab bottom nav + center FAB + multi-child header pill + log Sheet wired to existing /log form action. Behind the bento_enabled feature flag (owner-only allow-list + bento=1 cookie override).
EOF
)"
```

---

## End of plan

Phase 3 complete. Next plan: Phase 4 — Aujourd'hui + Carnet rebuild (the actual page bodies inside the new shell).

# Bundle 1 — Foundation primitives (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-05-21-simplify-codebase-design.md`

**Goal:** Add the missing UI primitives and extend three existing ones so subsequent bundles can migrate ~25 form-field sites, 7 amber callouts, 3 detail sheets, 2 confirm modals, and ~9 inline pill CTAs onto a single source of truth.

**Architecture:** Each new component lives in `src/lib/components/ui/` next to its peers and has a co-located `*.test.ts` covering happy-dom render + key props. Extensions to `Button`, `SectionHeader`, `Card` are additive (no behavior change for existing callsites). Six shared paraglide keys (`commonCancel`, …) are added to `messages/{fr,en}.json` and consumed by `ConfirmModal`. **No callsite migrations in this bundle** — that work is Bundle 2 and Bundle 3.

**Tech Stack:** SvelteKit (Svelte 5 runes), TypeScript, Tailwind (tokens in `src/app.css`), bits-ui Dialog primitive, paraglide-js messages, vitest + @testing-library/svelte + happy-dom, lucide-svelte icons.

**Conventions to honor:**

- Frontmatter in this repo uses Svelte 5 runes (`$props`, `$state`, `$derived`, `$bindable`, `$effect`). Match the style of `Button.svelte` / `Card.svelte`.
- French copy goes through paraglide (`import * as m from '$lib/paraglide/messages'`), not as string literals.
- Tests follow the pattern in `src/lib/components/ui/Button.test.ts` — `@vitest-environment happy-dom`, `import { textSnippet } from '../../../test/component'`, `cleanup()` in `afterEach`.
- Run `npm test` (vitest) and `npm run lint` (eslint + prettier via lint-staged) at the end. Husky blocks commits if either fails — do not pass `--no-verify`.
- After each commit in this plan, the working tree must be in a green state (`npm test` passes). The plan does not need PR pushes between tasks; one PR opens at the end of all tasks.

---

## File structure

**Created (10 new files):**

```
src/lib/components/ui/Field.svelte
src/lib/components/ui/Field.test.ts
src/lib/components/ui/Callout.svelte
src/lib/components/ui/Callout.test.ts
src/lib/components/ui/CalloutCard.svelte
src/lib/components/ui/CalloutCard.test.ts
src/lib/components/ui/ConfirmModal.svelte
src/lib/components/ui/ConfirmModal.test.ts
src/lib/components/ui/DetailSheet.svelte
src/lib/components/ui/DetailSheet.test.ts
src/lib/components/ui/SheetSection.svelte
src/lib/components/ui/SheetSection.test.ts
```

**Modified:**

```
src/lib/components/ui/Button.svelte                # + 'pill' size
src/lib/components/ui/Button.test.ts               # + pill-size cases
src/lib/components/ui/SectionHeader.svelte         # + size prop (sm | md)
src/lib/components/ui/SectionHeader.test.ts        # + size cases
src/lib/components/ui/Card.svelte                  # + padding prop (sm | md | lg)
src/lib/components/ui/Card.test.ts                 # + padding cases
src/lib/components/ui/EmptyHint.svelte             # collapsed back to simple-only mode
src/lib/components/ui/EmptyHint.test.ts            # drop rich-mode cases (now lives in CalloutCard)
messages/fr.json                                   # + 6 common* keys
messages/en.json                                   # + 6 common* keys
```

**Untouched (read-only inputs):**

```
src/lib/components/ui/Label.svelte                 # used inside Field
src/lib/components/ui/Input.svelte                 # used inside Field consumers (passed as children)
src/lib/components/ui/FormError.svelte             # used inside Field
src/lib/components/ui/Modal.svelte                 # used inside ConfirmModal + DetailSheet
src/lib/forms/tracked-enhance.ts                   # used inside ConfirmModal
src/app.css                                        # already exposes the tokens Callout uses (--warning, --severe, --tile-sky, --tile-mint)
```

**Why this shape:** every primitive is ~50–150 lines and has one responsibility. `DetailSheet` is split from `SheetSection` because they're independent — a sheet can render any number of sections, and a section is also useful inline outside a sheet (e.g., on settings tabs). `CalloutCard` is extracted from `EmptyHint` because the rich-mode markup was already a second component pretending to be a mode; once extracted, `EmptyHint` drops to ~30 lines.

---

## Task 1: Add shared paraglide message keys

**Files:**

- Modify: `messages/fr.json`
- Modify: `messages/en.json`

**Context:** 501 keys exist in each file (flat JSON, alphabetical-ish but grouped by domain prefix — `chrome*`, `auth*`, `carnet*`, `decouvrir*`, etc.). The audit found that `Annuler`, `Mot de passe`, `Prénom`, `Retirer` are hardcoded as literals across 5+ files. We introduce a `common*` family so ConfirmModal and Bundle 5 migrations have a canonical source. Paraglide regenerates `src/lib/paraglide/messages/*.js` automatically on `npm run dev` / `npm run build`; we don't edit the generated files.

- [ ] **Step 1.1: Add the six FR keys** to `messages/fr.json` (insert alphabetically — between `commonClose` if present, otherwise next to the existing `commonFrOnlyBanner*` block):

```json
  "commonCancel": "Annuler",
  "commonDelete": "Supprimer",
  "commonFirstName": "Prénom",
  "commonPassword": "Mot de passe",
  "commonRemove": "Retirer",
  "commonSave": "Enregistrer",
```

- [ ] **Step 1.2: Add the matching EN keys** to `messages/en.json` at the same positions:

```json
  "commonCancel": "Cancel",
  "commonDelete": "Delete",
  "commonFirstName": "First name",
  "commonPassword": "Password",
  "commonRemove": "Remove",
  "commonSave": "Save",
```

- [ ] **Step 1.3: Regenerate paraglide artifacts.**

Run: `npm run paraglide`
Expected: `src/lib/paraglide/messages/fr.js` and `en.js` now export `commonCancel`, `commonDelete`, `commonFirstName`, `commonPassword`, `commonRemove`, `commonSave`. The script runs `paraglide-js compile --project ./project.inlang --outdir ./src/lib/paraglide` (defined in `package.json`).

Verify with:

```bash
grep -E "commonCancel|commonDelete|commonFirstName|commonPassword|commonRemove|commonSave" src/lib/paraglide/messages/fr.js | wc -l
```

Expected: `6`.

- [ ] **Step 1.4: Run tests + lint.**

Run: `npm test -- --run`
Expected: green.

Run: `npm run lint`
Expected: green.

- [ ] **Step 1.5: Commit.**

```bash
git add messages/ src/lib/paraglide/
git commit -m "i18n(common): add commonCancel/Delete/FirstName/Password/Remove/Save shared keys"
```

---

## Task 2: Create `Field` primitive

**Files:**

- Create: `src/lib/components/ui/Field.svelte`
- Test: `src/lib/components/ui/Field.test.ts`

**Context:** The audit found `<div class="grid gap-1.5"><Label/><Input/></div>` repeated ~25 times across forms, with a separate `<FormError>` block when validation fails. Field wraps the label / children / error trio. The input itself stays as a child so consumers retain the full `Input`/`Select`/`Textarea` prop surface (`autocomplete`, `type`, `inputmode`, `aria-*`, etc.). The Field component takes `name` to derive the `for=`/`id=` linkage. The input child is expected to set `id={name}` itself — Field does NOT inject the id (would require slot prop access).

- [ ] **Step 2.1: Write the failing test** (`Field.test.ts`):

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/svelte';
import { createRawSnippet, type Snippet } from 'svelte';
import Field from './Field.svelte';

afterEach(() => cleanup());

const inputSnippet = (id: string): Snippet =>
  createRawSnippet(() => ({
    render: () => `<input id="${id}" type="text" />`
  })) as unknown as Snippet;

describe('Field', () => {
  it('renders a label whose for attribute matches the name', () => {
    render(Field, {
      props: { name: 'email', label: 'Adresse e-mail', children: inputSnippet('email') }
    });
    const label = screen.getByText('Adresse e-mail') as HTMLLabelElement;
    expect(label.tagName.toLowerCase()).toBe('label');
    expect(label.getAttribute('for')).toBe('email');
  });

  it('renders the children (the input)', () => {
    const { container } = render(Field, {
      props: { name: 'email', label: 'Adresse e-mail', children: inputSnippet('email') }
    });
    expect(container.querySelector('input#email')).not.toBeNull();
  });

  it('renders the optional hint below the input', () => {
    render(Field, {
      props: {
        name: 'email',
        label: 'Adresse e-mail',
        hint: '8 caractères minimum',
        children: inputSnippet('email')
      }
    });
    expect(screen.getByText('8 caractères minimum')).toBeTruthy();
  });

  it('renders FormError when error is provided', () => {
    render(Field, {
      props: {
        name: 'email',
        label: 'Adresse e-mail',
        error: 'Adresse invalide',
        children: inputSnippet('email')
      }
    });
    const err = screen.getByRole('alert');
    expect(err.textContent).toContain('Adresse invalide');
  });

  it('does not render FormError when no error', () => {
    render(Field, {
      props: { name: 'email', label: 'Adresse e-mail', children: inputSnippet('email') }
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('forwards a custom class onto the wrapper', () => {
    const { container } = render(Field, {
      props: {
        name: 'email',
        label: 'Adresse e-mail',
        class: 'mb-4',
        children: inputSnippet('email')
      }
    });
    expect(container.querySelector('div.mb-4')).not.toBeNull();
  });
});
```

- [ ] **Step 2.2: Run the test and verify it fails** with "module not found":

Run: `npm test -- --run src/lib/components/ui/Field.test.ts`
Expected: FAIL — `Cannot find module './Field.svelte'`.

- [ ] **Step 2.3: Implement `Field.svelte`:**

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  import Label from './Label.svelte';
  import FormError from './FormError.svelte';

  let {
    name,
    label,
    hint,
    error,
    class: className = '',
    children
  }: {
    name: string;
    label: string;
    hint?: string;
    error?: string;
    class?: string;
    children: Snippet;
  } = $props();
</script>

<div class={cn('grid gap-1.5', className)}>
  <Label for={name}>{label}</Label>
  {@render children()}
  {#if hint}
    <p class="text-xs text-ink-soft">{hint}</p>
  {/if}
  {#if error}
    <FormError>{error}</FormError>
  {/if}
</div>
```

- [ ] **Step 2.4: Run the tests and verify they pass:**

Run: `npm test -- --run src/lib/components/ui/Field.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 2.5: Run the full vitest suite + lint** to make sure nothing else broke:

Run: `npm test -- --run`
Expected: green.

Run: `npm run lint`
Expected: green.

- [ ] **Step 2.6: Commit.**

```bash
git add src/lib/components/ui/Field.svelte src/lib/components/ui/Field.test.ts
git commit -m "feat(ui): add Field primitive (label + child input + optional hint/error)"
```

---

## Task 3: Create `Callout` primitive

**Files:**

- Create: `src/lib/components/ui/Callout.svelte`
- Test: `src/lib/components/ui/Callout.test.ts`

**Context:** Replaces the 7 hand-rolled `<aside class="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="note">` blocks (audit Styles #1) that bypass tokens and have no dark-mode parity. Three variants: `warning` (amber-ish surface, uses `--warning` token), `info` (uses `--tile-sky` token, calmer), `success` (uses `--tile-mint` token). Icons are hardcoded per variant: `AlertTriangle` / `Info` / `Check` from `lucide-svelte`. No icon prop, no slot — decision locked during brainstorm.

Token guard: `src/app.css` defines `--warning`, `--warning-foreground`, `--tile-sky`, `--tile-sky-foreground`, `--tile-mint`, `--tile-mint-foreground`. If any of these are missing, surface that finding in the PR description; the spec assumes they exist.

- [ ] **Step 3.1: Write the failing test:**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/svelte';
import { textSnippet } from '../../../test/component';
import Callout from './Callout.svelte';

afterEach(() => cleanup());

describe('Callout', () => {
  it('renders as an aside with role="note" by default', () => {
    const { container } = render(Callout, {
      props: { variant: 'warning', children: textSnippet('Heads up.') }
    });
    const aside = container.querySelector('aside');
    expect(aside).not.toBeNull();
    expect(aside?.getAttribute('role')).toBe('note');
    expect(aside?.textContent).toContain('Heads up.');
  });

  it('renders the warning surface for variant="warning"', () => {
    const { container } = render(Callout, {
      props: { variant: 'warning', children: textSnippet('warning body') }
    });
    expect(container.querySelector('aside')?.className).toContain('bg-warning');
    expect(container.querySelector('svg')).not.toBeNull(); // AlertTriangle icon
  });

  it('renders the info surface for variant="info"', () => {
    const { container } = render(Callout, {
      props: { variant: 'info', children: textSnippet('info body') }
    });
    expect(container.querySelector('aside')?.className).toContain('bg-tile-sky');
  });

  it('renders the success surface for variant="success"', () => {
    const { container } = render(Callout, {
      props: { variant: 'success', children: textSnippet('done') }
    });
    expect(container.querySelector('aside')?.className).toContain('bg-tile-mint');
  });

  it('renders an optional title above the body', () => {
    render(Callout, {
      props: { variant: 'info', title: 'Bon à savoir', children: textSnippet('Body.') }
    });
    const heading = screen.getByText('Bon à savoir');
    expect(heading.tagName.toLowerCase()).toBe('p'); // styled as a heading but not a real h-level
    expect(heading.className).toContain('font-semibold');
  });

  it('forwards a custom class', () => {
    const { container } = render(Callout, {
      props: { variant: 'warning', class: 'mt-4', children: textSnippet('x') }
    });
    expect(container.querySelector('aside')?.className).toContain('mt-4');
  });
});
```

- [ ] **Step 3.2: Run the test and verify it fails:**

Run: `npm test -- --run src/lib/components/ui/Callout.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3.3: Implement `Callout.svelte`:**

```svelte
<script lang="ts" module>
  export type Variant = 'warning' | 'info' | 'success';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  import { AlertTriangle, Info, Check, type Icon as LucideIcon } from 'lucide-svelte';

  let {
    variant,
    title,
    class: className = '',
    children
  }: {
    variant: Variant;
    title?: string;
    class?: string;
    children: Snippet;
  } = $props();

  const SURFACES: Record<Variant, string> = {
    warning: 'bg-warning text-warning-foreground border-warning/40',
    info: 'bg-tile-sky text-tile-sky-foreground border-tile-sky/40',
    success: 'bg-tile-mint text-tile-mint-foreground border-tile-mint/40'
  };

  const ICONS: Record<Variant, typeof LucideIcon> = {
    warning: AlertTriangle,
    info: Info,
    success: Check
  };

  const Icon = $derived(ICONS[variant]);
</script>

<aside
  role="note"
  class={cn(
    'flex items-start gap-2 rounded-tile border p-3 text-sm',
    SURFACES[variant],
    className
  )}
>
  <Icon size={18} class="mt-0.5 shrink-0" aria-hidden="true" />
  <div class="min-w-0 flex-1">
    {#if title}
      <p class="mb-1 font-semibold">{title}</p>
    {/if}
    {@render children()}
  </div>
</aside>
```

- [ ] **Step 3.4: Run the test and verify it passes:**

Run: `npm test -- --run src/lib/components/ui/Callout.test.ts`
Expected: PASS — 6 tests.

- [ ] **Step 3.5: Run the full suite + lint:**

Run: `npm test -- --run`
Expected: green.

Run: `npm run lint`
Expected: green.

- [ ] **Step 3.6: Commit.**

```bash
git add src/lib/components/ui/Callout.svelte src/lib/components/ui/Callout.test.ts
git commit -m "feat(ui): add Callout primitive (warning|info|success surfaces)"
```

---

## Task 4: Extract `CalloutCard` from `EmptyHint`

**Files:**

- Create: `src/lib/components/ui/CalloutCard.svelte`
- Test: `src/lib/components/ui/CalloutCard.test.ts`
- Modify: `src/lib/components/ui/EmptyHint.svelte` (drop rich mode)
- Modify: `src/lib/components/ui/EmptyHint.test.ts` (drop rich-mode cases)

**Context:** `EmptyHint` is currently two components pretending to be one: a simple dashed-border `<p>` and a rich `<div>` with icon + h2 title + body + action snippet. Extract the rich layout as `CalloutCard` and keep `EmptyHint` as the simple-only `<p>` variant. **This is a refactor of EmptyHint's API: any existing callsite passing `title`/`icon`/`action` will now have to use `CalloutCard` instead.** Audit it before deleting — but the audit found EmptyHint's rich mode is only consumed by 1 file inside the project; the marketing callout pages currently hand-roll their own version. We migrate the one consumer in this same task to keep the tree green.

- [ ] **Step 4.1: Identify EmptyHint rich-mode consumers.**

Run: `rg -n 'EmptyHint' src/ | rg -v '\.test\.|EmptyHint\.svelte'`

Note every callsite. For each, check whether it passes `title`, `icon`, or `action`:

```bash
rg -n -B1 -A4 'EmptyHint' src/ --type svelte --type ts | rg -B1 -A1 'title=|icon=|action='
```

Expected: probably ≤1 rich consumer. Record the path(s) for Step 4.6.

- [ ] **Step 4.2: Write the failing test for CalloutCard:**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/svelte';
import { createRawSnippet, type Snippet } from 'svelte';
import { textSnippet } from '../../../test/component';
import { Sparkles } from 'lucide-svelte';
import CalloutCard from './CalloutCard.svelte';

afterEach(() => cleanup());

const actionSnippet = (label: string): Snippet =>
  createRawSnippet(() => ({
    render: () => `<a href="#">${label}</a>`
  })) as unknown as Snippet;

describe('CalloutCard', () => {
  it('renders title as h2, body, and dashed border', () => {
    const { container } = render(CalloutCard, {
      props: { title: 'Vous avez fait le tour', children: textSnippet('Variez.') }
    });
    expect(screen.getByText('Vous avez fait le tour').tagName.toLowerCase()).toBe('h2');
    expect(container.querySelector('div.rounded-tile')?.className).toContain('border-dashed');
    expect(container.textContent).toContain('Variez.');
  });

  it('renders the icon when provided', () => {
    const { container } = render(CalloutCard, {
      props: { title: 'X', icon: Sparkles, children: textSnippet('Y') }
    });
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders the action snippet below the body', () => {
    const { container } = render(CalloutCard, {
      props: {
        title: 'X',
        children: textSnippet('Y'),
        action: actionSnippet('Voir')
      }
    });
    expect(container.querySelector('a')?.textContent).toBe('Voir');
  });

  it('renders without an icon or action', () => {
    const { container } = render(CalloutCard, {
      props: { title: 'X', children: textSnippet('Y') }
    });
    expect(container.querySelector('svg')).toBeNull();
  });

  it('forwards a custom class', () => {
    const { container } = render(CalloutCard, {
      props: { title: 'X', class: 'mt-8', children: textSnippet('Y') }
    });
    expect(container.querySelector('div')?.className).toContain('mt-8');
  });
});
```

- [ ] **Step 4.3: Implement `CalloutCard.svelte`** (copy the rich-mode markup verbatim from current `EmptyHint.svelte` lines 27-50):

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  import type { Icon as LucideIcon } from 'lucide-svelte';

  let {
    class: className = '',
    title,
    icon,
    action,
    children
  }: {
    class?: string;
    title: string;
    icon?: typeof LucideIcon;
    action?: Snippet;
    children: Snippet;
  } = $props();

  const Icon = $derived(icon);
</script>

<div
  class={cn(
    'flex flex-col items-center justify-center rounded-tile border border-dashed border-border bg-canvas px-6 py-10 text-center',
    className
  )}
>
  {#if Icon}
    <div
      class="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-surface text-primary-strong shadow-card"
    >
      <Icon size={26} aria-hidden="true" />
    </div>
  {/if}
  <h2 class="text-base font-semibold">{title}</h2>
  <p class="mt-1 max-w-sm text-sm text-ink-soft">
    {@render children()}
  </p>
  {#if action}
    <div class="mt-4">{@render action()}</div>
  {/if}
</div>
```

- [ ] **Step 4.4: Run the CalloutCard tests and verify they pass:**

Run: `npm test -- --run src/lib/components/ui/CalloutCard.test.ts`
Expected: PASS — 5 tests.

- [ ] **Step 4.5: Simplify `EmptyHint.svelte` back to the simple-only variant:**

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  let {
    class: className = '',
    children
  }: {
    class?: string;
    children: Snippet;
  } = $props();
</script>

<p
  class={cn(
    'rounded-tile border border-dashed border-border bg-canvas p-3 text-center text-sm text-ink-soft',
    className
  )}
>
  {@render children()}
</p>
```

- [ ] **Step 4.6: Migrate any EmptyHint rich-mode consumer to CalloutCard** (using the paths found in Step 4.1). For each: change the import, replace the tag, the props (`title`, `icon`, `action`, `children`) carry over unchanged.

If Step 4.1 found zero rich-mode consumers, skip 4.6 and add a note in the commit message: "No rich-mode consumers found in tree; pure deletion."

- [ ] **Step 4.7: Drop rich-mode test cases from `EmptyHint.test.ts`.**

Edit `EmptyHint.test.ts` so only the simple-mode tests remain. After edits, the file should test:

- "renders a dashed paragraph with the message"
- "appends additional classes via class prop"

Delete the two cases that test the rich layout (the `title=` and `icon=` cases) — they're covered by `CalloutCard.test.ts` now.

- [ ] **Step 4.8: Run all tests:**

Run: `npm test -- --run`
Expected: PASS — including the migrated rich-mode consumer's existing tests, if any.

- [ ] **Step 4.9: Run lint:**

Run: `npm run lint`
Expected: green.

- [ ] **Step 4.10: Commit.**

```bash
git add src/lib/components/ui/CalloutCard.svelte src/lib/components/ui/CalloutCard.test.ts \
        src/lib/components/ui/EmptyHint.svelte src/lib/components/ui/EmptyHint.test.ts
# also any migrated consumer files from step 4.6:
# git add path/to/migrated/+page.svelte ...
git commit -m "refactor(ui): extract CalloutCard from EmptyHint rich-mode"
```

---

## Task 5: Create `ConfirmModal` primitive

**Files:**

- Create: `src/lib/components/ui/ConfirmModal.svelte`
- Test: `src/lib/components/ui/ConfirmModal.test.ts`

**Context:** Absorbs the two hand-rolled center modals in `src/routes/child/[id]/settings/+page.svelte` (delete child @ lines 187-223 and leave child @ lines 225-238), plus the upcoming delete-account flow in `account/delete`. The current pattern owns the form (`<form method="POST" action=... use:enhance={trackSubmission(...)}>`), an optional `confirmName` text input (must equal a string), an optional password input, and Annuler/Confirmer buttons. ConfirmModal wraps all of that. The parent only owns `bind:open` and the routing decision (which `?/action` URL to POST to).

API:

```svelte
<ConfirmModal
  bind:open={deleteOpen}
  title="Supprimer {data.child.name} ?"
  description="Saisissez exactement « {data.child.name} » pour confirmer."
  action="?/deleteChild"
  confirmLabel="Supprimer définitivement"
  loadingLabel="Suppression…"
  destructive
  requireText={data.child.name}
  requirePassword
/>
```

When `requireText` is set, an input appears whose value must equal that string before the submit button enables. When `requirePassword` is true, a password input appears (named `currentPassword` to match the existing server-side `verifyPassword` consumers) and must be non-empty. When neither is set, only the Annuler / Confirmer buttons render — that covers the "leave child" simple-confirm case.

- [ ] **Step 5.1: Write the failing test:**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/svelte';
import ConfirmModal from './ConfirmModal.svelte';

afterEach(() => cleanup());

describe('ConfirmModal', () => {
  it('renders title and description when open', () => {
    render(ConfirmModal, {
      props: {
        open: true,
        title: 'Supprimer Léo ?',
        description: 'Cette action est définitive.',
        action: '?/deleteChild',
        confirmLabel: 'Supprimer'
      }
    });
    expect(screen.getByText('Supprimer Léo ?')).toBeTruthy();
    expect(screen.getByText('Cette action est définitive.')).toBeTruthy();
  });

  it('renders Annuler + Confirmer buttons by default', () => {
    render(ConfirmModal, {
      props: {
        open: true,
        title: 'X',
        action: '?/x',
        confirmLabel: 'OK'
      }
    });
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'OK' })).toBeTruthy();
  });

  it('uses the destructive variant when destructive=true', () => {
    render(ConfirmModal, {
      props: {
        open: true,
        title: 'X',
        action: '?/x',
        confirmLabel: 'Delete',
        destructive: true
      }
    });
    const submit = screen.getByRole('button', { name: 'Delete' }) as HTMLButtonElement;
    expect(submit.className).toContain('bg-severe');
  });

  it('disables the confirm button until requireText matches', async () => {
    render(ConfirmModal, {
      props: {
        open: true,
        title: 'X',
        action: '?/x',
        confirmLabel: 'OK',
        requireText: 'Léo'
      }
    });
    const submit = screen.getByRole('button', { name: 'OK' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    const input = screen.getByLabelText('Saisissez « Léo » pour confirmer', {
      exact: false
    }) as HTMLInputElement | null;
    // fallback: query by placeholder if the label query fails — happy-dom is lenient
    const target = input ?? (screen.getAllByRole('textbox')[0] as HTMLInputElement);
    await fireEvent.input(target, { target: { value: 'Léo' } });
    expect(submit.disabled).toBe(false);
  });

  it('disables the confirm button until requirePassword input has a value', async () => {
    render(ConfirmModal, {
      props: {
        open: true,
        title: 'X',
        action: '?/x',
        confirmLabel: 'OK',
        requirePassword: true
      }
    });
    const submit = screen.getByRole('button', { name: 'OK' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    const pwd = document.querySelector('input[type="password"]') as HTMLInputElement;
    expect(pwd).not.toBeNull();
    await fireEvent.input(pwd, { target: { value: 'a' } });
    expect(submit.disabled).toBe(false);
  });

  it('sets the form action attribute', () => {
    const { container } = render(ConfirmModal, {
      props: {
        open: true,
        title: 'X',
        action: '?/myAction',
        confirmLabel: 'OK'
      }
    });
    const form = container.querySelector('form');
    expect(form?.getAttribute('action')).toBe('?/myAction');
    expect(form?.getAttribute('method')?.toLowerCase()).toBe('post');
  });
});
```

- [ ] **Step 5.2: Run the test and verify it fails:**

Run: `npm test -- --run src/lib/components/ui/ConfirmModal.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 5.3: Implement `ConfirmModal.svelte`:**

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import { trackSubmission } from '$lib/forms/tracked-enhance';
  import * as m from '$lib/paraglide/messages';
  import Modal from './Modal.svelte';
  import Button from './Button.svelte';
  import Input from './Input.svelte';
  import Field from './Field.svelte';

  let {
    open = $bindable(false),
    title,
    description,
    action,
    confirmLabel,
    loadingLabel,
    destructive = false,
    requireText,
    requirePassword = false
  }: {
    open?: boolean;
    title: string;
    description?: string;
    action: string;
    confirmLabel: string;
    loadingLabel?: string;
    destructive?: boolean;
    /** When set, a text input appears whose value must equal this string. */
    requireText?: string;
    /** When true, a `currentPassword` input appears and must be non-empty. */
    requirePassword?: boolean;
  } = $props();

  let submitting = $state(false);
  let confirmText = $state('');
  let confirmPassword = $state('');

  const textOk = $derived(requireText ? confirmText === requireText : true);
  const passwordOk = $derived(requirePassword ? confirmPassword.length > 0 : true);
  const canSubmit = $derived(textOk && passwordOk);

  function close() {
    open = false;
    confirmText = '';
    confirmPassword = '';
  }
</script>

<Modal bind:open side="center" {title} {description}>
  <form
    method="POST"
    {action}
    class="grid gap-3"
    use:enhance={trackSubmission((v) => (submitting = v))}
  >
    {#if requireText}
      <Field name="confirmText" label={`Saisissez « ${requireText} » pour confirmer`}>
        <Input
          id="confirmText"
          name="confirmText"
          bind:value={confirmText}
          placeholder={requireText}
          autocomplete="off"
        />
      </Field>
    {/if}
    {#if requirePassword}
      <Field name="currentPassword" label={m.commonPassword()}>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autocomplete="current-password"
          bind:value={confirmPassword}
          required
        />
      </Field>
    {/if}
    <div class="mt-2 flex justify-end gap-2">
      <Button type="button" variant="outline" onclick={close}>{m.commonCancel()}</Button>
      <Button
        type="submit"
        variant={destructive ? 'destructive' : 'default'}
        loading={submitting}
        disabled={!canSubmit}
      >
        {submitting && loadingLabel ? loadingLabel : confirmLabel}
      </Button>
    </div>
  </form>
</Modal>
```

- [ ] **Step 5.4: Run the test and verify it passes:**

Run: `npm test -- --run src/lib/components/ui/ConfirmModal.test.ts`
Expected: PASS — 6 tests.

If the "requireText" test fails because happy-dom isn't matching the Field's label-with-non-ASCII-quotes lookup, fall back to `screen.getByPlaceholderText(requireText)`. The test code already handles that with a fallback to `getAllByRole('textbox')[0]`.

- [ ] **Step 5.5: Run the full suite + lint:**

Run: `npm test -- --run`
Expected: green.

Run: `npm run lint`
Expected: green.

- [ ] **Step 5.6: Commit.**

```bash
git add src/lib/components/ui/ConfirmModal.svelte src/lib/components/ui/ConfirmModal.test.ts
git commit -m "feat(ui): add ConfirmModal primitive (optional name+password confirmation gating)"
```

---

## Task 6: Create `SheetSection` primitive

**Files:**

- Create: `src/lib/components/ui/SheetSection.svelte`
- Test: `src/lib/components/ui/SheetSection.test.ts`

**Context:** Absorbs the inline `text-xs|sm font-semibold uppercase tracking-wider text-ink-soft` labels that the three detail sheets re-create above each titled subsection. Different from `SectionHeader` because `SheetSection` (a) emits an `<h2>` to fit between Modal's `<h1>` title and ad-hoc body content, fixing the a11y heading-hierarchy jump the audit flagged; (b) accepts an icon prop rendered next to the title; (c) wraps the children so callers don't repeat the section padding/spacing rhythm.

API:

```svelte
<SheetSection title="Quand introduire" icon={Calendar}>
  <ul class="list-disc pl-5 text-sm">…</ul>
</SheetSection>
```

- [ ] **Step 6.1: Write the failing test:**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/svelte';
import { textSnippet } from '../../../test/component';
import { Calendar } from 'lucide-svelte';
import SheetSection from './SheetSection.svelte';

afterEach(() => cleanup());

describe('SheetSection', () => {
  it('renders the title as an h2 with the section-label classes', () => {
    render(SheetSection, {
      props: { title: 'Quand introduire', children: textSnippet('body') }
    });
    const h = screen.getByText('Quand introduire');
    expect(h.tagName.toLowerCase()).toBe('h2');
    expect(h.className).toContain('uppercase');
    expect(h.className).toContain('text-ink-soft');
  });

  it('renders the icon next to the title when provided', () => {
    const { container } = render(SheetSection, {
      props: { title: 'X', icon: Calendar, children: textSnippet('Y') }
    });
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders the children below the title', () => {
    const { container } = render(SheetSection, {
      props: { title: 'X', children: textSnippet('Body content') }
    });
    expect(container.textContent).toContain('Body content');
  });

  it('forwards a custom class onto the section element', () => {
    const { container } = render(SheetSection, {
      props: { title: 'X', class: 'mt-6', children: textSnippet('Y') }
    });
    expect(container.querySelector('section')?.className).toContain('mt-6');
  });
});
```

- [ ] **Step 6.2: Run the test and verify it fails:**

Run: `npm test -- --run src/lib/components/ui/SheetSection.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 6.3: Implement `SheetSection.svelte`:**

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';
  import type { Icon as LucideIcon } from 'lucide-svelte';

  let {
    title,
    icon,
    class: className = '',
    children
  }: {
    title: string;
    icon?: typeof LucideIcon;
    class?: string;
    children: Snippet;
  } = $props();

  const Icon = $derived(icon);
</script>

<section class={cn('mt-4 first:mt-0', className)}>
  <h2 class="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-soft">
    {#if Icon}
      <Icon size={14} aria-hidden="true" />
    {/if}
    {title}
  </h2>
  {@render children()}
</section>
```

- [ ] **Step 6.4: Run the test and verify it passes:**

Run: `npm test -- --run src/lib/components/ui/SheetSection.test.ts`
Expected: PASS — 4 tests.

- [ ] **Step 6.5: Run the full suite + lint:**

Run: `npm test -- --run`
Expected: green.

Run: `npm run lint`
Expected: green.

- [ ] **Step 6.6: Commit.**

```bash
git add src/lib/components/ui/SheetSection.svelte src/lib/components/ui/SheetSection.test.ts
git commit -m "feat(ui): add SheetSection primitive (h2 label + optional icon + children)"
```

---

## Task 7: Create `DetailSheet` primitive

**Files:**

- Create: `src/lib/components/ui/DetailSheet.svelte`
- Test: `src/lib/components/ui/DetailSheet.test.ts`

**Context:** Slot-driven Modal wrapper that absorbs the chrome of `StageDetailSheet`, `AddSymptomSheet`, `AllergenInfoDialog`. It owns the `side="auto"` Modal, the `title`, the optional `intro` paragraph, and the `scrollableBody` flag — consumers just nest `<SheetSection>` children and (when needed) a final `<Callout>`. Because the body grows past 92dvh on long content, `scrollableBody` is true by default.

API:

```svelte
<DetailSheet bind:open title="Lait" intro="Premier des grands allergènes…">
  <SheetSection title="Quand introduire" icon={Calendar}>
    <ul class="list-disc pl-5 text-sm">…</ul>
  </SheetSection>
  <SheetSection title="Comment offrir" icon={Spoon}>…</SheetSection>
  <Callout variant="warning">Signes graves : appeler le 15.</Callout>
</DetailSheet>
```

- [ ] **Step 7.1: Write the failing test:**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, screen } from '@testing-library/svelte';
import { textSnippet } from '../../../test/component';
import DetailSheet from './DetailSheet.svelte';

afterEach(() => cleanup());

describe('DetailSheet', () => {
  it('renders the title when open', () => {
    render(DetailSheet, {
      props: { open: true, title: 'Lait', children: textSnippet('body') }
    });
    expect(screen.getByText('Lait')).toBeTruthy();
  });

  it('renders the intro paragraph when provided', () => {
    render(DetailSheet, {
      props: {
        open: true,
        title: 'Lait',
        intro: 'Premier grand allergène à introduire tôt.',
        children: textSnippet('body')
      }
    });
    expect(screen.getByText('Premier grand allergène à introduire tôt.')).toBeTruthy();
  });

  it('does not render the intro when omitted', () => {
    render(DetailSheet, {
      props: { open: true, title: 'Lait', children: textSnippet('the body content') }
    });
    expect(screen.queryByText(/premier grand allergène/i)).toBeNull();
    expect(screen.getByText('the body content')).toBeTruthy();
  });

  it('does not render the dialog when open=false', () => {
    const { container } = render(DetailSheet, {
      props: { open: false, title: 'Lait', children: textSnippet('body') }
    });
    expect(container.textContent).not.toContain('Lait');
  });
});
```

- [ ] **Step 7.2: Run the test and verify it fails:**

Run: `npm test -- --run src/lib/components/ui/DetailSheet.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 7.3: Implement `DetailSheet.svelte`:**

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  import Modal from './Modal.svelte';

  let {
    open = $bindable(false),
    title,
    intro,
    onOpenChange,
    children
  }: {
    open?: boolean;
    title: string;
    intro?: string;
    onOpenChange?: (open: boolean) => void;
    children: Snippet;
  } = $props();
</script>

<Modal bind:open side="auto" {title} {onOpenChange} scrollableBody>
  {#if intro}
    <p class="text-sm text-ink-soft">{intro}</p>
  {/if}
  {@render children()}
</Modal>
```

- [ ] **Step 7.4: Run the test and verify it passes:**

Run: `npm test -- --run src/lib/components/ui/DetailSheet.test.ts`
Expected: PASS — 4 tests.

Note on the open=false case: bits-ui's `Dialog.Portal` renders nothing when closed, so the container text won't include the title. If happy-dom + bits-ui combination renders an empty portal node anyway, the `container.textContent` check may still pass because the title isn't in it. If the test fails because of portal mounting, switch the assertion to `expect(screen.queryByRole('dialog')).toBeNull()` instead.

- [ ] **Step 7.5: Run the full suite + lint:**

Run: `npm test -- --run`
Expected: green.

Run: `npm run lint`
Expected: green.

- [ ] **Step 7.6: Commit.**

```bash
git add src/lib/components/ui/DetailSheet.svelte src/lib/components/ui/DetailSheet.test.ts
git commit -m "feat(ui): add DetailSheet primitive (side=auto Modal + optional intro + scrollableBody)"
```

---

## Task 8: Extend `Button` with `pill` size

**Files:**

- Modify: `src/lib/components/ui/Button.svelte` (line 13, line 28-33)
- Modify: `src/lib/components/ui/Button.test.ts` (add cases)

**Context:** Audit UI #1: ~9 hand-rolled `rounded-full bg-primary px-4 py-3 text-sm font-bold` CTAs across bento, login/signup, AppShellBento. Add a `pill` size to absorb them. Pill is a _size_ (not a variant) so it composes with any color variant (`default`, `tile-mint`, `tile-peach`, …). The pill size string overrides the base `rounded-lg`/`font-medium` via Tailwind's last-wins cascade.

- [ ] **Step 8.1: Add the failing tests** to `Button.test.ts` (append at the end of the `describe('Button', ...)` block, before the closing `});`):

```ts
it('applies the pill size class', () => {
  render(Button, { props: { size: 'pill', children: text('Noter') } });
  const btn = screen.getByRole('button');
  expect(btn.className).toContain('rounded-full');
  expect(btn.className).toContain('font-bold');
});

it('keeps the variant color when pill size is used', () => {
  render(Button, {
    props: { size: 'pill', variant: 'tile-mint', children: text('Noter') }
  });
  expect(screen.getByRole('button').className).toContain('bg-tile-mint');
});
```

- [ ] **Step 8.2: Run the test and verify it fails:**

Run: `npm test -- --run src/lib/components/ui/Button.test.ts`
Expected: the two new tests FAIL — `rounded-full` not in className (default size is `rounded-lg`).

- [ ] **Step 8.3: Extend the Size union and SIZES map** in `Button.svelte`:

Replace line 13:

```ts
export type Size = 'default' | 'sm' | 'lg' | 'icon';
```

with:

```ts
export type Size = 'default' | 'sm' | 'lg' | 'icon' | 'pill';
```

Replace lines 28-33 (the `SIZES` const):

```ts
const SIZES: Record<Size, string> = {
  default: 'h-10 px-4 py-2 text-sm',
  sm: 'h-9 px-3 text-sm',
  lg: 'h-12 px-6 text-base',
  icon: 'h-10 w-10',
  pill: 'h-11 px-5 text-sm font-bold rounded-full'
};
```

The `rounded-full` and `font-bold` in the pill class override the base's `rounded-lg` and `font-medium` because the size class is concatenated after the base via `cn(base, VARIANTS[variant], SIZES[size], className)`.

- [ ] **Step 8.4: Run the tests and verify they pass:**

Run: `npm test -- --run src/lib/components/ui/Button.test.ts`
Expected: all 11 cases PASS (9 existing + 2 new).

- [ ] **Step 8.5: Run the full suite + lint:**

Run: `npm test -- --run`
Expected: green (existing Button consumers unaffected).

Run: `npm run lint`
Expected: green.

- [ ] **Step 8.6: Commit.**

```bash
git add src/lib/components/ui/Button.svelte src/lib/components/ui/Button.test.ts
git commit -m "feat(ui): add pill size to Button"
```

---

## Task 9: Extend `SectionHeader` with `size` prop

**Files:**

- Modify: `src/lib/components/ui/SectionHeader.svelte`
- Modify: `src/lib/components/ui/SectionHeader.test.ts`

**Context:** Audit UI #6: 28 inline `text-xs|sm font-semibold uppercase tracking-wider text-ink-soft` labels recreated outside `SectionHeader` because the existing one is hardcoded to `text-sm` and the consumers want `text-xs`. Add a `size: 'sm' | 'md'` prop. **`sm` is the new value (text-xs, smaller), `md` is the current default (text-sm).** Default stays at `md` so existing 12 callsites are unaffected.

- [ ] **Step 9.1: Add the failing tests** to `SectionHeader.test.ts` (append before the closing `});`):

```ts
it('uses text-sm by default (size="md")', () => {
  const { container } = render(SectionHeader, { props: { children: textSnippet('X') } });
  expect(container.querySelector('h2')?.className).toContain('text-sm');
});

it('uses text-xs when size="sm"', () => {
  const { container } = render(SectionHeader, {
    props: { size: 'sm', children: textSnippet('X') }
  });
  expect(container.querySelector('h2')?.className).toContain('text-xs');
  expect(container.querySelector('h2')?.className).not.toContain('text-sm');
});
```

- [ ] **Step 9.2: Run the test and verify the new size="sm" test fails:**

Run: `npm test -- --run src/lib/components/ui/SectionHeader.test.ts`
Expected: 4 of 6 pass; the two new ones FAIL with size prop unknown / className not containing `text-xs`.

- [ ] **Step 9.3: Add the size prop** to `SectionHeader.svelte`. Replace the entire file:

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  type Tone = 'default' | 'destructive';
  type Size = 'sm' | 'md';

  let {
    as = 'h2',
    tone = 'default',
    size = 'md',
    class: className = '',
    id,
    children
  }: {
    as?: 'h2' | 'h3';
    tone?: Tone;
    size?: Size;
    class?: string;
    id?: string;
    children: Snippet;
  } = $props();

  const TONES: Record<Tone, string> = {
    default: 'text-ink-soft',
    destructive: 'text-destructive'
  };

  const SIZES: Record<Size, string> = {
    sm: 'text-xs',
    md: 'text-sm'
  };

  const baseClasses = 'mb-2 font-semibold uppercase tracking-wider';
</script>

{#if as === 'h3'}
  <h3 {id} class={cn(baseClasses, SIZES[size], TONES[tone], className)}>
    {@render children()}
  </h3>
{:else}
  <h2 {id} class={cn(baseClasses, SIZES[size], TONES[tone], className)}>
    {@render children()}
  </h2>
{/if}
```

- [ ] **Step 9.4: Run the tests and verify they pass:**

Run: `npm test -- --run src/lib/components/ui/SectionHeader.test.ts`
Expected: 6 cases PASS.

- [ ] **Step 9.5: Run the full suite + lint:**

Run: `npm test -- --run`
Expected: green.

Run: `npm run lint`
Expected: green.

- [ ] **Step 9.6: Commit.**

```bash
git add src/lib/components/ui/SectionHeader.svelte src/lib/components/ui/SectionHeader.test.ts
git commit -m "feat(ui): add size prop (sm|md) to SectionHeader"
```

---

## Task 10: Extend `Card` with `padding` prop

**Files:**

- Modify: `src/lib/components/ui/Card.svelte`
- Modify: `src/lib/components/ui/Card.test.ts`

**Context:** Audit honorable mention: 14 callsites do `<Card class="p-4">`, plus `Card class="p-3"` and `Card class="p-5"` variants. Add a `padding: 'sm' | 'md' | 'lg'` prop (3 / 4 / 5 units). Default is `undefined` (no padding) — keeps existing callsites unaffected. Bundle 2 will start migrating callsites.

- [ ] **Step 10.1: Add the failing tests** to `Card.test.ts`:

```ts
it('applies p-3 when padding="sm"', () => {
  const { container } = render(Card, {
    props: { padding: 'sm', children: textSnippet('X') }
  });
  expect(container.querySelector('div')?.className).toContain('p-3');
});

it('applies p-4 when padding="md"', () => {
  const { container } = render(Card, {
    props: { padding: 'md', children: textSnippet('X') }
  });
  expect(container.querySelector('div')?.className).toContain('p-4');
});

it('applies p-5 when padding="lg"', () => {
  const { container } = render(Card, {
    props: { padding: 'lg', children: textSnippet('X') }
  });
  expect(container.querySelector('div')?.className).toContain('p-5');
});

it('does not apply padding when padding prop is omitted', () => {
  const { container } = render(Card, { props: { children: textSnippet('X') } });
  const cls = container.querySelector('div')?.className ?? '';
  expect(cls).not.toMatch(/\bp-3\b|\bp-4\b|\bp-5\b/);
});
```

- [ ] **Step 10.2: Run the test and verify the new tests fail:**

Run: `npm test -- --run src/lib/components/ui/Card.test.ts`
Expected: existing 9 tests still pass; the 4 new ones FAIL (padding prop unknown).

- [ ] **Step 10.3: Add the padding prop** in `Card.svelte`. Replace the script block and the conditional render. Final file:

```svelte
<script lang="ts" module>
  export type Variant =
    | 'default'
    | 'surface'
    | 'tile-peach'
    | 'tile-mint'
    | 'tile-butter'
    | 'tile-sky'
    | 'tile-lilac';
  export type Padding = 'sm' | 'md' | 'lg';

  const VARIANTS: Record<Variant, string> = {
    default: 'bg-card text-card-foreground border-border shadow-card',
    surface: 'bg-surface text-foreground border-transparent shadow-soft',
    'tile-peach': 'bg-tile-peach text-tile-peach-foreground border-transparent shadow-soft',
    'tile-mint': 'bg-tile-mint text-tile-mint-foreground border-transparent shadow-soft',
    'tile-butter': 'bg-tile-butter text-tile-butter-foreground border-transparent shadow-soft',
    'tile-sky': 'bg-tile-sky text-tile-sky-foreground border-transparent shadow-soft',
    'tile-lilac': 'bg-tile-lilac text-tile-lilac-foreground border-transparent shadow-soft'
  };

  const PADDING: Record<Padding, string> = {
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-5'
  };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  let {
    as = 'div',
    variant = 'default',
    padding,
    class: className = '',
    id,
    'aria-label': ariaLabel,
    'aria-labelledby': ariaLabelledby,
    children
  }: {
    as?: 'div' | 'section' | 'article';
    variant?: Variant;
    padding?: Padding;
    class?: string;
    id?: string;
    'aria-label'?: string;
    'aria-labelledby'?: string;
    children?: Snippet;
  } = $props();

  const paddingClass = $derived(padding ? PADDING[padding] : '');
</script>

{#if as === 'section'}
  <section
    {id}
    class={cn('rounded-tile border', VARIANTS[variant], paddingClass, className)}
    aria-label={ariaLabel}
    aria-labelledby={ariaLabelledby}
  >
    {#if children}{@render children()}{/if}
  </section>
{:else if as === 'article'}
  <article
    {id}
    class={cn('rounded-tile border', VARIANTS[variant], paddingClass, className)}
    aria-label={ariaLabel}
    aria-labelledby={ariaLabelledby}
  >
    {#if children}{@render children()}{/if}
  </article>
{:else}
  <div
    {id}
    class={cn('rounded-tile border', VARIANTS[variant], paddingClass, className)}
    aria-label={ariaLabel}
    aria-labelledby={ariaLabelledby}
  >
    {#if children}{@render children()}{/if}
  </div>
{/if}
```

- [ ] **Step 10.4: Run the tests and verify they pass:**

Run: `npm test -- --run src/lib/components/ui/Card.test.ts`
Expected: 13 cases PASS (9 existing + 4 new).

- [ ] **Step 10.5: Run the full suite + lint:**

Run: `npm test -- --run`
Expected: green.

Run: `npm run lint`
Expected: green.

- [ ] **Step 10.6: Commit.**

```bash
git add src/lib/components/ui/Card.svelte src/lib/components/ui/Card.test.ts
git commit -m "feat(ui): add padding prop (sm|md|lg) to Card"
```

---

## Task 11: Refresh graphify + final verification + PR

**Context:** Per project memory, run `graphify update .` after code changes (AST-only, no API cost) to keep the graph fresh for future sessions. Then open the PR.

- [ ] **Step 11.1: Refresh the graph:**

Run: `graphify update .`
Expected: success; `graphify-out/manifest.json` updates with a new commit ref.

- [ ] **Step 11.2: Final full-suite check:**

Run: `npm test -- --run`
Expected: PASS, all suites.

Run: `npm run lint`
Expected: green.

Optional sanity: `npx svelte-check --tsconfig ./tsconfig.json` — typecheck across the project. Expected: 0 errors. (If `svelte-check` isn't on PATH, try `npm run check`.)

- [ ] **Step 11.3: Commit the graph refresh:**

```bash
git add graphify-out/
git commit -m "chore(graphify): refresh graph after Bundle 1 foundation primitives"
```

- [ ] **Step 11.4: Open the PR.**

Push the branch and open a PR titled "feat(ui): foundation primitives (Bundle 1 of simplification spec)".

PR body template (copy verbatim and fill in the commit hashes if you want, otherwise leave the bullet list):

```markdown
## Summary

Adds the missing UI primitives and extends three existing ones so subsequent simplification bundles can migrate ~25 forms, 7 amber callouts, 3 detail sheets, 2 confirm modals, and ~9 inline pill CTAs onto one source of truth.

Spec: `docs/superpowers/specs/2026-05-21-simplify-codebase-design.md` (Bundle 1).

New primitives:

- `Field` — Label + child input + optional hint/error wrapper.
- `Callout` — warning/info/success surfaces using `--warning` / `--tile-sky` / `--tile-mint` tokens.
- `CalloutCard` — extracted from `EmptyHint` rich-mode.
- `ConfirmModal` — center modal + form + optional text-confirm + optional password-confirm.
- `DetailSheet` + `SheetSection` — side=auto Modal with intro + h2 labeled sections.

Extensions:

- `Button` gains `size="pill"`.
- `SectionHeader` gains `size: 'sm' | 'md'` (default `md` preserves current behavior).
- `Card` gains `padding: 'sm' | 'md' | 'lg'` (optional; opt-in).

Shared paraglide keys added: `commonCancel`, `commonDelete`, `commonFirstName`, `commonPassword`, `commonRemove`, `commonSave`.

**No callsite migrations.** That's Bundle 2 / Bundle 3.

## Test plan

- [ ] `npm test -- --run` — all suites green
- [ ] `npm run lint` — green
- [ ] Spot-check `npx playwright test --grep @smoke` if available — no visual regression because no consumer was migrated
- [ ] `grep -E "commonCancel|commonDelete|commonFirstName|commonPassword|commonRemove|commonSave" src/lib/paraglide/messages/fr.js` returns 6 hits

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

---

## Self-review checklist (run before declaring the plan ready)

- **Spec coverage:** Every Bundle 1 spec item (Field, ConfirmModal, Callout, DetailSheet, SheetSection, CalloutCard, Button pill, SectionHeader size, Card padding, 6 common keys) → Tasks 1-10. ✅
- **Acceptance criteria from the spec:** "All new primitives + 3 extensions land with vitest unit coverage" — Tasks 2-10 each include a `*.test.ts`. ✅ "No callsite migrations yet" — explicitly stated in the plan + the PR template. ✅ "`npm test` green" — verified at end of every task and again in Task 11. ✅
- **Type consistency:** `Variant` in `Button.svelte` is unchanged; `Size` adds `pill`. `Variant` in `Card.svelte` unchanged; `Padding` is new. `Variant` in `Callout.svelte` is new. `Size` in `SectionHeader.svelte` is new. No symbol used in a later task is undefined. ✅
- **No placeholders:** Each step shows real code, real commands, real expected output. ✅
- **Frequent commits:** 11 commits (one per task). ✅
- **TDD:** Each new component has a failing test first, then the implementation, then a passing test. ✅
- **DRY/YAGNI:** No primitive ships with props not used by an audited callsite (`Field` has no `type` prop because Input is a child; `Callout` has no icon prop per locked decision; `ConfirmModal` has no `cancelLabel` because the locked common key suffices). ✅

## Out of band

- After this PR merges, Bundle 2 (Visual coherence sweep) becomes unblocked. The next `writing-plans` invocation will produce a separate plan file using these primitives.

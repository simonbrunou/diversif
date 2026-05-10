# Foundation: Bento Tokens + shadcn-svelte Primitives — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the visual + primitive foundation for the Joyful Bento redesign — rewrite design tokens (light + dark), refresh brand assets, restyle the 8 existing UI primitives, and add 14 new primitives (Sheet, Drawer, Tabs, Toast, Tooltip, Popover, Switch, Checkbox, Progress, Avatar, Separator, Skeleton, ScrollArea, Command). At the end, the app builds, all existing tests pass, and the new primitives are ready to compose the redesigned shell in the next plan.

**Architecture:** Single-file Svelte 5 components in `src/lib/components/ui/<Name>.svelte`, importing from `bits-ui` (already installed) under the hood. CSS variables in `src/app.css` referenced through `tailwind.config.ts` extensions. The 71 existing imports of `$components/ui/<Name>.svelte` continue to work unchanged — we keep file paths and default exports stable.

**Tech Stack:** SvelteKit 2 · Svelte 5 (runes) · TailwindCSS 3 · bits-ui · Vitest + happy-dom + @testing-library/svelte · Playwright. No new runtime deps; `mode-watcher` and `svelte-sonner` may be added (small, MIT, established).

**Spec reference:** `docs/superpowers/specs/2026-05-10-ui-ux-redesign-design.md` — sections "Design tokens", "Component primitives", and migration phases 1 + 2.

---

## File Structure

### Created (new files)

| Path                                       | Purpose                                                                                      |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `src/lib/components/ui/Sheet.svelte`       | Bottom sheet (used by FAB log flow). Wraps `bits-ui` Dialog with mobile slide-up affordance. |
| `src/lib/components/ui/Sheet.test.ts`      | Render + close-button + a11y tests.                                                          |
| `src/lib/components/ui/Drawer.svelte`      | Side drawer (multi-child switcher, etc.).                                                    |
| `src/lib/components/ui/Drawer.test.ts`     | Render + close tests.                                                                        |
| `src/lib/components/ui/Tabs.svelte`        | Segmented tabs (Carnet segments). Wraps `bits-ui` Tabs.                                      |
| `src/lib/components/ui/Tabs.test.ts`       | Render + active-tab tests.                                                                   |
| `src/lib/components/ui/Toast.svelte`       | Toast root (sonner-svelte).                                                                  |
| `src/lib/components/ui/Toast.test.ts`      | Render test.                                                                                 |
| `src/lib/components/ui/Tooltip.svelte`     | Tooltip (bits-ui).                                                                           |
| `src/lib/components/ui/Tooltip.test.ts`    | Render test.                                                                                 |
| `src/lib/components/ui/Popover.svelte`     | Popover (bits-ui).                                                                           |
| `src/lib/components/ui/Popover.test.ts`    | Render test.                                                                                 |
| `src/lib/components/ui/Switch.svelte`      | Switch (bits-ui).                                                                            |
| `src/lib/components/ui/Switch.test.ts`     | Render + toggle tests.                                                                       |
| `src/lib/components/ui/Checkbox.svelte`    | Checkbox (bits-ui).                                                                          |
| `src/lib/components/ui/Checkbox.test.ts`   | Render + toggle tests.                                                                       |
| `src/lib/components/ui/Progress.svelte`    | Progress bar (bits-ui).                                                                      |
| `src/lib/components/ui/Progress.test.ts`   | Render + value tests.                                                                        |
| `src/lib/components/ui/Avatar.svelte`      | Avatar with initials fallback.                                                               |
| `src/lib/components/ui/Avatar.test.ts`     | Render + fallback tests.                                                                     |
| `src/lib/components/ui/Separator.svelte`   | Hairline separator.                                                                          |
| `src/lib/components/ui/Separator.test.ts`  | Render test.                                                                                 |
| `src/lib/components/ui/Skeleton.svelte`    | Loading skeleton (animated).                                                                 |
| `src/lib/components/ui/Skeleton.test.ts`   | Render test.                                                                                 |
| `src/lib/components/ui/ScrollArea.svelte`  | Scroll area (bits-ui).                                                                       |
| `src/lib/components/ui/ScrollArea.test.ts` | Render test.                                                                                 |
| `src/lib/components/ui/Command.svelte`     | Command palette (food search) wrapping a controlled list.                                    |
| `src/lib/components/ui/Command.test.ts`    | Render + filter tests.                                                                       |
| `src/lib/styles/tokens.test.ts`            | Sanity check that all token CSS variables are defined in both light and dark.                |
| `static/og-image.svg`                      | New OG image (peach gradient + bento mark). Replaces existing.                               |

### Modified

| Path                                     | Change                                                                                                                                                                      |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `package.json`                           | Add `svelte-sonner`, `mode-watcher` (optional; only if not present).                                                                                                        |
| `src/app.css`                            | Rewrite token block (light + dark) with bento palette, motion, reduced-motion.                                                                                              |
| `tailwind.config.ts`                     | Replace color extensions with bento tokens; add radius (`tile`, `hero`), shadow (`soft`, `lifted`, `glow`), motion (`ease-soft`, `ease-spring`, `ease-celebrate`, `dur-*`). |
| `src/app.html`                           | Update `<meta name="theme-color">` for new dark canvas.                                                                                                                     |
| `static/manifest.webmanifest`            | Update `background_color` and `theme_color` to new values.                                                                                                                  |
| `static/favicon.svg`                     | Replace with new abstract bento mark (sage/peach split).                                                                                                                    |
| `static/icons/icon-192.png`              | Regenerate from new SVG source.                                                                                                                                             |
| `static/icons/icon-512.png`              | Regenerate from new SVG source.                                                                                                                                             |
| `src/lib/components/ui/Button.svelte`    | Re-tokenize variant classes; add `tile-peach` / `tile-mint` etc. variants.                                                                                                  |
| `src/lib/components/ui/Button.test.ts`   | Update class-substring assertions for new token names.                                                                                                                      |
| `src/lib/components/ui/Card.svelte`      | Bento-aware variants (default white, `peach` / `butter` / `mint` / `sky` / `lilac` tile variants), new shadow tokens.                                                       |
| `src/lib/components/ui/Card.test.ts`     | Add variant tests.                                                                                                                                                          |
| `src/lib/components/ui/Badge.svelte`     | Tile-aligned variants.                                                                                                                                                      |
| `src/lib/components/ui/Badge.test.ts`    | Update assertions.                                                                                                                                                          |
| `src/lib/components/ui/Input.svelte`     | Cream surface, warm border, sage focus ring.                                                                                                                                |
| `src/lib/components/ui/Input.test.ts`    | Update assertions.                                                                                                                                                          |
| `src/lib/components/ui/Label.svelte`     | Caption typography.                                                                                                                                                         |
| `src/lib/components/ui/Label.test.ts`    | Update assertions.                                                                                                                                                          |
| `src/lib/components/ui/Dialog.svelte`    | Surface + radius-hero, motion via new tokens.                                                                                                                               |
| `src/lib/components/ui/Dialog.test.ts`   | Update assertions.                                                                                                                                                          |
| `src/lib/components/ui/Select.svelte`    | Cream surface, warm border.                                                                                                                                                 |
| `src/lib/components/ui/Select.test.ts`   | Update assertions.                                                                                                                                                          |
| `src/lib/components/ui/Textarea.svelte`  | Cream surface, warm border.                                                                                                                                                 |
| `src/lib/components/ui/Textarea.test.ts` | Update assertions.                                                                                                                                                          |

---

## Conventions

- **Test runner:** `npm test -- <pattern>` runs Vitest. Always pipe to `--reporter=verbose` if debugging.
- **Build verification:** `npm run check` after every multi-file change. `npm run lint` before every commit.
- **Commit cadence:** one commit per task. Conventional Commits style — `feat(tokens): ...`, `feat(ui): add Sheet primitive`, etc.
- **Token reference:** semantic CSS variables only — never literal hex inside components.
- **Class naming:** Tailwind classes via `cn()` from `$lib/utils/cn`. Existing pattern preserved.

---

## Task 1: Rewrite design tokens in `src/app.css`

**Files:**

- Modify: `src/app.css`

- [ ] **Step 1.1: Replace the `:root` token block (light theme)**

Open `src/app.css`. Replace the entire `@layer base { :root { … } }` block (lines 8–64 in current state) with the bento token set below. Keep the `@import` font lines and `@tailwind` directives at top untouched.

```css
@layer base {
  :root {
    /* canvas + surfaces */
    --canvas: 39 67% 97%; /* #fdfaf3 */
    --background: var(--canvas); /* alias for legacy bg-background usage */
    --foreground: 0 0% 10%;
    --surface: 0 0% 100%; /* white cards */
    --surface-2: 39 50% 91%; /* warm-50 — segmented tracks, raised tiles */

    --card: var(--surface);
    --card-foreground: var(--foreground);
    --popover: var(--surface);
    --popover-foreground: var(--foreground);

    --ink: var(--foreground);
    --ink-soft: 0 0% 32%;
    --muted: var(--surface-2);
    --muted-foreground: var(--ink-soft);

    --border: 39 36% 88%; /* warm-200 */
    --input: var(--border);
    --ring: 120 14% 49%; /* sage */

    /* primary brand */
    --primary: 120 14% 49%; /* sage #6b8e6b */
    --primary-foreground: 0 0% 100%;

    /* secondary / accent neutrals */
    --secondary: var(--surface-2);
    --secondary-foreground: var(--foreground);
    --accent: var(--surface-2);
    --accent-foreground: var(--foreground);

    /* tile palette */
    --tile-peach: 27 100% 87%;
    --tile-peach-foreground: 23 88% 22%;
    --tile-butter: 47 100% 84%;
    --tile-butter-foreground: 38 88% 23%;
    --tile-mint: 142 35% 84%;
    --tile-mint-foreground: 142 41% 21%;
    --tile-sky: 213 100% 89%;
    --tile-sky-foreground: 218 62% 26%;
    --tile-lilac: 257 100% 92%;
    --tile-lilac-foreground: 261 56% 27%;

    /* status (cheer-everywhere — coral reserved for severe only) */
    --success: var(--tile-mint);
    --success-foreground: var(--tile-mint-foreground);
    --warning: var(--tile-butter);
    --warning-foreground: var(--tile-butter-foreground);
    --info: var(--tile-sky);
    --info-foreground: var(--tile-sky-foreground);
    --severe: 14 100% 71%; /* coral #ff8a6b — appeler le 15 only */
    --severe-foreground: 0 0% 100%;
    --destructive: var(--severe);
    --destructive-foreground: var(--severe-foreground);

    /* reactions vocabulary (consumed by ReactionBadge / ReactionPicker) */
    --reaction-ras: var(--tile-mint);
    --reaction-ras-foreground: var(--tile-mint-foreground);
    --reaction-inconfort: var(--tile-butter);
    --reaction-inconfort-foreground: var(--tile-butter-foreground);
    --reaction-reaction: 23 80% 86%; /* soft peach — between butter and severe */
    --reaction-reaction-foreground: 23 88% 22%;

    /* celebrate (milestones) */
    --celebrate: var(--tile-butter);
    --celebrate-foreground: var(--tile-butter-foreground);

    /* radius */
    --radius: 0.875rem; /* 14px — lg */
    --radius-sm: 0.375rem;
    --radius-md: 0.625rem;
    --radius-lg: 0.875rem;
    --radius-tile: 1.125rem;
    --radius-hero: 1.5rem;

    /* spacing */
    --space-tile: 0.75rem;

    /* shadows */
    --shadow-sm: 0 1px 2px hsl(28 30% 20% / 0.06);
    --shadow-card: 0 6px 14px -2px hsl(28 30% 20% / 0.1), 0 2px 4px -1px hsl(28 30% 20% / 0.05);
    --shadow-soft: 0 8px 24px -8px hsl(28 50% 30% / 0.18);
    --shadow-lifted: 0 18px 36px -10px hsl(28 50% 30% / 0.22);
    --shadow-glow:
      0 0 0 4px hsl(47 100% 84%), 0 8px 20px -4px hsl(40 90% 50% / 0.4);

    /* motion */
    --ease-soft: cubic-bezier(0.32, 0.72, 0, 1);
    --ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1);
    --ease-celebrate: cubic-bezier(0.16, 1.6, 0.3, 1);
    --dur-fast: 120ms;
    --dur-base: 200ms;
    --dur-slow: 360ms;
    --dur-celebrate: 720ms;

    /* legacy aliases (delete after Plan 2 completes) */
    --motion-soft: var(--dur-base) var(--ease-soft);
    --motion-spring: var(--dur-slow) var(--ease-spring);
    --accent-peach: var(--tile-peach);
    --accent-butter: var(--tile-butter);
    --accent-mint: var(--tile-mint);
    --accent-sky: var(--tile-sky);
    --accent-lilac: var(--tile-lilac);
  }
```

- [ ] **Step 1.2: Replace the `.dark` block**

Replace the existing `.dark { … }` block with:

```css
.dark {
  --canvas: 38 13% 8%; /* #15130f — warm near-black */
  --background: var(--canvas);
  --foreground: 39 67% 91%; /* warm cream text */
  --surface: 38 12% 11%;
  --surface-2: 38 13% 14%;

  --card: var(--surface);
  --card-foreground: var(--foreground);
  --popover: var(--surface);
  --popover-foreground: var(--foreground);

  --ink: var(--foreground);
  --ink-soft: 39 20% 65%;
  --muted: var(--surface-2);
  --muted-foreground: var(--ink-soft);

  --border: 38 10% 18%;
  --input: var(--border);
  --ring: 120 14% 60%;

  --primary: 120 14% 60%; /* sage lifted slightly for dark */
  --primary-foreground: 0 0% 100%;

  --secondary: var(--surface-2);
  --secondary-foreground: var(--foreground);
  --accent: var(--surface-2);
  --accent-foreground: var(--foreground);

  /* tile palette (deep tints, fg flips to the 200) */
  --tile-peach: 23 60% 18%;
  --tile-peach-foreground: 27 100% 87%;
  --tile-butter: 38 70% 19%;
  --tile-butter-foreground: 47 100% 84%;
  --tile-mint: 142 31% 17%;
  --tile-mint-foreground: 142 35% 84%;
  --tile-sky: 218 50% 20%;
  --tile-sky-foreground: 213 100% 89%;
  --tile-lilac: 261 40% 22%;
  --tile-lilac-foreground: 257 100% 92%;

  --success: var(--tile-mint);
  --success-foreground: var(--tile-mint-foreground);
  --warning: var(--tile-butter);
  --warning-foreground: var(--tile-butter-foreground);
  --info: var(--tile-sky);
  --info-foreground: var(--tile-sky-foreground);
  --severe: 14 100% 71%;
  --severe-foreground: 0 0% 100%;
  --destructive: var(--severe);
  --destructive-foreground: var(--severe-foreground);

  --reaction-ras: var(--tile-mint);
  --reaction-ras-foreground: var(--tile-mint-foreground);
  --reaction-inconfort: var(--tile-butter);
  --reaction-inconfort-foreground: var(--tile-butter-foreground);
  --reaction-reaction: 23 50% 22%;
  --reaction-reaction-foreground: 27 100% 87%;

  --celebrate: var(--tile-butter);
  --celebrate-foreground: var(--tile-butter-foreground);

  --shadow-sm: 0 1px 2px hsl(0 0% 0% / 0.4);
  --shadow-card: 0 6px 14px -2px hsl(0 0% 0% / 0.5), 0 2px 4px -1px hsl(0 0% 0% / 0.3);
  --shadow-soft: 0 8px 24px -8px hsl(0 0% 0% / 0.5);
  --shadow-lifted: 0 18px 36px -10px hsl(0 0% 0% / 0.6);
  --shadow-glow: 0 0 0 4px hsl(38 70% 19%), 0 8px 20px -4px hsl(40 90% 50% / 0.5);

  --accent-peach: var(--tile-peach);
  --accent-butter: var(--tile-butter);
  --accent-mint: var(--tile-mint);
  --accent-sky: var(--tile-sky);
  --accent-lilac: var(--tile-lilac);
}
```

- [ ] **Step 1.3: Add reduced-motion safeguard**

Inside `@layer base`, after the `.dark { … }` block but before the closing `}` of the layer, add:

```css
@media (prefers-reduced-motion: reduce) {
  :root,
  .dark {
    --ease-soft: linear;
    --ease-spring: linear;
    --ease-celebrate: linear;
    --dur-fast: 1ms;
    --dur-base: 1ms;
    --dur-slow: 1ms;
    --dur-celebrate: 1ms;
  }
}
```

- [ ] **Step 1.4: Run lint & format**

```bash
npm run format && npm run lint
```

Expected: prettier fixes whitespace; eslint passes with zero errors.

- [ ] **Step 1.5: Commit**

```bash
git add src/app.css
git commit -m "feat(tokens): bento palette + motion tokens (light + dark)"
```

---

## Task 2: Extend `tailwind.config.ts` with bento utilities

**Files:**

- Modify: `tailwind.config.ts`

- [ ] **Step 2.1: Replace the `extend` block**

Open `tailwind.config.ts`. Replace the entire `theme.extend` block with:

```ts
extend: {
  colors: {
    border: 'hsl(var(--border) / <alpha-value>)',
    input: 'hsl(var(--input) / <alpha-value>)',
    ring: 'hsl(var(--ring) / <alpha-value>)',
    background: 'hsl(var(--background) / <alpha-value>)',
    foreground: 'hsl(var(--foreground) / <alpha-value>)',

    canvas: 'hsl(var(--canvas) / <alpha-value>)',
    surface: {
      DEFAULT: 'hsl(var(--surface) / <alpha-value>)',
      2: 'hsl(var(--surface-2) / <alpha-value>)'
    },
    ink: {
      DEFAULT: 'hsl(var(--ink) / <alpha-value>)',
      soft: 'hsl(var(--ink-soft) / <alpha-value>)'
    },

    primary: {
      DEFAULT: 'hsl(var(--primary) / <alpha-value>)',
      foreground: 'hsl(var(--primary-foreground) / <alpha-value>)'
    },
    secondary: {
      DEFAULT: 'hsl(var(--secondary) / <alpha-value>)',
      foreground: 'hsl(var(--secondary-foreground) / <alpha-value>)'
    },
    muted: {
      DEFAULT: 'hsl(var(--muted) / <alpha-value>)',
      foreground: 'hsl(var(--muted-foreground) / <alpha-value>)'
    },
    accent: {
      DEFAULT: 'hsl(var(--accent) / <alpha-value>)',
      foreground: 'hsl(var(--accent-foreground) / <alpha-value>)',
      peach: 'hsl(var(--accent-peach) / <alpha-value>)',
      butter: 'hsl(var(--accent-butter) / <alpha-value>)',
      mint: 'hsl(var(--accent-mint) / <alpha-value>)',
      sky: 'hsl(var(--accent-sky) / <alpha-value>)',
      lilac: 'hsl(var(--accent-lilac) / <alpha-value>)'
    },
    popover: {
      DEFAULT: 'hsl(var(--popover) / <alpha-value>)',
      foreground: 'hsl(var(--popover-foreground) / <alpha-value>)'
    },
    card: {
      DEFAULT: 'hsl(var(--card) / <alpha-value>)',
      foreground: 'hsl(var(--card-foreground) / <alpha-value>)'
    },
    tile: {
      peach: {
        DEFAULT: 'hsl(var(--tile-peach) / <alpha-value>)',
        foreground: 'hsl(var(--tile-peach-foreground) / <alpha-value>)'
      },
      butter: {
        DEFAULT: 'hsl(var(--tile-butter) / <alpha-value>)',
        foreground: 'hsl(var(--tile-butter-foreground) / <alpha-value>)'
      },
      mint: {
        DEFAULT: 'hsl(var(--tile-mint) / <alpha-value>)',
        foreground: 'hsl(var(--tile-mint-foreground) / <alpha-value>)'
      },
      sky: {
        DEFAULT: 'hsl(var(--tile-sky) / <alpha-value>)',
        foreground: 'hsl(var(--tile-sky-foreground) / <alpha-value>)'
      },
      lilac: {
        DEFAULT: 'hsl(var(--tile-lilac) / <alpha-value>)',
        foreground: 'hsl(var(--tile-lilac-foreground) / <alpha-value>)'
      }
    },
    success: {
      DEFAULT: 'hsl(var(--success) / <alpha-value>)',
      foreground: 'hsl(var(--success-foreground) / <alpha-value>)'
    },
    warning: {
      DEFAULT: 'hsl(var(--warning) / <alpha-value>)',
      foreground: 'hsl(var(--warning-foreground) / <alpha-value>)'
    },
    info: {
      DEFAULT: 'hsl(var(--info) / <alpha-value>)',
      foreground: 'hsl(var(--info-foreground) / <alpha-value>)'
    },
    severe: {
      DEFAULT: 'hsl(var(--severe) / <alpha-value>)',
      foreground: 'hsl(var(--severe-foreground) / <alpha-value>)'
    },
    destructive: {
      DEFAULT: 'hsl(var(--destructive) / <alpha-value>)',
      foreground: 'hsl(var(--destructive-foreground) / <alpha-value>)'
    },
    reaction: {
      ras: {
        DEFAULT: 'hsl(var(--reaction-ras) / <alpha-value>)',
        foreground: 'hsl(var(--reaction-ras-foreground) / <alpha-value>)'
      },
      inconfort: {
        DEFAULT: 'hsl(var(--reaction-inconfort) / <alpha-value>)',
        foreground: 'hsl(var(--reaction-inconfort-foreground) / <alpha-value>)'
      },
      reaction: {
        DEFAULT: 'hsl(var(--reaction-reaction) / <alpha-value>)',
        foreground: 'hsl(var(--reaction-reaction-foreground) / <alpha-value>)'
      }
    },
    celebrate: {
      DEFAULT: 'hsl(var(--celebrate) / <alpha-value>)',
      foreground: 'hsl(var(--celebrate-foreground) / <alpha-value>)'
    }
  },
  borderRadius: {
    xl: 'calc(var(--radius) + 4px)',
    lg: 'var(--radius-lg)',
    md: 'var(--radius-md)',
    sm: 'var(--radius-sm)',
    tile: 'var(--radius-tile)',
    hero: 'var(--radius-hero)'
  },
  boxShadow: {
    sm: 'var(--shadow-sm)',
    card: 'var(--shadow-card)',
    soft: 'var(--shadow-soft)',
    lifted: 'var(--shadow-lifted)',
    glow: 'var(--shadow-glow)'
  },
  transitionTimingFunction: {
    soft: 'var(--ease-soft)',
    spring: 'var(--ease-spring)',
    celebrate: 'var(--ease-celebrate)'
  },
  transitionDuration: {
    fast: 'var(--dur-fast)',
    base: 'var(--dur-base)',
    slow: 'var(--dur-slow)',
    celebrate: 'var(--dur-celebrate)'
  },
  fontFamily: {
    sans: [
      '"Inter Variable"',
      'Inter',
      'system-ui',
      '-apple-system',
      'BlinkMacSystemFont',
      'Segoe UI',
      'Roboto',
      'Helvetica Neue',
      'Arial',
      'sans-serif'
    ],
    display: ['"Fraunces Variable"', 'Fraunces', 'Georgia', 'serif']
  }
}
```

- [ ] **Step 2.2: Run typecheck + build to confirm config valid**

```bash
npm run check
```

Expected: `svelte-check` passes. If anything fails, the config has a syntax error.

- [ ] **Step 2.3: Commit**

```bash
git add tailwind.config.ts
git commit -m "feat(tokens): tailwind extensions for tile/radius/shadow/motion"
```

---

## Task 3: Token-presence sanity test

Catches regressions where someone deletes a token referenced elsewhere.

**Files:**

- Create: `src/lib/styles/tokens.test.ts`

- [ ] **Step 3.1: Write the test**

```ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../../app.css'), 'utf8');

const REQUIRED_TOKENS = [
  '--canvas',
  '--surface',
  '--surface-2',
  '--ink',
  '--ink-soft',
  '--border',
  '--ring',
  '--primary',
  '--primary-foreground',
  '--tile-peach',
  '--tile-peach-foreground',
  '--tile-butter',
  '--tile-butter-foreground',
  '--tile-mint',
  '--tile-mint-foreground',
  '--tile-sky',
  '--tile-sky-foreground',
  '--tile-lilac',
  '--tile-lilac-foreground',
  '--severe',
  '--severe-foreground',
  '--reaction-ras',
  '--reaction-inconfort',
  '--reaction-reaction',
  '--celebrate',
  '--radius-tile',
  '--radius-hero',
  '--shadow-card',
  '--shadow-soft',
  '--shadow-lifted',
  '--shadow-glow',
  '--ease-soft',
  '--ease-spring',
  '--ease-celebrate',
  '--dur-fast',
  '--dur-base',
  '--dur-slow',
  '--dur-celebrate'
];

describe('design tokens', () => {
  describe('light theme (:root)', () => {
    const root = css.match(/:root\s*\{([^}]+(?:\}[^}]*)*?)\}\s*\.dark/s);
    const block = root?.[1] ?? '';

    for (const token of REQUIRED_TOKENS) {
      it(`defines ${token}`, () => {
        expect(block).toMatch(new RegExp(`${token}\\s*:`));
      });
    }
  });

  describe('dark theme (.dark)', () => {
    const dark = css.match(/\.dark\s*\{([^}]+(?:\}[^}]*)*?)\}\s*@media/s);
    const block = dark?.[1] ?? '';

    // tile + brand tokens must be re-declared in dark; some can inherit.
    const DARK_REQUIRED = [
      '--canvas',
      '--surface',
      '--surface-2',
      '--ink-soft',
      '--border',
      '--primary',
      '--tile-peach',
      '--tile-peach-foreground',
      '--tile-butter',
      '--tile-mint',
      '--tile-sky',
      '--tile-lilac'
    ];
    for (const token of DARK_REQUIRED) {
      it(`re-declares ${token}`, () => {
        expect(block).toMatch(new RegExp(`${token}\\s*:`));
      });
    }
  });

  describe('reduced-motion safeguard', () => {
    it('flattens eases to linear', () => {
      expect(css).toMatch(/prefers-reduced-motion[^}]*--ease-soft\s*:\s*linear/s);
    });
    it('flattens durations to 1ms', () => {
      expect(css).toMatch(/prefers-reduced-motion[^}]*--dur-base\s*:\s*1ms/s);
    });
  });
});
```

- [ ] **Step 3.2: Run the test**

```bash
npm test -- src/lib/styles/tokens.test.ts
```

Expected: all tests pass (Tasks 1 + 2 already shipped the tokens this verifies).

- [ ] **Step 3.3: Commit**

```bash
git add src/lib/styles/tokens.test.ts
git commit -m "test(tokens): sanity check required tokens are defined in light + dark"
```

---

## Task 4: New brand mark — `static/favicon.svg`

**Files:**

- Modify: `static/favicon.svg`

- [ ] **Step 4.1: Replace the SVG**

Overwrite `static/favicon.svg` with:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="diversif">
  <defs>
    <clipPath id="r">
      <rect width="64" height="64" rx="14"/>
    </clipPath>
  </defs>
  <g clip-path="url(#r)">
    <rect width="64" height="64" fill="#6b8e6b"/>
    <path d="M64 0 L0 64 L64 64 Z" fill="#ffd9c0"/>
  </g>
</svg>
```

(Sage square; peach triangle filling the lower-right half; rounded corners.)

- [ ] **Step 4.2: Verify in browser**

```bash
npm run dev
```

Open `http://localhost:5173/favicon.svg`. Expected: 64×64 rounded square with sage upper-left and peach lower-right.

Stop the dev server (Ctrl-C) when done.

- [ ] **Step 4.3: Commit**

```bash
git add static/favicon.svg
git commit -m "feat(brand): bento mark — sage/peach split favicon"
```

---

## Task 5: Regenerate PNG icons from new SVG

**Files:**

- Modify: `static/icons/icon-192.png`, `static/icons/icon-512.png`

- [ ] **Step 5.1: Render PNGs from the SVG**

Use `npx sharp-cli` (no install required):

```bash
npx --yes @img/sharp-cli@latest \
  --input static/favicon.svg \
  --output static/icons/icon-192.png \
  resize 192 192

npx --yes @img/sharp-cli@latest \
  --input static/favicon.svg \
  --output static/icons/icon-512.png \
  resize 512 512
```

If those commands aren't available, fallback (requires ImageMagick): `magick -background none -density 600 static/favicon.svg -resize 192x192 static/icons/icon-192.png` (and repeat for 512).

- [ ] **Step 5.2: Verify file sizes**

```bash
file static/icons/icon-192.png static/icons/icon-512.png
```

Expected: `static/icons/icon-192.png: PNG image data, 192 x 192, 8-bit/color RGBA …` and `… 512 x 512 …`.

- [ ] **Step 5.3: Commit**

```bash
git add static/icons/icon-192.png static/icons/icon-512.png
git commit -m "feat(brand): regenerate PWA icons from new bento mark"
```

---

## Task 6: New OG image — `static/og-image.svg`

**Files:**

- Create: `static/og-image.svg` (replaces existing)

- [ ] **Step 6.1: Inspect current OG image**

```bash
cat static/og-image.svg | head -20
```

Note its `viewBox` (typically `0 0 1200 630`). Keep the same `viewBox` so social-network embeds don't reflow.

- [ ] **Step 6.2: Write the new OG image**

Overwrite `static/og-image.svg` with:

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" role="img" aria-label="Diversif — diversifier en confiance">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#ffd9c0"/>
      <stop offset="60%" stop-color="#ffeeb0"/>
      <stop offset="100%" stop-color="#fdfaf3"/>
    </linearGradient>
    <clipPath id="mark">
      <rect x="80" y="220" width="200" height="200" rx="44"/>
    </clipPath>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <g clip-path="url(#mark)">
    <rect x="80" y="220" width="200" height="200" fill="#6b8e6b"/>
    <path d="M280 220 L80 420 L280 420 Z" fill="#ffd9c0"/>
  </g>
  <text x="320" y="320" font-family="Fraunces, Georgia, serif" font-style="italic" font-size="84" font-weight="500" fill="#1f3e1a">
    Diversifier
  </text>
  <text x="320" y="412" font-family="Fraunces, Georgia, serif" font-style="italic" font-size="84" font-weight="500" fill="#1f3e1a">
    en confiance.
  </text>
  <text x="80" y="560" font-family="Inter, system-ui, sans-serif" font-size="28" font-weight="500" fill="#3e2a14" letter-spacing="2">
    Suivi quotidien · sourcé HCSP, ESPGHAN, EAT, LEAP
  </text>
</svg>
```

- [ ] **Step 6.3: Commit**

```bash
git add static/og-image.svg
git commit -m "feat(brand): OG image with bento mark + warm gradient"
```

---

## Task 7: Update `src/app.html` theme-color

**Files:**

- Modify: `src/app.html`

- [ ] **Step 7.1: Replace the dark theme-color value**

In `src/app.html`, change:

```html
<meta name="theme-color" content="#1e1e2e" media="(prefers-color-scheme: dark)" />
```

to:

```html
<meta name="theme-color" content="#15130f" media="(prefers-color-scheme: dark)" />
```

(The light value `#6b8e6b` already matches the new sage primary — leave unchanged.)

- [ ] **Step 7.2: Update mask-icon color comment is already `#6b8e6b`**

Verify line 18 `<link rel="mask-icon" href="…" color="#6b8e6b" />` is unchanged. No edit needed.

- [ ] **Step 7.3: Commit**

```bash
git add src/app.html
git commit -m "feat(chrome): theme-color matches new dark canvas"
```

---

## Task 8: Update `static/manifest.webmanifest`

**Files:**

- Modify: `static/manifest.webmanifest`

- [ ] **Step 8.1: Update colors**

Open `static/manifest.webmanifest`. Change:

```json
"background_color": "#fafaf7",
"theme_color": "#6b8e6b",
```

to:

```json
"background_color": "#fdfaf3",
"theme_color": "#6b8e6b",
```

(theme_color stays sage; only background_color updates to the new cream.)

- [ ] **Step 8.2: Commit**

```bash
git add static/manifest.webmanifest
git commit -m "feat(pwa): manifest background_color matches cream canvas"
```

---

## Task 9: Phase 1 smoke test

Confirms the foundation work didn't break the running app.

- [ ] **Step 9.1: Run lint + typecheck + tests + build**

```bash
npm run lint && npm run check && npm test && npm run build
```

Expected: all four green. Existing 200+ tests pass; build succeeds. If any class name was renamed in `tailwind.config.ts` that a component still uses (e.g., `bg-accent-peach` removed without a fallback), the build will fail — track it down by grep, add a fallback alias in the config, and re-run.

- [ ] **Step 9.2: Visually smoke-test the dev server**

```bash
npm run dev
```

Open `http://localhost:5173`, then `/login`, `/account`. Confirm:

- App still loads.
- No console errors.
- Cream canvas is visible (background should be `#fdfaf3`-ish, not the previous lavender-tinted Catppuccin Latte).
- Sage primary buttons still look sage.

Stop the server.

- [ ] **Step 9.3: Tag end of Phase 1**

```bash
git tag bento-foundation-phase1
```

---

## Task 10: Restyle `Button.svelte`

**Files:**

- Modify: `src/lib/components/ui/Button.svelte`, `src/lib/components/ui/Button.test.ts`

- [ ] **Step 10.1: Update the variant table**

Replace the `VARIANTS` const in `src/lib/components/ui/Button.svelte` with:

```ts
const VARIANTS: Record<Variant, string> = {
  default: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-card',
  secondary: 'bg-surface-2 text-foreground hover:bg-surface-2/80',
  outline: 'border border-input bg-surface hover:bg-surface-2 text-foreground',
  ghost: 'hover:bg-surface-2 text-foreground',
  destructive: 'bg-severe text-severe-foreground hover:bg-severe/90 shadow-card',
  // bento tile-tinted action buttons (used inside hero / suggestion cards)
  'tile-peach': 'bg-tile-peach text-tile-peach-foreground hover:bg-tile-peach/90',
  'tile-mint': 'bg-tile-mint text-tile-mint-foreground hover:bg-tile-mint/90',
  'tile-butter': 'bg-tile-butter text-tile-butter-foreground hover:bg-tile-butter/90',
  'tile-sky': 'bg-tile-sky text-tile-sky-foreground hover:bg-tile-sky/90',
  'tile-lilac': 'bg-tile-lilac text-tile-lilac-foreground hover:bg-tile-lilac/90'
};
```

- [ ] **Step 10.2: Extend the `Variant` type**

In the same file, update the type union:

```ts
export type Variant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'tile-peach'
  | 'tile-mint'
  | 'tile-butter'
  | 'tile-sky'
  | 'tile-lilac';
```

- [ ] **Step 10.3: Update the `base` class string**

Replace the `base` constant with:

```ts
const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-colors duration-base ease-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
```

(Changed `rounded-md` → `rounded-lg`; added `duration-base ease-soft` for the new motion tokens.)

- [ ] **Step 10.4: Update Button.test.ts variant assertion**

In `src/lib/components/ui/Button.test.ts`, replace the existing `applies the variant class` test with:

```ts
it('applies the variant class', () => {
  render(Button, { props: { variant: 'destructive', children: text('X') } });
  expect(screen.getByRole('button').className).toContain('bg-severe');
});

it('applies a tile variant', () => {
  render(Button, { props: { variant: 'tile-peach', children: text('X') } });
  expect(screen.getByRole('button').className).toContain('bg-tile-peach');
});
```

- [ ] **Step 10.5: Run the tests**

```bash
npm test -- src/lib/components/ui/Button.test.ts
```

Expected: 9 tests pass.

- [ ] **Step 10.6: Commit**

```bash
git add src/lib/components/ui/Button.svelte src/lib/components/ui/Button.test.ts
git commit -m "feat(ui): bento Button variants (sage primary + tile tints)"
```

---

## Task 11: Restyle `Card.svelte`

**Files:**

- Modify: `src/lib/components/ui/Card.svelte`, `src/lib/components/ui/Card.test.ts`

- [ ] **Step 11.1: Add bento variants to Card**

Replace the contents of `src/lib/components/ui/Card.svelte` with:

```svelte
<script lang="ts" module>
  export type Variant =
    | 'default'
    | 'tile-peach'
    | 'tile-mint'
    | 'tile-butter'
    | 'tile-sky'
    | 'tile-lilac';

  const VARIANTS: Record<Variant, string> = {
    default: 'bg-card text-card-foreground border-border shadow-card',
    'tile-peach': 'bg-tile-peach text-tile-peach-foreground border-transparent',
    'tile-mint': 'bg-tile-mint text-tile-mint-foreground border-transparent',
    'tile-butter': 'bg-tile-butter text-tile-butter-foreground border-transparent',
    'tile-sky': 'bg-tile-sky text-tile-sky-foreground border-transparent',
    'tile-lilac': 'bg-tile-lilac text-tile-lilac-foreground border-transparent'
  };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  let {
    variant = 'default',
    class: className = '',
    children
  }: { variant?: Variant; class?: string; children?: Snippet } = $props();
</script>

<div class={cn('rounded-tile border', VARIANTS[variant], className)}>
  {#if children}{@render children()}{/if}
</div>
```

- [ ] **Step 11.2: Update Card.test.ts**

Replace the contents of `src/lib/components/ui/Card.test.ts` with:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Card from './Card.svelte';

afterEach(() => cleanup());

const text = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

describe('Card', () => {
  it('renders children', () => {
    render(Card, { props: { children: text('Hello') } });
    expect(screen.getByText('Hello')).toBeTruthy();
  });

  it('uses default variant when not specified', () => {
    const { container } = render(Card, { props: { children: text('X') } });
    expect(container.firstElementChild?.className).toContain('bg-card');
  });

  it.each<['tile-peach' | 'tile-mint' | 'tile-butter' | 'tile-sky' | 'tile-lilac', string]>([
    ['tile-peach', 'bg-tile-peach'],
    ['tile-mint', 'bg-tile-mint'],
    ['tile-butter', 'bg-tile-butter'],
    ['tile-sky', 'bg-tile-sky'],
    ['tile-lilac', 'bg-tile-lilac']
  ])('applies the %s variant', (variant, expected) => {
    const { container } = render(Card, { props: { variant, children: text('X') } });
    expect(container.firstElementChild?.className).toContain(expected);
  });

  it('merges custom class', () => {
    const { container } = render(Card, { props: { class: 'p-8', children: text('X') } });
    expect(container.firstElementChild?.className).toContain('p-8');
  });
});
```

- [ ] **Step 11.3: Run the tests**

```bash
npm test -- src/lib/components/ui/Card.test.ts
```

Expected: 8 tests pass.

- [ ] **Step 11.4: Commit**

```bash
git add src/lib/components/ui/Card.svelte src/lib/components/ui/Card.test.ts
git commit -m "feat(ui): bento Card variants (5 tile tints)"
```

---

## Task 12: Restyle `Badge.svelte`

**Files:**

- Modify: `src/lib/components/ui/Badge.svelte`, `src/lib/components/ui/Badge.test.ts`

- [ ] **Step 12.1: Replace Badge.svelte**

Replace contents of `src/lib/components/ui/Badge.svelte` with:

```svelte
<script lang="ts" module>
  export type Variant =
    | 'default'
    | 'secondary'
    | 'outline'
    | 'ras'
    | 'inconfort'
    | 'reaction'
    | 'severe';

  const VARIANTS: Record<Variant, string> = {
    default: 'bg-primary text-primary-foreground',
    secondary: 'bg-surface-2 text-foreground',
    outline: 'border border-border text-foreground',
    ras: 'bg-reaction-ras text-reaction-ras-foreground',
    inconfort: 'bg-reaction-inconfort text-reaction-inconfort-foreground',
    reaction: 'bg-reaction-reaction text-reaction-reaction-foreground',
    severe: 'bg-severe text-severe-foreground'
  };
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  let {
    variant = 'default',
    class: className = '',
    children
  }: { variant?: Variant; class?: string; children?: Snippet } = $props();
</script>

<span
  class={cn(
    'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
    VARIANTS[variant],
    className
  )}
>
  {#if children}{@render children()}{/if}
</span>
```

- [ ] **Step 12.2: Update Badge.test.ts**

Open `src/lib/components/ui/Badge.test.ts` and update any class-substring assertion that previously checked the destructive token. Replace the file with:

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Badge from './Badge.svelte';

afterEach(() => cleanup());

const text = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

describe('Badge', () => {
  it('renders children', () => {
    render(Badge, { props: { children: text('Hi') } });
    expect(screen.getByText('Hi')).toBeTruthy();
  });

  it('uses default variant', () => {
    const { container } = render(Badge, { props: { children: text('X') } });
    expect(container.firstElementChild?.className).toContain('bg-primary');
  });

  it.each<['ras' | 'inconfort' | 'reaction' | 'severe', string]>([
    ['ras', 'bg-reaction-ras'],
    ['inconfort', 'bg-reaction-inconfort'],
    ['reaction', 'bg-reaction-reaction'],
    ['severe', 'bg-severe']
  ])('applies the %s variant', (variant, expected) => {
    const { container } = render(Badge, { props: { variant, children: text('X') } });
    expect(container.firstElementChild?.className).toContain(expected);
  });
});
```

- [ ] **Step 12.3: Run tests**

```bash
npm test -- src/lib/components/ui/Badge.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 12.4: Commit**

```bash
git add src/lib/components/ui/Badge.svelte src/lib/components/ui/Badge.test.ts
git commit -m "feat(ui): bento Badge variants (reactions vocabulary)"
```

---

## Task 13: Restyle `Input.svelte`

**Files:**

- Modify: `src/lib/components/ui/Input.svelte`

- [ ] **Step 13.1: Update class string**

Open `src/lib/components/ui/Input.svelte`. Replace the input's class string (the long `cn()` argument) with:

```ts
'flex h-11 w-full rounded-lg border-2 border-border bg-canvas px-4 py-2 text-sm text-foreground transition-colors duration-base ease-soft placeholder:text-ink-soft focus-visible:outline-none focus-visible:border-primary focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50';
```

(Switches from `bg-background` to `bg-canvas`, single-pixel border to `border-2`, sage focus border instead of ring, larger height for thumb-friendly tap targets.)

- [ ] **Step 13.2: Run existing test**

```bash
npm test -- src/lib/components/ui/Input.test.ts
```

If a test asserts `border-input`, update it to `border-border`. Re-run.

- [ ] **Step 13.3: Commit**

```bash
git add src/lib/components/ui/Input.svelte src/lib/components/ui/Input.test.ts
git commit -m "feat(ui): bento Input — cream surface, sage focus border"
```

---

## Task 14: Restyle `Label.svelte`

**Files:**

- Modify: `src/lib/components/ui/Label.svelte`

- [ ] **Step 14.1: Update class string**

In `src/lib/components/ui/Label.svelte`, replace its label class string with:

```ts
'text-xs font-semibold uppercase tracking-wider text-ink-soft peer-disabled:cursor-not-allowed peer-disabled:opacity-70';
```

(Caption-style label per the spec — 11px equivalent, uppercase, tracked.)

- [ ] **Step 14.2: Run tests**

```bash
npm test -- src/lib/components/ui/Label.test.ts
```

Expected: pass after any class-substring assertion is updated to `tracking-wider` or `text-ink-soft` (depending on what the test currently checks).

- [ ] **Step 14.3: Commit**

```bash
git add src/lib/components/ui/Label.svelte src/lib/components/ui/Label.test.ts
git commit -m "feat(ui): bento Label — caption typography"
```

---

## Task 15: Restyle `Dialog.svelte`

**Files:**

- Modify: `src/lib/components/ui/Dialog.svelte`

- [ ] **Step 15.1: Update overlay + content class strings**

Open `src/lib/components/ui/Dialog.svelte`. Find the dialog overlay class — replace with:

```ts
'fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0';
```

Find the dialog content class — replace with:

```ts
'fixed left-1/2 top-1/2 z-50 grid w-full max-w-lg -translate-x-1/2 -translate-y-1/2 gap-4 rounded-hero border border-border bg-surface p-6 shadow-lifted duration-slow ease-spring';
```

(Hero radius, surface white, lifted shadow, spring motion.)

- [ ] **Step 15.2: Run tests**

```bash
npm test -- src/lib/components/ui/Dialog.test.ts
```

Update any class-substring assertions to match.

- [ ] **Step 15.3: Commit**

```bash
git add src/lib/components/ui/Dialog.svelte src/lib/components/ui/Dialog.test.ts
git commit -m "feat(ui): bento Dialog — hero radius, lifted shadow, spring motion"
```

---

## Task 16: Restyle `Select.svelte`

**Files:**

- Modify: `src/lib/components/ui/Select.svelte`

- [ ] **Step 16.1: Update trigger + content class strings**

In `src/lib/components/ui/Select.svelte`, update the trigger class to:

```ts
'flex h-11 w-full items-center justify-between rounded-lg border-2 border-border bg-canvas px-4 py-2 text-sm text-foreground transition-colors duration-base ease-soft placeholder:text-ink-soft focus-visible:outline-none focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50';
```

Update the content (popover) class to:

```ts
'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-soft';
```

- [ ] **Step 16.2: Run tests**

```bash
npm test -- src/lib/components/ui/Select.test.ts
```

Update class-substring assertions if any fail.

- [ ] **Step 16.3: Commit**

```bash
git add src/lib/components/ui/Select.svelte src/lib/components/ui/Select.test.ts
git commit -m "feat(ui): bento Select — cream trigger, soft popover shadow"
```

---

## Task 17: Restyle `Textarea.svelte`

**Files:**

- Modify: `src/lib/components/ui/Textarea.svelte`

- [ ] **Step 17.1: Update class string**

In `src/lib/components/ui/Textarea.svelte`, replace its class string with:

```ts
'flex min-h-[88px] w-full rounded-lg border-2 border-border bg-canvas px-4 py-2 text-sm text-foreground transition-colors duration-base ease-soft placeholder:text-ink-soft focus-visible:outline-none focus-visible:border-primary disabled:cursor-not-allowed disabled:opacity-50';
```

- [ ] **Step 17.2: Run tests**

```bash
npm test -- src/lib/components/ui/Textarea.test.ts
```

- [ ] **Step 17.3: Commit**

```bash
git add src/lib/components/ui/Textarea.svelte src/lib/components/ui/Textarea.test.ts
git commit -m "feat(ui): bento Textarea — cream surface, sage focus border"
```

---

## Task 18: Add `Sheet.svelte` (bottom sheet)

The most-used new primitive — the FAB log flow opens this.

**Files:**

- Create: `src/lib/components/ui/Sheet.svelte`
- Create: `src/lib/components/ui/Sheet.test.ts`

- [ ] **Step 18.1: Write the test (failing)**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Sheet from './Sheet.svelte';

afterEach(() => cleanup());

const text = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    render(Sheet, { props: { open: false, children: text('content') } });
    expect(screen.queryByText('content')).toBeNull();
  });

  it('renders children when open', () => {
    render(Sheet, { props: { open: true, children: text('content') } });
    expect(screen.getByText('content')).toBeTruthy();
  });

  it('renders the drag grabber when open', () => {
    const { container } = render(Sheet, { props: { open: true, children: text('x') } });
    expect(container.querySelector('[data-sheet-grabber]')).not.toBeNull();
  });

  it('renders with role=dialog', () => {
    render(Sheet, { props: { open: true, children: text('x') } });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
```

- [ ] **Step 18.2: Run the test (expect FAIL)**

```bash
npm test -- src/lib/components/ui/Sheet.test.ts
```

Expected: FAIL — "Cannot find module './Sheet.svelte'".

- [ ] **Step 18.3: Implement Sheet.svelte**

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';

  type Props = {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    title?: string;
    description?: string;
    side?: 'bottom' | 'top';
    class?: string;
    children?: Snippet;
  };

  let {
    open = $bindable(false),
    onOpenChange,
    title,
    description,
    side = 'bottom',
    class: className = '',
    children
  }: Props = $props();

  const sideClasses = {
    bottom:
      'inset-x-0 bottom-0 max-h-[92dvh] rounded-t-hero data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
    top: 'inset-x-0 top-0 max-h-[92dvh] rounded-b-hero data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top'
  };
</script>

<DialogPrimitive.Root bind:open {onOpenChange}>
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <DialogPrimitive.Content
      class={cn(
        'fixed z-50 grid w-full gap-4 border border-border bg-surface p-5 pb-8 shadow-lifted duration-slow ease-spring data-[state=open]:animate-in data-[state=closed]:animate-out',
        sideClasses[side],
        className
      )}
    >
      {#if side === 'bottom'}
        <div data-sheet-grabber class="mx-auto h-1 w-9 rounded-full bg-border"></div>
      {/if}
      {#if title}
        <DialogPrimitive.Title class="font-display text-xl italic">
          {title}
        </DialogPrimitive.Title>
      {/if}
      {#if description}
        <DialogPrimitive.Description class="text-sm text-ink-soft">
          {description}
        </DialogPrimitive.Description>
      {/if}
      {#if children}{@render children()}{/if}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
</DialogPrimitive.Root>
```

- [ ] **Step 18.4: Run tests (expect PASS)**

```bash
npm test -- src/lib/components/ui/Sheet.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 18.5: Commit**

```bash
git add src/lib/components/ui/Sheet.svelte src/lib/components/ui/Sheet.test.ts
git commit -m "feat(ui): add Sheet primitive (bottom/top, used by FAB log flow)"
```

---

## Task 19: Add `Drawer.svelte` (side drawer)

**Files:**

- Create: `src/lib/components/ui/Drawer.svelte`
- Create: `src/lib/components/ui/Drawer.test.ts`

- [ ] **Step 19.1: Write the test**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Drawer from './Drawer.svelte';

afterEach(() => cleanup());

const text = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

describe('Drawer', () => {
  it('hides content when closed', () => {
    render(Drawer, { props: { open: false, children: text('panel') } });
    expect(screen.queryByText('panel')).toBeNull();
  });

  it('shows content when open', () => {
    render(Drawer, { props: { open: true, children: text('panel') } });
    expect(screen.getByText('panel')).toBeTruthy();
  });

  it('uses role=dialog', () => {
    render(Drawer, { props: { open: true, children: text('x') } });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});
```

- [ ] **Step 19.2: Run (expect FAIL)**

```bash
npm test -- src/lib/components/ui/Drawer.test.ts
```

- [ ] **Step 19.3: Implement Drawer.svelte**

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';

  type Props = {
    open: boolean;
    onOpenChange?: (open: boolean) => void;
    side?: 'left' | 'right';
    class?: string;
    children?: Snippet;
  };

  let {
    open = $bindable(false),
    onOpenChange,
    side = 'right',
    class: className = '',
    children
  }: Props = $props();

  const sideClasses = {
    left: 'inset-y-0 left-0 w-3/4 max-w-xs data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
    right:
      'inset-y-0 right-0 w-3/4 max-w-xs data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right'
  };
</script>

<DialogPrimitive.Root bind:open {onOpenChange}>
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out"
    />
    <DialogPrimitive.Content
      class={cn(
        'fixed z-50 flex h-full flex-col gap-4 border border-border bg-surface p-5 shadow-lifted duration-slow ease-spring data-[state=open]:animate-in data-[state=closed]:animate-out',
        sideClasses[side],
        className
      )}
    >
      {#if children}{@render children()}{/if}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
</DialogPrimitive.Root>
```

- [ ] **Step 19.4: Run (expect PASS), commit**

```bash
npm test -- src/lib/components/ui/Drawer.test.ts
git add src/lib/components/ui/Drawer.svelte src/lib/components/ui/Drawer.test.ts
git commit -m "feat(ui): add Drawer primitive (left/right side panel)"
```

---

## Task 20: Add `Tabs.svelte`

**Files:**

- Create: `src/lib/components/ui/Tabs.svelte`
- Create: `src/lib/components/ui/Tabs.test.ts`

- [ ] **Step 20.1: Write the test**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Tabs from './Tabs.svelte';

afterEach(() => cleanup());

const text = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

describe('Tabs', () => {
  it('renders tab labels and shows the default panel', () => {
    render(Tabs, {
      props: {
        value: 'one',
        items: [
          { value: 'one', label: 'One', panel: text('content one') },
          { value: 'two', label: 'Two', panel: text('content two') }
        ]
      }
    });
    expect(screen.getByText('One')).toBeTruthy();
    expect(screen.getByText('Two')).toBeTruthy();
    expect(screen.getByText('content one')).toBeTruthy();
  });
});
```

- [ ] **Step 20.2: Run (expect FAIL)**

```bash
npm test -- src/lib/components/ui/Tabs.test.ts
```

- [ ] **Step 20.3: Implement Tabs.svelte**

```svelte
<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type TabItem = {
    value: string;
    label: string;
    panel: Snippet;
  };
</script>

<script lang="ts">
  import { Tabs as TabsPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';

  type Props = {
    value: string;
    onValueChange?: (value: string) => void;
    items: TabItem[];
    class?: string;
  };

  let {
    value = $bindable(),
    onValueChange,
    items,
    class: className = ''
  }: Props = $props();
</script>

<TabsPrimitive.Root bind:value {onValueChange} class={cn('w-full', className)}>
  <TabsPrimitive.List
    class="inline-flex items-center gap-1 rounded-full bg-surface-2 p-1"
  >
    {#each items as item (item.value)}
      <TabsPrimitive.Trigger
        value={item.value}
        class="rounded-full px-3 py-1.5 text-xs font-semibold text-ink-soft transition-colors duration-base ease-soft data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-sm"
      >
        {item.label}
      </TabsPrimitive.Trigger>
    {/each}
  </TabsPrimitive.List>
  {#each items as item (item.value)}
    <TabsPrimitive.Content value={item.value} class="mt-4">
      {@render item.panel()}
    </TabsPrimitive.Content>
  {/each}
</TabsPrimitive.Root>
```

- [ ] **Step 20.4: Run, commit**

```bash
npm test -- src/lib/components/ui/Tabs.test.ts
git add src/lib/components/ui/Tabs.svelte src/lib/components/ui/Tabs.test.ts
git commit -m "feat(ui): add Tabs primitive (segmented pill control)"
```

---

## Task 21: Add `Toast.svelte` (Sonner)

**Files:**

- Modify: `package.json` (add `svelte-sonner`)
- Create: `src/lib/components/ui/Toast.svelte`
- Create: `src/lib/components/ui/Toast.test.ts`

- [ ] **Step 21.1: Install svelte-sonner**

```bash
npm install svelte-sonner@^0.3.28
```

- [ ] **Step 21.2: Write the test**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import Toast from './Toast.svelte';

afterEach(() => cleanup());

describe('Toast', () => {
  it('renders the Toaster region', () => {
    const { container } = render(Toast);
    expect(container.querySelector('[role="region"]') ?? container.firstElementChild).toBeTruthy();
  });
});
```

- [ ] **Step 21.3: Run (expect FAIL)**

```bash
npm test -- src/lib/components/ui/Toast.test.ts
```

- [ ] **Step 21.4: Implement Toast.svelte**

```svelte
<script lang="ts">
  import { Toaster, toast } from 'svelte-sonner';
  export { toast };
</script>

<Toaster
  position="top-center"
  richColors={false}
  closeButton
  toastOptions={{
    classes: {
      toast:
        'group rounded-lg border border-border bg-surface text-foreground shadow-soft',
      title: 'font-semibold text-sm',
      description: 'text-xs text-ink-soft',
      success: 'bg-success text-success-foreground border-transparent',
      info: 'bg-info text-info-foreground border-transparent',
      warning: 'bg-warning text-warning-foreground border-transparent',
      error: 'bg-severe text-severe-foreground border-transparent'
    }
  }}
/>
```

- [ ] **Step 21.5: Run, commit**

```bash
npm test -- src/lib/components/ui/Toast.test.ts
git add package.json package-lock.json src/lib/components/ui/Toast.svelte src/lib/components/ui/Toast.test.ts
git commit -m "feat(ui): add Toast primitive (svelte-sonner with bento tokens)"
```

---

## Task 22: Add `Tooltip.svelte`

**Files:**

- Create: `src/lib/components/ui/Tooltip.svelte`
- Create: `src/lib/components/ui/Tooltip.test.ts`

- [ ] **Step 22.1: Write the test**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Tooltip from './Tooltip.svelte';

afterEach(() => cleanup());

const text = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

describe('Tooltip', () => {
  it('renders the trigger child', () => {
    render(Tooltip, {
      props: {
        content: 'hello',
        children: text('button text')
      }
    });
    expect(screen.getByText('button text')).toBeTruthy();
  });
});
```

- [ ] **Step 22.2: Run (expect FAIL)**

```bash
npm test -- src/lib/components/ui/Tooltip.test.ts
```

- [ ] **Step 22.3: Implement Tooltip.svelte**

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Tooltip as TooltipPrimitive } from 'bits-ui';

  type Props = {
    content: string;
    delay?: number;
    children?: Snippet;
  };

  let { content, delay = 200, children }: Props = $props();
</script>

<TooltipPrimitive.Root delayDuration={delay}>
  <TooltipPrimitive.Trigger asChild>
    {#if children}{@render children()}{/if}
  </TooltipPrimitive.Trigger>
  <TooltipPrimitive.Content
    sideOffset={6}
    class="z-50 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground shadow-soft data-[state=delayed-open]:animate-in data-[state=closed]:animate-out"
  >
    {content}
  </TooltipPrimitive.Content>
</TooltipPrimitive.Root>
```

- [ ] **Step 22.4: Run, commit**

```bash
npm test -- src/lib/components/ui/Tooltip.test.ts
git add src/lib/components/ui/Tooltip.svelte src/lib/components/ui/Tooltip.test.ts
git commit -m "feat(ui): add Tooltip primitive"
```

---

## Task 23: Add `Popover.svelte`

**Files:**

- Create: `src/lib/components/ui/Popover.svelte`
- Create: `src/lib/components/ui/Popover.test.ts`

- [ ] **Step 23.1: Write the test**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Popover from './Popover.svelte';

afterEach(() => cleanup());

const text = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

describe('Popover', () => {
  it('renders content when open', () => {
    render(Popover, {
      props: {
        open: true,
        trigger: text('open me'),
        children: text('panel')
      }
    });
    expect(screen.getByText('panel')).toBeTruthy();
  });
});
```

- [ ] **Step 23.2: Run (expect FAIL)**

```bash
npm test -- src/lib/components/ui/Popover.test.ts
```

- [ ] **Step 23.3: Implement Popover.svelte**

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Popover as PopoverPrimitive } from 'bits-ui';

  type Props = {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    trigger?: Snippet;
    align?: 'start' | 'center' | 'end';
    children?: Snippet;
  };

  let {
    open = $bindable(false),
    onOpenChange,
    trigger,
    align = 'center',
    children
  }: Props = $props();
</script>

<PopoverPrimitive.Root bind:open {onOpenChange}>
  <PopoverPrimitive.Trigger asChild>
    {#if trigger}{@render trigger()}{/if}
  </PopoverPrimitive.Trigger>
  <PopoverPrimitive.Content
    {align}
    sideOffset={8}
    class="z-50 w-72 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-soft outline-none data-[state=open]:animate-in data-[state=closed]:animate-out"
  >
    {#if children}{@render children()}{/if}
  </PopoverPrimitive.Content>
</PopoverPrimitive.Root>
```

- [ ] **Step 23.4: Run, commit**

```bash
npm test -- src/lib/components/ui/Popover.test.ts
git add src/lib/components/ui/Popover.svelte src/lib/components/ui/Popover.test.ts
git commit -m "feat(ui): add Popover primitive"
```

---

## Task 24: Add `Switch.svelte`

**Files:**

- Create: `src/lib/components/ui/Switch.svelte`
- Create: `src/lib/components/ui/Switch.test.ts`

- [ ] **Step 24.1: Write the test**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/svelte';
import Switch from './Switch.svelte';

afterEach(() => cleanup());

describe('Switch', () => {
  it('renders with role=switch', () => {
    render(Switch, { props: { checked: false } });
    expect(screen.getByRole('switch')).toBeTruthy();
  });

  it('reflects checked state', () => {
    render(Switch, { props: { checked: true } });
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  it('fires onCheckedChange', async () => {
    const onCheckedChange = vi.fn();
    render(Switch, { props: { checked: false, onCheckedChange } });
    await fireEvent.click(screen.getByRole('switch'));
    expect(onCheckedChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 24.2: Run (expect FAIL)**

```bash
npm test -- src/lib/components/ui/Switch.test.ts
```

- [ ] **Step 24.3: Implement Switch.svelte**

```svelte
<script lang="ts">
  import { Switch as SwitchPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';

  type Props = {
    checked: boolean;
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
    class?: string;
    id?: string;
    'aria-label'?: string;
  };

  let {
    checked = $bindable(false),
    onCheckedChange,
    disabled = false,
    class: className = '',
    id,
    'aria-label': ariaLabel
  }: Props = $props();
</script>

<SwitchPrimitive.Root
  bind:checked
  {onCheckedChange}
  {disabled}
  {id}
  aria-label={ariaLabel}
  class={cn(
    'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-base ease-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-surface-2',
    className
  )}
>
  <SwitchPrimitive.Thumb
    class="pointer-events-none block h-5 w-5 rounded-full bg-surface shadow-sm ring-0 transition-transform duration-base ease-spring data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
  />
</SwitchPrimitive.Root>
```

- [ ] **Step 24.4: Run, commit**

```bash
npm test -- src/lib/components/ui/Switch.test.ts
git add src/lib/components/ui/Switch.svelte src/lib/components/ui/Switch.test.ts
git commit -m "feat(ui): add Switch primitive"
```

---

## Task 25: Add `Checkbox.svelte`

**Files:**

- Create: `src/lib/components/ui/Checkbox.svelte`
- Create: `src/lib/components/ui/Checkbox.test.ts`

- [ ] **Step 25.1: Write the test**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import Checkbox from './Checkbox.svelte';

afterEach(() => cleanup());

describe('Checkbox', () => {
  it('renders with role=checkbox', () => {
    render(Checkbox, { props: { checked: false } });
    expect(screen.getByRole('checkbox')).toBeTruthy();
  });

  it('reflects checked state', () => {
    render(Checkbox, { props: { checked: true } });
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('true');
  });
});
```

- [ ] **Step 25.2: Run (expect FAIL)**

```bash
npm test -- src/lib/components/ui/Checkbox.test.ts
```

- [ ] **Step 25.3: Implement Checkbox.svelte**

```svelte
<script lang="ts">
  import { Checkbox as CheckboxPrimitive } from 'bits-ui';
  import { Check, Minus } from 'lucide-svelte';
  import { cn } from '$lib/utils/cn';

  type Props = {
    checked: boolean | 'indeterminate';
    onCheckedChange?: (checked: boolean | 'indeterminate') => void;
    disabled?: boolean;
    class?: string;
    id?: string;
    'aria-label'?: string;
  };

  let {
    checked = $bindable(false),
    onCheckedChange,
    disabled = false,
    class: className = '',
    id,
    'aria-label': ariaLabel
  }: Props = $props();
</script>

<CheckboxPrimitive.Root
  bind:checked
  {onCheckedChange}
  {disabled}
  {id}
  aria-label={ariaLabel}
  class={cn(
    'peer h-5 w-5 shrink-0 rounded-sm border-2 border-border bg-surface ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:border-primary',
    className
  )}
>
  <CheckboxPrimitive.Indicator
    class="flex items-center justify-center text-current"
  >
    {#if checked === 'indeterminate'}
      <Minus class="h-3.5 w-3.5" />
    {:else}
      <Check class="h-3.5 w-3.5" />
    {/if}
  </CheckboxPrimitive.Indicator>
</CheckboxPrimitive.Root>
```

- [ ] **Step 25.4: Run, commit**

```bash
npm test -- src/lib/components/ui/Checkbox.test.ts
git add src/lib/components/ui/Checkbox.svelte src/lib/components/ui/Checkbox.test.ts
git commit -m "feat(ui): add Checkbox primitive"
```

---

## Task 26: Add `Progress.svelte`

**Files:**

- Create: `src/lib/components/ui/Progress.svelte`
- Create: `src/lib/components/ui/Progress.test.ts`

- [ ] **Step 26.1: Write the test**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import Progress from './Progress.svelte';

afterEach(() => cleanup());

describe('Progress', () => {
  it('renders with role=progressbar and value', () => {
    render(Progress, { props: { value: 47, max: 100 } });
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('47');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
  });
});
```

- [ ] **Step 26.2: Run (expect FAIL)**

```bash
npm test -- src/lib/components/ui/Progress.test.ts
```

- [ ] **Step 26.3: Implement Progress.svelte**

```svelte
<script lang="ts">
  import { Progress as ProgressPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';

  type Props = {
    value: number;
    max?: number;
    class?: string;
    indicatorClass?: string;
    'aria-label'?: string;
  };

  let {
    value,
    max = 100,
    class: className = '',
    indicatorClass = '',
    'aria-label': ariaLabel
  }: Props = $props();
</script>

<ProgressPrimitive.Root
  {value}
  {max}
  aria-label={ariaLabel}
  class={cn('relative h-2 w-full overflow-hidden rounded-full bg-surface-2', className)}
>
  <ProgressPrimitive.Indicator
    class={cn(
      'h-full bg-primary transition-transform duration-base ease-soft',
      indicatorClass
    )}
    style="transform: translateX(-{100 - (value / max) * 100}%)"
  />
</ProgressPrimitive.Root>
```

- [ ] **Step 26.4: Run, commit**

```bash
npm test -- src/lib/components/ui/Progress.test.ts
git add src/lib/components/ui/Progress.svelte src/lib/components/ui/Progress.test.ts
git commit -m "feat(ui): add Progress primitive"
```

---

## Task 27: Add `Avatar.svelte`

**Files:**

- Create: `src/lib/components/ui/Avatar.svelte`
- Create: `src/lib/components/ui/Avatar.test.ts`

- [ ] **Step 27.1: Write the test**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import Avatar from './Avatar.svelte';

afterEach(() => cleanup());

describe('Avatar', () => {
  it('renders the fallback initials when no src is given', () => {
    render(Avatar, { props: { fallback: 'LB' } });
    expect(screen.getByText('LB')).toBeTruthy();
  });

  it('renders an image when src is provided', () => {
    const { container } = render(Avatar, {
      props: { src: '/x.png', alt: 'pic', fallback: 'PI' }
    });
    expect(container.querySelector('img')).not.toBeNull();
  });
});
```

- [ ] **Step 27.2: Run (expect FAIL)**

```bash
npm test -- src/lib/components/ui/Avatar.test.ts
```

- [ ] **Step 27.3: Implement Avatar.svelte**

```svelte
<script lang="ts">
  import { Avatar as AvatarPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';

  type Props = {
    src?: string;
    alt?: string;
    fallback: string;
    size?: 'sm' | 'md' | 'lg';
    class?: string;
  };

  let { src, alt = '', fallback, size = 'md', class: className = '' }: Props = $props();

  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-base'
  };
</script>

<AvatarPrimitive.Root
  class={cn(
    'relative flex shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-tile-peach to-tile-butter ring-2 ring-surface',
    sizes[size],
    className
  )}
>
  {#if src}
    <AvatarPrimitive.Image {src} {alt} class="aspect-square h-full w-full object-cover" />
  {/if}
  <AvatarPrimitive.Fallback
    class="flex h-full w-full items-center justify-center bg-transparent font-semibold text-tile-peach-foreground"
  >
    {fallback}
  </AvatarPrimitive.Fallback>
</AvatarPrimitive.Root>
```

- [ ] **Step 27.4: Run, commit**

```bash
npm test -- src/lib/components/ui/Avatar.test.ts
git add src/lib/components/ui/Avatar.svelte src/lib/components/ui/Avatar.test.ts
git commit -m "feat(ui): add Avatar primitive (peach/butter gradient fallback)"
```

---

## Task 28: Add `Separator.svelte`

**Files:**

- Create: `src/lib/components/ui/Separator.svelte`
- Create: `src/lib/components/ui/Separator.test.ts`

- [ ] **Step 28.1: Write the test**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import Separator from './Separator.svelte';

afterEach(() => cleanup());

describe('Separator', () => {
  it('renders a horizontal separator by default', () => {
    const { container } = render(Separator);
    const sep = container.firstElementChild as HTMLElement;
    expect(sep.getAttribute('aria-orientation') ?? 'horizontal').toBe('horizontal');
  });

  it('renders vertical when orientation=vertical', () => {
    const { container } = render(Separator, { props: { orientation: 'vertical' } });
    const sep = container.firstElementChild as HTMLElement;
    expect(sep.className).toContain('w-px');
  });
});
```

- [ ] **Step 28.2: Run (expect FAIL)**

```bash
npm test -- src/lib/components/ui/Separator.test.ts
```

- [ ] **Step 28.3: Implement Separator.svelte**

```svelte
<script lang="ts">
  import { Separator as SeparatorPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';

  type Props = {
    orientation?: 'horizontal' | 'vertical';
    decorative?: boolean;
    class?: string;
  };

  let {
    orientation = 'horizontal',
    decorative = true,
    class: className = ''
  }: Props = $props();
</script>

<SeparatorPrimitive.Root
  {orientation}
  {decorative}
  class={cn(
    'shrink-0 bg-border',
    orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
    className
  )}
/>
```

- [ ] **Step 28.4: Run, commit**

```bash
npm test -- src/lib/components/ui/Separator.test.ts
git add src/lib/components/ui/Separator.svelte src/lib/components/ui/Separator.test.ts
git commit -m "feat(ui): add Separator primitive"
```

---

## Task 29: Add `Skeleton.svelte`

**Files:**

- Create: `src/lib/components/ui/Skeleton.svelte`
- Create: `src/lib/components/ui/Skeleton.test.ts`

- [ ] **Step 29.1: Write the test**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import Skeleton from './Skeleton.svelte';

afterEach(() => cleanup());

describe('Skeleton', () => {
  it('renders with the pulse class', () => {
    const { container } = render(Skeleton);
    expect(container.firstElementChild?.className).toContain('animate-pulse');
  });

  it('respects custom class', () => {
    const { container } = render(Skeleton, { props: { class: 'h-10 w-32' } });
    expect(container.firstElementChild?.className).toContain('h-10');
  });
});
```

- [ ] **Step 29.2: Run (expect FAIL)**

```bash
npm test -- src/lib/components/ui/Skeleton.test.ts
```

- [ ] **Step 29.3: Implement Skeleton.svelte**

```svelte
<script lang="ts">
  import { cn } from '$lib/utils/cn';

  let { class: className = '' }: { class?: string } = $props();
</script>

<div
  aria-hidden="true"
  class={cn('animate-pulse rounded-md bg-surface-2', className)}
></div>
```

- [ ] **Step 29.4: Run, commit**

```bash
npm test -- src/lib/components/ui/Skeleton.test.ts
git add src/lib/components/ui/Skeleton.svelte src/lib/components/ui/Skeleton.test.ts
git commit -m "feat(ui): add Skeleton primitive"
```

---

## Task 30: Add `ScrollArea.svelte`

**Files:**

- Create: `src/lib/components/ui/ScrollArea.svelte`
- Create: `src/lib/components/ui/ScrollArea.test.ts`

- [ ] **Step 30.1: Write the test**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import ScrollArea from './ScrollArea.svelte';

afterEach(() => cleanup());

const text = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

describe('ScrollArea', () => {
  it('renders children inside the viewport', () => {
    render(ScrollArea, { props: { children: text('payload') } });
    expect(screen.getByText('payload')).toBeTruthy();
  });
});
```

- [ ] **Step 30.2: Run (expect FAIL)**

```bash
npm test -- src/lib/components/ui/ScrollArea.test.ts
```

- [ ] **Step 30.3: Implement ScrollArea.svelte**

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ScrollArea as ScrollAreaPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';

  type Props = {
    class?: string;
    orientation?: 'vertical' | 'horizontal' | 'both';
    children?: Snippet;
  };

  let {
    class: className = '',
    orientation = 'vertical',
    children
  }: Props = $props();
</script>

<ScrollAreaPrimitive.Root class={cn('relative overflow-hidden', className)}>
  <ScrollAreaPrimitive.Viewport class="h-full w-full rounded-[inherit]">
    {#if children}{@render children()}{/if}
  </ScrollAreaPrimitive.Viewport>
  {#if orientation === 'vertical' || orientation === 'both'}
    <ScrollAreaPrimitive.Scrollbar
      orientation="vertical"
      class="flex touch-none select-none p-0.5 transition-colors duration-base"
    >
      <ScrollAreaPrimitive.Thumb class="relative flex-1 rounded-full bg-border" />
    </ScrollAreaPrimitive.Scrollbar>
  {/if}
  {#if orientation === 'horizontal' || orientation === 'both'}
    <ScrollAreaPrimitive.Scrollbar
      orientation="horizontal"
      class="flex h-2.5 touch-none select-none p-0.5"
    >
      <ScrollAreaPrimitive.Thumb class="relative rounded-full bg-border" />
    </ScrollAreaPrimitive.Scrollbar>
  {/if}
  <ScrollAreaPrimitive.Corner />
</ScrollAreaPrimitive.Root>
```

- [ ] **Step 30.4: Run, commit**

```bash
npm test -- src/lib/components/ui/ScrollArea.test.ts
git add src/lib/components/ui/ScrollArea.svelte src/lib/components/ui/ScrollArea.test.ts
git commit -m "feat(ui): add ScrollArea primitive"
```

---

## Task 31: Add `Command.svelte` (food search palette)

Used by the FAB log Sheet for fuzzy food search. Built on existing `FoodCombobox` keyboard semantics.

**Files:**

- Create: `src/lib/components/ui/Command.svelte`
- Create: `src/lib/components/ui/Command.test.ts`

- [ ] **Step 31.1: Write the test**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, fireEvent, screen, cleanup } from '@testing-library/svelte';
import Command from './Command.svelte';

afterEach(() => cleanup());

describe('Command', () => {
  const items = [
    { value: 'pear', label: 'Poire' },
    { value: 'apple', label: 'Pomme' },
    { value: 'banana', label: 'Banane' }
  ];

  it('renders all items initially', () => {
    render(Command, { props: { items, placeholder: '🔍 chercher' } });
    expect(screen.getByText('Poire')).toBeTruthy();
    expect(screen.getByText('Pomme')).toBeTruthy();
    expect(screen.getByText('Banane')).toBeTruthy();
  });

  it('filters items as the user types', async () => {
    render(Command, { props: { items, placeholder: '🔍' } });
    const input = screen.getByPlaceholderText('🔍') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'po' } });
    expect(screen.getByText('Poire')).toBeTruthy();
    expect(screen.getByText('Pomme')).toBeTruthy();
    expect(screen.queryByText('Banane')).toBeNull();
  });

  it('shows the empty state when no item matches', async () => {
    render(Command, { props: { items, placeholder: '🔍', emptyLabel: 'rien trouvé' } });
    const input = screen.getByPlaceholderText('🔍') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'xyz' } });
    expect(screen.getByText('rien trouvé')).toBeTruthy();
  });
});
```

- [ ] **Step 31.2: Run (expect FAIL)**

```bash
npm test -- src/lib/components/ui/Command.test.ts
```

- [ ] **Step 31.3: Implement Command.svelte**

```svelte
<script lang="ts" module>
  export type CommandItem = {
    value: string;
    label: string;
    hint?: string;
  };
</script>

<script lang="ts">
  import { Search } from 'lucide-svelte';
  import { fuzzyMatch } from '$lib/utils/search';
  import { cn } from '$lib/utils/cn';

  type Props = {
    items: CommandItem[];
    value?: string;
    onSelect?: (item: CommandItem) => void;
    placeholder?: string;
    emptyLabel?: string;
    class?: string;
  };

  let {
    items,
    value = $bindable(''),
    onSelect,
    placeholder = '',
    emptyLabel = 'Aucun résultat',
    class: className = ''
  }: Props = $props();

  let query = $state('');

  const filtered = $derived(
    query.trim() === ''
      ? items
      : items.filter((item) => fuzzyMatch(query, item.label))
  );

  function select(item: CommandItem) {
    value = item.value;
    onSelect?.(item);
  }
</script>

<div class={cn('flex flex-col rounded-lg border-2 border-border bg-canvas', className)}>
  <div class="flex items-center gap-2 border-b border-border px-4 py-3">
    <Search class="h-4 w-4 text-ink-soft" aria-hidden="true" />
    <input
      type="text"
      bind:value={query}
      {placeholder}
      class="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-ink-soft"
      autocomplete="off"
    />
  </div>
  <ul role="listbox" class="max-h-64 overflow-y-auto p-1">
    {#if filtered.length === 0}
      <li class="p-3 text-center text-sm text-ink-soft">{emptyLabel}</li>
    {:else}
      {#each filtered as item (item.value)}
        <li role="option" aria-selected={value === item.value}>
          <button
            type="button"
            onclick={() => select(item)}
            class="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-surface-2 aria-selected:bg-tile-peach aria-selected:text-tile-peach-foreground"
            aria-selected={value === item.value}
          >
            <span>{item.label}</span>
            {#if item.hint}
              <span class="text-xs text-ink-soft">{item.hint}</span>
            {/if}
          </button>
        </li>
      {/each}
    {/if}
  </ul>
</div>
```

- [ ] **Step 31.4: Run, commit**

```bash
npm test -- src/lib/components/ui/Command.test.ts
git add src/lib/components/ui/Command.svelte src/lib/components/ui/Command.test.ts
git commit -m "feat(ui): add Command primitive (food search with fuzzy match)"
```

---

## Task 32: Final smoke test (Phase 1 + 2 complete)

**Files:** None modified — only verification.

- [ ] **Step 32.1: Lint + typecheck + tests + build**

```bash
npm run lint && npm run check && npm test && npm run build
```

Expected: all four green. New primitives compile, all existing tests + new primitive tests pass (~250+ tests total), production build succeeds.

If `npm run check` complains about an unused `mode-watcher` or anything similar, remove the unused import.

- [ ] **Step 32.2: Run e2e smoke**

```bash
npm run test:e2e -- --grep "smoke"
```

Or if no smoke-tagged spec exists, run the auth-flow spec (existing):

```bash
npm run test:e2e -- e2e/auth.spec.ts
```

Expected: pass. The redesign hasn't touched route handlers or form actions, so e2e flows still complete.

- [ ] **Step 32.3: Manual visual check on dev server**

```bash
npm run dev
```

Open `http://localhost:5173`:

- Cream canvas background visible
- Sage primary buttons (sign-in CTA on `/login`)
- New favicon visible in browser tab
- Toggle the theme (top-right `ThemeToggle` if present, or system dark mode) — dark canvas should be a warm near-black, tiles should keep distinct hues

Stop the server.

- [ ] **Step 32.4: Tag end of foundation**

```bash
git tag bento-foundation-complete
```

- [ ] **Step 32.5: Push to origin**

```bash
git push origin main --tags
```

(Skip the push step if you prefer a PR — `git checkout -b feat/bento-foundation && git push -u origin feat/bento-foundation && gh pr create` instead.)

---

## End of plan

Foundation phase complete. Next plan: app shell (4-tab + FAB + multi-child header pill, log Sheet wired to existing form action).

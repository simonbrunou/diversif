/**
 * The type ramp, written once: the font sizes DESIGN.md's Typography >
 * Hierarchy section allows, and the pixel size of each Tailwind size name.
 *
 * scripts/lint-type-ramp.ts fails on any font size outside these steps, and
 * scripts/lint-contrast.ts reads FONT_SIZE_PX for its large-text threshold.
 * scripts/type-ramp.test.ts checks that each Hierarchy bullet in DESIGN.md
 * names the same classes as its step here, so change both together.
 */

/**
 * Pixel size of each Tailwind font-size name the app uses: Tailwind's own
 * scale, plus `2xs` and `3xs` from the `@theme` block of src/app.css (the
 * type-ramp lint checks those two against app.css).
 */
export const FONT_SIZE_PX: Readonly<Record<string, number>> = {
  '3xs': 10,
  '2xs': 11,
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48
};

export type RampStep = {
  /** The bold name of the step's bullet in DESIGN.md's Hierarchy section. */
  name: string;
  /** The classes that set it, as DESIGN.md writes them. */
  classes: readonly string[];
  /** Allowed only on an element whose class also holds `font-display`. */
  display?: true;
};

/**
 * Steps any element may use. An arbitrary `text-[Npx]` passes when N is the
 * pixel size of one of these steps, as `text-[28px]` does for Numeric.
 */
export const RAMP: readonly RampStep[] = [
  {
    name: 'Display',
    classes: ['text-xl', 'text-2xl', 'text-3xl', 'text-4xl', 'text-5xl'],
    display: true
  },
  { name: 'Headline', classes: ['text-2xl'] },
  { name: 'Section title', classes: ['text-xl'] },
  { name: 'Title', classes: ['text-sm'] },
  { name: 'Numeric', classes: ['text-[28px]'] },
  { name: 'Body', classes: ['text-sm'] },
  { name: 'Caption', classes: ['text-xs'] },
  { name: 'Label', classes: ['text-2xs'] }
];

export type ScopedSize = {
  /** The DESIGN.md Hierarchy bullet that names this use. */
  step: string;
  /** Repo-relative path of the one file where `cls` may appear. */
  file: string;
  /** The class exactly as written, variants included. */
  cls: string;
  /** How many times `file` writes `cls`: one more or one less fails the lint. */
  count: number;
  reason: string;
};

/**
 * Off-ramp sizes kept where DESIGN.md or the component names the role at that
 * size (the #365 review). Each holds in its own file only, at its count.
 */
export const SCOPED_SIZES: readonly ScopedSize[] = [
  {
    step: 'Large button',
    file: 'src/lib/components/ui/Button.svelte',
    cls: 'text-base',
    count: 1,
    reason: 'the label of the 48px `lg` size (DESIGN.md, Buttons)'
  },
  {
    step: 'Badge',
    file: 'src/routes/allergens/+page.svelte',
    cls: 'text-3xs',
    count: 1,
    reason: 'the timing badge beside each allergen'
  },
  {
    step: 'Badge',
    file: 'src/lib/components/guide/GuideAllergensSection.svelte',
    cls: 'text-3xs',
    count: 1,
    reason: 'the timing badge beside each allergen'
  },
  ...[
    'src/routes/guide/+page.svelte',
    'src/routes/sources/+page.svelte',
    'src/routes/allergens/+page.svelte'
  ].map((file): ScopedSize => ({
    step: 'Headline',
    file,
    cls: 'md:text-3xl',
    count: 1,
    reason: 'the page title of a long reference page steps up from md'
  }))
];

/** `text-xl` -> 20, `text-[28px]` -> 28, anything else -> undefined. */
export function classPx(cls: string): number | undefined {
  const arbitrary = /^text-\[(\d+(?:\.\d+)?)px\]$/.exec(cls);
  if (arbitrary) return Number(arbitrary[1]);
  const named = /^text-(.+)$/.exec(cls);
  return named ? FONT_SIZE_PX[named[1]] : undefined;
}

function stepPx(steps: readonly RampStep[]): Set<number> {
  return new Set(steps.flatMap((s) => s.classes.map((c) => classPx(c) ?? NaN)));
}

/** Pixel sizes any element may use. */
export const RAMP_PX: ReadonlySet<number> = stepPx(RAMP.filter((s) => !s.display));

/** Pixel sizes an element with `font-display` may use. */
export const DISPLAY_PX: ReadonlySet<number> = stepPx(RAMP.filter((s) => s.display));

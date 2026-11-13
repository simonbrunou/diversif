// scripts/type-ramp.ts and DESIGN.md's Typography > Hierarchy section name
// the same steps, with the same classes, and DESIGN.md's frontmatter gives
// each RAMP step a typography key at one of its sizes (#365).
import { describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import { DISPLAY_PX, RAMP, RAMP_PX, SCOPED_SIZES, classPx } from './type-ramp';

const design = fs.readFileSync(path.resolve(import.meta.dir, '../DESIGN.md'), 'utf8');

/** Each `- **Name** …` bullet of the Hierarchy section, with the size classes it names in backticks. */
function hierarchySteps(markdown: string): Record<string, string[]> {
  const section = /^### Hierarchy\n([\s\S]*?)^#{2,3} /m.exec(markdown)?.[1];
  if (section === undefined) throw new Error('DESIGN.md has no ### Hierarchy section');
  const steps: Record<string, string[]> = {};
  for (const [, name, body] of section.matchAll(/^- \*\*([^*]+)\*\* (.*)$/gm)) {
    const classes = [...body.matchAll(/`((?:[\w-]+:)*text-[^`\s]+)`/g)].map((m) => m[1]);
    steps[name] = [...new Set(classes)].sort();
  }
  return steps;
}

/** The steps of RAMP and SCOPED_SIZES, each with its classes. */
function moduleSteps(): Record<string, string[]> {
  const steps = new Map<string, Set<string>>();
  const add = (name: string, cls: string) =>
    steps.set(name, (steps.get(name) ?? new Set<string>()).add(cls));
  for (const s of RAMP) for (const c of s.classes) add(s.name, c);
  for (const s of SCOPED_SIZES) add(s.step, s.cls);
  return Object.fromEntries([...steps].map(([name, classes]) => [name, [...classes].sort()]));
}

/** Each `typography` key of the frontmatter, with its `fontSize` in px (rem only). */
function frontmatterSizes(markdown: string): Record<string, number> {
  const yaml = /^---\n([\s\S]*?)\n---\n/.exec(markdown)?.[1];
  if (yaml === undefined) throw new Error('DESIGN.md has no frontmatter');
  const { typography } = Bun.YAML.parse(yaml) as {
    typography: Record<string, { fontSize: string }>;
  };
  return Object.fromEntries(
    Object.entries(typography).map(([key, t]) => {
      const rem = /^(\d*\.?\d+)rem$/.exec(t.fontSize)?.[1];
      if (rem === undefined) throw new Error(`typography.${key}.fontSize is not in rem`);
      return [key, Number(rem) * 16];
    })
  );
}

/** Each RAMP step under its frontmatter key (the first word of its name, lowercased), with the px of its classes. */
function rampSizes(): Record<string, number[]> {
  return Object.fromEntries(
    RAMP.map((s) => [s.name.split(' ')[0].toLowerCase(), s.classes.map((c) => classPx(c) ?? NaN)])
  );
}

describe('the type ramp', () => {
  it('names the same steps and classes as DESIGN.md, Typography > Hierarchy', () => {
    expect(hierarchySteps(design)).toEqual(moduleSteps());
  });

  it('gives each RAMP step a DESIGN.md frontmatter typography key at one of its sizes', () => {
    const front = frontmatterSizes(design);
    const ramp = rampSizes();
    expect(Object.keys(front).sort()).toEqual(Object.keys(ramp).sort());
    for (const [key, px] of Object.entries(front)) {
      expect({ key, px, onStep: ramp[key].includes(px) }).toEqual({ key, px, onStep: true });
    }
  });

  it('reads the frontmatter typography sizes', () => {
    const markdown =
      "---\ntypography:\n  a:\n    fontSize: '.75rem'\n  b:\n    fontSize: '1.25rem'\n---\n";
    expect(frontmatterSizes(markdown)).toEqual({ a: 12, b: 20 });
    expect(() => frontmatterSizes("---\ntypography:\n  a:\n    fontSize: '12px'\n---\n")).toThrow(
      'typography.a.fontSize is not in rem'
    );
  });

  it('reads each bullet of the Hierarchy section', () => {
    const markdown =
      '### Hierarchy\n\nIntro with `text-lg`.\n\n- **A** (x, `text-sm`, `md:text-3xl`): `font-display` and `text-sm`.\n- **B** (y): none.\n\n### Next\n\n- **C** (`text-xl`)\n';
    expect(hierarchySteps(markdown)).toEqual({ A: ['md:text-3xl', 'text-sm'], B: [] });
  });

  it('resolves every class of every step to its px', () => {
    for (const s of RAMP)
      for (const c of s.classes) expect([c, classPx(c)]).not.toEqual([c, undefined]);
    expect(classPx('text-[28px]')).toBe(28);
    expect(classPx('text-left')).toBeUndefined();
    expect([...RAMP_PX].sort((a, b) => a - b)).toEqual([11, 12, 14, 20, 24, 28]);
    expect([...DISPLAY_PX].sort((a, b) => a - b)).toEqual([20, 24, 30, 36, 48]);
  });

  it('keeps each scoped use to one file and a positive count', () => {
    const keys = SCOPED_SIZES.map((s) => `${s.file} ${s.cls}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const s of SCOPED_SIZES) {
      expect(fs.existsSync(path.resolve(import.meta.dir, '..', s.file))).toBe(true);
      expect(s.count).toBeGreaterThan(0);
    }
  });
});

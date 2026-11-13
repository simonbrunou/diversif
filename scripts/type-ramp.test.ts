// scripts/type-ramp.ts and DESIGN.md's Typography > Hierarchy section name
// the same steps, with the same classes (#365).
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

describe('the type ramp', () => {
  it('names the same steps and classes as DESIGN.md, Typography > Hierarchy', () => {
    expect(hierarchySteps(design)).toEqual(moduleSteps());
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

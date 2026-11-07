import { describe, expect, it } from 'bun:test';
import { ALLERGENS } from '#lib/utils/allergens.js';
import { CATEGORIES } from '#lib/utils/categories.js';
import {
  ALLERGEN_GUIDANCE,
  CATEGORY_GUIDANCE,
  KEY_PRINCIPLES,
  STAGES,
  TIPS,
  TEXTURE_PROGRESSION,
  FORBIDDEN_FOODS,
  REACTION_GUIDANCE,
  APPROACHES,
  getStageForAgeMonths,
  getTipsFor,
  pickRotatingTip
} from './guidance';
import * as guidance from './guidance';
import { ALL_SOURCE_IDS, SOURCES } from './sources';
import { stageRange } from './stage-range';

describe('content invariants', () => {
  it('every allergen has a guidance entry', () => {
    for (const a of ALLERGENS) {
      expect(ALLERGEN_GUIDANCE[a.id], `missing guidance for allergen ${a.id}`).toBeDefined();
    }
  });

  it('every category has a guidance entry', () => {
    for (const c of CATEGORIES) {
      expect(CATEGORY_GUIDANCE[c.id], `missing guidance for category ${c.id}`).toBeDefined();
    }
  });

  it('every source ID referenced is reachable', () => {
    const refs = new Set<string>();
    for (const p of KEY_PRINCIPLES) p.sources.forEach((s) => refs.add(s));
    for (const s of STAGES) s.sources.forEach((id) => refs.add(id));
    for (const a of Object.values(ALLERGEN_GUIDANCE)) a.sources.forEach((s) => refs.add(s));
    for (const c of Object.values(CATEGORY_GUIDANCE)) c.sources.forEach((s) => refs.add(s));
    for (const f of FORBIDDEN_FOODS) f.sources.forEach((s) => refs.add(s));
    for (const t of TIPS) t.sources?.forEach((s) => refs.add(s));
    for (const a of Object.values(APPROACHES)) a.sources.forEach((s) => refs.add(s));

    for (const id of refs) {
      expect(ALL_SOURCE_IDS.includes(id as keyof typeof SOURCES), `unknown source id: ${id}`).toBe(
        true
      );
    }
  });

  it('every stage covers required keys', () => {
    expect(STAGES.length).toBe(4);
    for (const s of STAGES) {
      expect(s.principles.length).toBeGreaterThanOrEqual(2);
      expect(s.focus.length).toBeGreaterThanOrEqual(2);
      expect(s.textures.length).toBeGreaterThan(0);
      expect(s.milkTarget.length).toBeGreaterThan(0);
      expect(s.sources.length).toBeGreaterThan(0);
    }
  });

  // The guide's badge and Aujourd'hui's stage card print stageRange(); the
  // title they sit beside or link to must name the same range.
  it('every stage title opens with the range its badge and reminder print', () => {
    expect(STAGES.map((s) => s.title.split(' · ')[0])).toEqual(STAGES.map((s) => stageRange(s)));
  });

  it('texture progression is age-monotonic', () => {
    for (let i = 1; i < TEXTURE_PROGRESSION.length; i++) {
      expect(TEXTURE_PROGRESSION[i].ageMonths).toBeGreaterThan(
        TEXTURE_PROGRESSION[i - 1].ageMonths
      );
    }
  });

  it('reaction guidance covers both inconfort and reaction', () => {
    const levels = REACTION_GUIDANCE.map((r) => r.level);
    expect(levels).toContain('inconfort');
    expect(levels).toContain('reaction');
  });

  it('forbidden foods all have a reason and at least one source', () => {
    for (const f of FORBIDDEN_FOODS) {
      expect(f.reason.length).toBeGreaterThan(10);
      expect(f.sources.length).toBeGreaterThan(0);
    }
  });
});

// The fields the UI prints through EmphasisText.svelte, which sets **…** in
// <strong>. Every other field prints as plain text (or as JSON-LD, like the
// allergen `why` on /allergens), where a marker would show raw (#668).
const EMPHASIS_FIELDS: Record<string, readonly string[]> = {
  ALLERGEN_GUIDANCE: ['howToOffer', 'whatToDo'],
  CATEGORY_GUIDANCE: ['whenStart', 'cadence'],
  REACTION_GUIDANCE: ['whatToDo']
};

/** Names an array entry by its `id` or `level`, else by its index. */
function entryName(value: unknown, index: number): string {
  if (value && typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (typeof v.id === 'string') return v.id;
    if (typeof v.level === 'string') return v.level;
  }
  return String(index);
}

/** Every string under `value`, with its path: table, entry, field, then any index. */
function* strings(value: unknown, path: string[]): Generator<{ path: string[]; text: string }> {
  if (typeof value === 'string') yield { path, text: value };
  else if (Array.isArray(value))
    for (const [i, v] of value.entries()) yield* strings(v, [...path, entryName(v, i)]);
  else if (value && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) yield* strings(v, [...path, k]);
}

/** Each misplaced `**` in the exported tables: outside EMPHASIS_FIELDS, or unpaired inside them. */
function markerFaults(tables: Record<string, unknown>): string[] {
  const faults: string[] = [];
  for (const [table, value] of Object.entries(tables)) {
    for (const { path, text } of strings(value, [table])) {
      const markers = text.split('**').length - 1;
      if (markers === 0) continue;
      const where = path.join('.');
      if (!EMPHASIS_FIELDS[table]?.includes(path[2])) faults.push(`${where}: ** in plain text`);
      else if (markers % 2 === 1) faults.push(`${where}: unpaired **`);
    }
  }
  return faults;
}

describe('emphasis markers', () => {
  it('appear only in the fields set in <strong>, in pairs', () => {
    expect(markerFaults(guidance)).toEqual([]);
  });

  it('are found in a field printed as plain text', () => {
    expect(
      markerFaults({
        STAGES: [{ id: '4-6', textures: 'Purée **lisse**.' }],
        ALLERGEN_GUIDANCE: { arachide: { why: 'Le **LEAP**.' } },
        EMERGENCY_NUMBER: '**15**'
      })
    ).toEqual([
      'STAGES.4-6.textures: ** in plain text',
      'ALLERGEN_GUIDANCE.arachide.why: ** in plain text',
      'EMERGENCY_NUMBER: ** in plain text'
    ]);
  });

  it('are found unpaired in a field set in <strong>', () => {
    expect(
      markerFaults({
        REACTION_GUIDANCE: [{ level: 'reaction', whatToDo: '**appeler le 15** ou **le 112' }],
        ALLERGEN_GUIDANCE: { lait: { howToOffer: ['Le **lait** liquide.', 'Le lait**'] } },
        CATEGORY_GUIDANCE: { produits_laitiers: { cadence: '**Chaque** semaine.' } }
      })
    ).toEqual([
      'REACTION_GUIDANCE.reaction.whatToDo: unpaired **',
      'ALLERGEN_GUIDANCE.lait.howToOffer.1: unpaired **'
    ]);
  });
});

describe('getStageForAgeMonths', () => {
  it('returns 4-6 for 4 months', () => {
    expect(getStageForAgeMonths(4).id).toBe('4-6');
  });
  it('returns 4-6 for 5 months', () => {
    expect(getStageForAgeMonths(5).id).toBe('4-6');
  });
  it('returns 6-9 for 6 months', () => {
    expect(getStageForAgeMonths(6).id).toBe('6-9');
  });
  it('returns 9-12 for 9 months', () => {
    expect(getStageForAgeMonths(9).id).toBe('9-12');
  });
  it('returns 12-36 for 12 months', () => {
    expect(getStageForAgeMonths(12).id).toBe('12-36');
  });
  it('returns 12-36 for 24 months', () => {
    expect(getStageForAgeMonths(24).id).toBe('12-36');
  });
  it('clamps before 4 months to 4-6', () => {
    expect(getStageForAgeMonths(2).id).toBe('4-6');
  });
  it('clamps after 36 months to 12-36', () => {
    expect(getStageForAgeMonths(48).id).toBe('12-36');
  });
});

describe('getTipsFor', () => {
  it('returns at least one tip for any reasonable age', () => {
    expect(getTipsFor({ ageMonths: 5 }).length).toBeGreaterThan(0);
    expect(getTipsFor({ ageMonths: 8 }).length).toBeGreaterThan(0);
    expect(getTipsFor({ ageMonths: 14 }).length).toBeGreaterThan(0);
  });

  it('matches per-allergen tips', () => {
    const peanutTips = getTipsFor({ allergenId: 'arachide' });
    const containsPeanut = peanutTips.some((t) => t.allergens?.includes('arachide'));
    expect(containsPeanut).toBe(true);
  });

  it('matches per-category tips', () => {
    const fishTips = getTipsFor({ categoryId: 'poissons' });
    const containsFish = fishTips.some((t) => t.categories?.includes('poissons'));
    expect(containsFish).toBe(true);
  });

  it('uses the explicit stageId when provided', () => {
    expect(getTipsFor({ stageId: '6-9' }).length).toBeGreaterThan(0);
  });
});

describe('pickRotatingTip', () => {
  it('returns null on empty', () => {
    expect(pickRotatingTip([], 0)).toBeNull();
  });

  it('returns a stable tip for the same seed within a day', () => {
    const tips = getTipsFor({ ageMonths: 6 });
    const a = pickRotatingTip(tips, 1);
    const b = pickRotatingTip(tips, 1);
    expect(a?.id).toBe(b?.id);
  });

  it('turns to the next tip at Paris midnight, not UTC midnight', () => {
    const tips = getTipsFor({ ageMonths: 6 });
    expect(tips.length).toBeGreaterThan(1);
    const tipAt = (iso: string) => pickRotatingTip(tips, 1, Date.parse(iso))?.id;
    // 23:59 and 00:01 Paris (CEST) on either side of midnight: a new day.
    expect(tipAt('2026-06-01T21:59:00Z')).not.toBe(tipAt('2026-06-01T22:01:00Z'));
    // 00:01 and 02:30 Paris share the day, though UTC midnight (02:00 Paris)
    // falls between them.
    expect(tipAt('2026-06-01T22:01:00Z')).toBe(tipAt('2026-06-02T00:30:00Z'));
  });
});

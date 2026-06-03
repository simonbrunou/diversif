import { describe, expect, it } from 'bun:test';
import { ALLERGENS } from '$lib/utils/allergens';
import { CATEGORIES } from '$lib/utils/categories';
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
import { ALL_SOURCE_IDS, SOURCES } from './sources';

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
});

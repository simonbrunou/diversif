import { afterEach, describe, expect, it } from 'bun:test';
import { render, cleanup } from '@testing-library/svelte';
import '../../../../test/component';
import { getStageForAgeMonths } from '#lib/content/guidance.js';
import Page from './+page.svelte';
import type { PageData } from './$types';

afterEach(() => {
  cleanup();
});

// A report generated on 15 July 2026 (14:00 Paris) for a child born on
// 15 January: the header must read the age on that day, whenever the page is
// opened, so it agrees with the stage the loader derived from the same instant.
const generatedAt = Date.UTC(2026, 6, 15, 12);

function makeData(): PageData {
  return {
    child: { id: 1, name: 'Bébé', birthDate: '2026-01-15' },
    generatedAt,
    ageMonths: 6,
    stage: getStageForAgeMonths(6),
    mostAdvancedTexture: null,
    textureDistribution: {
      counts: { lisse: 0, moulinee: 0, ecrasee: 0, 'petits-morceaux': 0, morceaux: 0, finger: 0 },
      totalWithTexture: 0
    },
    totals: {
      foods: 0,
      entries: 0,
      categoriesCovered: 0,
      categoriesTotal: 9,
      allergensIntroduced: 0,
      allergensTotal: 12
    },
    categoryGroups: [],
    allergens: [],
    notable: []
  } as unknown as PageData;
}

describe('child/[id]/report page', () => {
  it('prints the age on the day the report was generated, like its stage', () => {
    const { getByRole } = render(Page, { props: { data: makeData() } });
    const age = getByRole('heading', { level: 1 }).nextElementSibling;
    expect(age?.textContent?.trim().startsWith('6 mois ·')).toBe(true);
  });
});

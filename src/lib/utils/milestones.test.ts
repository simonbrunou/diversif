import { describe, expect, it, mock } from 'bun:test';
import * as m from '#lib/paraglide/messages.js';
import { getAllergenLabel } from '#lib/utils/allergens.js';
import {
  celebrate,
  clearMilestoneQuery,
  milestonesPath,
  pickMilestoneFromQuery,
  type Milestones
} from './milestones';

function fakeToast() {
  const success = mock();
  return {
    toast: { success } as unknown as Parameters<typeof celebrate>[0],
    success
  };
}

function qs(input: string): URLSearchParams {
  return new URLSearchParams(input);
}

const NOTHING_NEW: Milestones = {
  firstFood: false,
  firstAllergen: null,
  allAllergens: false,
  categories: { before: 3, after: 3 }
};

// The decoder's side of a path milestonesPath built.
function searchOf(path: string): URLSearchParams {
  return new URL(path, 'http://localhost').searchParams;
}

describe('milestonesPath', () => {
  // The param names are a contract: the create action stores this path in
  // idempotency_keys and replays it verbatim, and the offline queue matches it.
  it('encodes every flag on the child’s dashboard path', () => {
    expect(
      milestonesPath(7, {
        firstFood: true,
        firstAllergen: 'arachide',
        allAllergens: true,
        categories: { before: 0, after: 1 }
      })
    ).toBe(
      '/child/7?logged=1&first=1&allergen=arachide&allAllergens=1&categories=1&prevCategories=0'
    );
  });

  it('omits the flags that did not fire but always carries the category counts', () => {
    expect(milestonesPath(7, NOTHING_NEW)).toBe('/child/7?logged=1&categories=3&prevCategories=3');
  });

  it('round-trips through pickMilestoneFromQuery', () => {
    const path = milestonesPath(7, { ...NOTHING_NEW, categories: { before: 4, after: 5 } });
    expect(pickMilestoneFromQuery(searchOf(path), 11)).toEqual({
      kind: 'category-milestone',
      covered: 5,
      total: 11
    });
  });
});

describe('clearMilestoneQuery', () => {
  it('removes every milestone param and keeps the others', () => {
    const url = new URL(`${milestonesPath(1, NOTHING_NEW)}&tab=x&first=1`, 'http://localhost');
    clearMilestoneQuery(url);
    expect(url.search).toBe('?tab=x');
  });
});

describe('pickMilestoneFromQuery', () => {
  it('returns null when logged flag is missing', () => {
    expect(pickMilestoneFromQuery(qs(''), 11)).toBeNull();
    expect(pickMilestoneFromQuery(qs('logged=0'), 11)).toBeNull();
  });

  it('prioritises first-allergen over first-food', () => {
    const m = pickMilestoneFromQuery(
      qs('logged=1&first=1&allergen=arachide&categories=1&prevCategories=0'),
      11
    );
    expect(m).toEqual({ kind: 'first-allergen', allergenType: 'arachide' });
  });

  it('prioritises all-allergens over every other milestone when set', () => {
    const m = pickMilestoneFromQuery(
      qs('logged=1&first=1&allergen=moutarde&allAllergens=1&categories=8&prevCategories=7'),
      11
    );
    expect(m).toEqual({ kind: 'all-allergens' });
  });

  it('returns first-food when prior entry count was 0', () => {
    const m = pickMilestoneFromQuery(qs('logged=1&first=1&categories=1&prevCategories=0'), 11);
    expect(m).toEqual({ kind: 'first-food' });
  });

  it('returns category-milestone only when crossing into 5/8/all', () => {
    expect(pickMilestoneFromQuery(qs('logged=1&categories=5&prevCategories=4'), 11)).toEqual({
      kind: 'category-milestone',
      covered: 5,
      total: 11
    });
    expect(pickMilestoneFromQuery(qs('logged=1&categories=8&prevCategories=7'), 11)).toEqual({
      kind: 'category-milestone',
      covered: 8,
      total: 11
    });
    // "All categories" follows the total: 11 today, since 'autre' doesn't count.
    expect(pickMilestoneFromQuery(qs('logged=1&categories=10&prevCategories=9'), 11)).toEqual({
      kind: 'generic'
    });
    expect(pickMilestoneFromQuery(qs('logged=1&categories=11&prevCategories=10'), 11)).toEqual({
      kind: 'category-milestone',
      covered: 11,
      total: 11
    });
    expect(pickMilestoneFromQuery(qs('logged=1&categories=12&prevCategories=11'), 12)).toEqual({
      kind: 'category-milestone',
      covered: 12,
      total: 12
    });
  });

  it('does not fire category-milestone when count did not increase', () => {
    expect(pickMilestoneFromQuery(qs('logged=1&categories=5&prevCategories=5'), 11)).toEqual({
      kind: 'generic'
    });
  });

  it('does not fire category-milestone when crossing a non-threshold count', () => {
    expect(pickMilestoneFromQuery(qs('logged=1&categories=4&prevCategories=3'), 11)).toEqual({
      kind: 'generic'
    });
  });

  it('falls back to generic when no specific milestone hits', () => {
    expect(pickMilestoneFromQuery(qs('logged=1&categories=2&prevCategories=2'), 11)).toEqual({
      kind: 'generic'
    });
  });

  it('treats unparsable counts as no category milestone', () => {
    expect(pickMilestoneFromQuery(qs('logged=1&categories=foo&prevCategories=bar'), 11)).toEqual({
      kind: 'generic'
    });
  });
});

// Assert via paraglide keys (not literals) so these survive copy changes
// and run under any default locale — same pattern as allergens.test.ts.
describe('celebrate', () => {
  it('fires the first-food toast', () => {
    const { toast, success } = fakeToast();
    celebrate(toast, { kind: 'first-food' });
    expect(success).toHaveBeenCalledOnce();
    expect(success.mock.calls[0][0]).toBe(m.milestoneFirstFoodTitle());
    expect(success.mock.calls[0][1]?.description).toBe(m.milestoneFirstFoodDescription());
    expect(success.mock.calls[0][1]?.class).toContain('celebrate');
  });

  it('fires the first-allergen toast with the allergen label', () => {
    const { toast, success } = fakeToast();
    celebrate(toast, { kind: 'first-allergen', allergenType: 'arachide' });
    expect(success).toHaveBeenCalledOnce();
    expect(success.mock.calls[0][0]).toBe(
      m.milestoneFirstAllergenTitle({ allergen: getAllergenLabel('arachide') })
    );
  });

  it('fires the all-allergens completion toast', () => {
    const { toast, success } = fakeToast();
    celebrate(toast, { kind: 'all-allergens' });
    expect(success).toHaveBeenCalledOnce();
    expect(success.mock.calls[0][0]).toBe(m.milestoneAllAllergensTitle({ count: 12 }));
    expect(success.mock.calls[0][1]?.class).toContain('celebrate');
  });

  it('fires the all-covered variant when covered === total', () => {
    const { toast, success } = fakeToast();
    celebrate(toast, { kind: 'category-milestone', covered: 11, total: 11 });
    expect(success.mock.calls[0][0]).toBe(m.milestoneAllCategoriesTitle());
  });

  it('fires the partial-covered variant when covered < total', () => {
    const { toast, success } = fakeToast();
    celebrate(toast, { kind: 'category-milestone', covered: 5, total: 11 });
    expect(success.mock.calls[0][0]).toBe(m.milestoneCategoryTitle({ covered: 5 }));
    expect(success.mock.calls[0][1]?.description).toBe(
      m.milestoneCategoryDescription({ remaining: 6 })
    );
  });

  it('fires the generic toast for the generic kind', () => {
    const { toast, success } = fakeToast();
    celebrate(toast, { kind: 'generic' });
    expect(success).toHaveBeenCalledOnce();
    expect(success.mock.calls[0][0]).toBe(m.milestoneGenericTitle());
  });
});

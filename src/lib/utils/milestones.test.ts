import { describe, it, expect, vi } from 'vitest';
import { celebrate, pickMilestoneFromQuery } from './milestones';

function fakeToast() {
  const success = vi.fn();
  return {
    toast: { success } as unknown as Parameters<typeof celebrate>[0],
    success
  };
}

function qs(input: string): URLSearchParams {
  return new URLSearchParams(input);
}

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

  it('returns category-milestone only when crossing into 5/8/12', () => {
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

describe('celebrate', () => {
  it('fires the first-food toast', () => {
    const { toast, success } = fakeToast();
    celebrate(toast, { kind: 'first-food' });
    expect(success).toHaveBeenCalledOnce();
    expect(success.mock.calls[0][0]).toContain('Premier repas');
    expect(success.mock.calls[0][1]?.class).toContain('celebrate');
  });

  it('fires the first-allergen toast with the allergen label', () => {
    const { toast, success } = fakeToast();
    celebrate(toast, { kind: 'first-allergen', allergenType: 'arachide' });
    expect(success).toHaveBeenCalledOnce();
    expect(success.mock.calls[0][0].toLowerCase()).toContain('arachide');
  });

  it('fires the all-allergens completion toast', () => {
    const { toast, success } = fakeToast();
    celebrate(toast, { kind: 'all-allergens' });
    expect(success).toHaveBeenCalledOnce();
    expect(success.mock.calls[0][0]).toContain('7 allergènes');
    expect(success.mock.calls[0][1]?.class).toContain('celebrate');
  });

  it('fires the all-covered variant when covered === total', () => {
    const { toast, success } = fakeToast();
    celebrate(toast, { kind: 'category-milestone', covered: 11, total: 11 });
    expect(success.mock.calls[0][0]).toContain('Toutes les familles couvertes');
  });

  it('fires the partial-covered variant when covered < total', () => {
    const { toast, success } = fakeToast();
    celebrate(toast, { kind: 'category-milestone', covered: 5, total: 11 });
    expect(success.mock.calls[0][0]).toContain('5 groupes');
    expect(success.mock.calls[0][1]?.description).toContain('6');
  });

  it('fires the generic toast for the generic kind', () => {
    const { toast, success } = fakeToast();
    celebrate(toast, { kind: 'generic' });
    expect(success).toHaveBeenCalledOnce();
    expect(success.mock.calls[0][0]).toContain('noté');
  });
});

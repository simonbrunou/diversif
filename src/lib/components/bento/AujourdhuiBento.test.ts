import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import * as m from '$lib/paraglide/messages';
import AujourdhuiBento from './AujourdhuiBento.svelte';

afterEach(() => cleanup());

describe('AujourdhuiBento', () => {
  const baseProps = {
    childId: 'abc',
    recent: [],
    stats: {
      foodsIntroduced: 5,
      weekCount: 2,
      allergens: { introduced: 0, total: 12, ras: 0, inconfort: 0, reaction: 0 }
    },
    streak: 3,
    streakRecord: 5,
    reminders: [],
    allergens: []
  };

  const allergenStatuses = [
    { id: 'oeuf', label: 'Œuf', state: 'cleared' as const, worstEntryId: null },
    { id: 'lait', label: 'Lait', state: 'fading' as const, worstEntryId: null },
    { id: 'poisson', label: 'Poisson', state: 'reaction' as const, worstEntryId: 42 },
    { id: 'arachide', label: 'Arachide', state: 'todo' as const, worstEntryId: null },
    { id: 'celeri', label: 'Céleri', state: 'todo' as const, worstEntryId: null }
  ];

  it('renders StatTiles with the loader stats', () => {
    render(AujourdhuiBento, { props: baseProps });
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText(m.aujourdhuiBilanAlimentsDeltaOther({ count: '2' }))).toBeTruthy();
  });

  it('renders the recent-feed header', () => {
    render(AujourdhuiBento, { props: baseProps });
    expect(screen.getByText(m.aujourdhuiRecentTitle())).toBeTruthy();
  });

  it('links the allergen tile heading to the allergens segment', () => {
    render(AujourdhuiBento, { props: baseProps });
    const seeAll = screen.getByRole('link', { name: m.aujourdhuiAllergensSeeAll() });
    expect(seeAll.getAttribute('href')).toBe('/child/abc/foods?segment=allergens');
  });

  it('renders real allergen names with their states (no synthetic #N labels)', () => {
    render(AujourdhuiBento, { props: { ...baseProps, allergens: allergenStatuses } });
    expect(screen.getByText('Lait')).toBeTruthy();
    expect(screen.getByText('Poisson')).toBeTruthy();
    // Arachide is a priority allergen still to try → shown as next-to-try.
    expect(screen.getByText('Arachide')).toBeTruthy();
    expect(screen.queryByText(/#\d/)).toBeNull();
  });

  // Cleared allergens are reassurance, not a to-do: they are stated as a count
  // so the actionable states keep the pill row to themselves. Previously up to
  // three of them took pill slots and pushed the next-to-try pills out of a
  // horizontal scroller with no scroll affordance.
  it('counts cleared allergens instead of giving each one a pill', () => {
    render(AujourdhuiBento, { props: { ...baseProps, allergens: allergenStatuses } });
    expect(screen.getByText(m.aujourdhuiAllergensClearedOne())).toBeTruthy();
    expect(screen.queryByText('Œuf')).toBeNull();
  });

  // The whole point of threading worstEntryId through: a réaction pill must
  // reach the entry page that carries the reassurance copy.
  it('points a réaction pill at its own entry', () => {
    render(AujourdhuiBento, { props: { ...baseProps, allergens: allergenStatuses } });
    const pill = screen.getByRole('link', {
      name: m.aujourdhuiAllergensEntryAria({ allergen: 'Poisson' })
    });
    expect(pill.getAttribute('href')).toBe('/child/abc/foods/42');
  });

  it('omits non-priority untried allergens from the next-to-try pills', () => {
    render(AujourdhuiBento, { props: { ...baseProps, allergens: allergenStatuses } });
    // Céleri is EU-labelling-only (not a LEAP/EAT/ESPGHAN priority): no pill.
    expect(screen.queryByText('Céleri')).toBeNull();
  });

  it('shows the empty-state copy when no allergen has been introduced yet', () => {
    render(AujourdhuiBento, {
      props: {
        ...baseProps,
        allergens: [
          { id: 'oeuf', label: 'Œuf', state: 'todo' as const, worstEntryId: null },
          { id: 'arachide', label: 'Arachide', state: 'todo' as const, worstEntryId: null }
        ]
      }
    });
    expect(screen.getByText(m.aujourdhuiAllergensEmpty())).toBeTruthy();
    // No unlogged-allergen wall when nothing is introduced.
    expect(screen.queryByText('Œuf')).toBeNull();
  });

  it('renders a Bilan-pour-le-pédiatre CTA linking to /report', () => {
    render(AujourdhuiBento, { props: baseProps });
    const link = screen.getByText(m.reportHandoffTitle()).closest('a');
    expect(link?.getAttribute('href')).toBe('/child/abc/report');
  });

  it('hides the reminder strip when reminders is empty', () => {
    render(AujourdhuiBento, { props: baseProps });
    expect(screen.queryByRole('complementary')).toBeNull();
  });
});

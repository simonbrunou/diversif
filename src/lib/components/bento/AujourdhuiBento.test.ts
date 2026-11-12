import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import * as m from '#lib/paraglide/messages.js';
import AujourdhuiBento from './AujourdhuiBento.svelte';

afterEach(() => cleanup());

describe('AujourdhuiBento', () => {
  const baseProps = {
    childId: 'abc',
    recent: [],
    stats: { foodsIntroduced: 5, weekCount: 2 },
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

  // #737: from lg the destinations take the stat tiles' cell (column one, rows
  // 2 and 3) whenever the stat tiles render nothing, and stay under them in
  // row 4 otherwise. Both read StatTiles' own threshold, so they agree at the
  // first logged food. e2e/aujourdhui-tray.spec.ts measures the layout itself.
  it.each([
    [0, false, ['lg:row-span-2', 'lg:row-start-2']],
    [1, true, ['lg:row-start-4']]
  ])(
    'with %i foods introduced, stat tiles shown: %p, destinations in %p',
    (foodsIntroduced, statsShown, navRows) => {
      const { container } = render(AujourdhuiBento, {
        props: { ...baseProps, stats: { foodsIntroduced, weekCount: 0 } }
      });
      expect(Boolean(screen.queryByRole('article', { name: m.aujourdhuiBilanAliments() }))).toBe(
        statsShown
      );
      const nav = screen.getByRole('navigation', { name: m.aujourdhuiHandoffsLabel() });
      const rows = [...nav.classList].filter((c) => /^lg:row-/.test(c)).sort();
      expect(rows).toEqual(navRows);
      // No empty stat tiles cell is left behind to cover the destinations.
      const columnOneCells = [...container.querySelectorAll('.lg\\:col-start-1')].map(
        (el) => el.tagName
      );
      expect(columnOneCells).toEqual(statsShown ? ['DIV', 'NAV'] : ['NAV']);
    }
  );

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

  // The lg tray places its two column stacks with grid placement, not with
  // per-column wrappers (#363), so the modules keep the phone's DOM order,
  // and with it the reading and tab order, at every width. A wrapper per
  // column would put the destinations before the allergens and the feed.
  it('keeps the modules in reading order: reminders, stat tiles, allergens, feed, destinations', () => {
    render(AujourdhuiBento, {
      props: {
        ...baseProps,
        reminders: [
          {
            key: 'lead',
            severity: 'info' as const,
            title: 'Rappel',
            body: 'Corps',
            dismissable: false
          }
        ]
      }
    });
    const modules = [
      screen.getByRole('complementary'),
      screen.getByRole('article', { name: m.aujourdhuiBilanAliments() }),
      screen.getByRole('region', { name: m.aujourdhuiAllergensTitle() }),
      screen.getByText(m.aujourdhuiRecentTitle()),
      screen.getByRole('navigation', { name: m.aujourdhuiHandoffsLabel() })
    ];
    const following = modules
      .slice(1)
      .map((el, i) =>
        Boolean(modules[i].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)
      );
    expect(following).toEqual([true, true, true, true]);
  });
});

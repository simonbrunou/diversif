import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
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
    { id: 'oeuf', label: 'Œuf', state: 'cleared' as const },
    { id: 'lait', label: 'Lait', state: 'fading' as const },
    { id: 'poisson', label: 'Poisson', state: 'reaction' as const },
    { id: 'arachide', label: 'Arachide', state: 'todo' as const },
    { id: 'celeri', label: 'Céleri', state: 'todo' as const }
  ];

  it('renders StatTiles with the loader stats', () => {
    render(AujourdhuiBento, { props: baseProps });
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('+2 cette semaine')).toBeTruthy();
  });

  it('renders RecentFeed header', () => {
    render(AujourdhuiBento, { props: baseProps });
    expect(screen.getByText('Cette semaine')).toBeTruthy();
  });

  it('renders AllergensSnapshot tile linking to the segment', () => {
    render(AujourdhuiBento, { props: baseProps });
    const links = screen.getAllByRole('link');
    const allergens = links.find(
      (l) => l.getAttribute('href') === '/child/abc/foods?segment=allergens'
    );
    expect(allergens).toBeTruthy();
  });

  it('renders real allergen names with their states (no synthetic #N labels)', () => {
    render(AujourdhuiBento, { props: { ...baseProps, allergens: allergenStatuses } });
    expect(screen.getByText('Œuf')).toBeTruthy();
    expect(screen.getByText('Lait')).toBeTruthy();
    expect(screen.getByText('Poisson')).toBeTruthy();
    // Arachide is a priority allergen still to try → shown as next-to-try.
    expect(screen.getByText('Arachide')).toBeTruthy();
    expect(screen.queryByText(/#\d/)).toBeNull();
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
          { id: 'oeuf', label: 'Œuf', state: 'todo' as const },
          { id: 'arachide', label: 'Arachide', state: 'todo' as const }
        ]
      }
    });
    expect(
      screen.getByText(
        'Aucun allergène introduit pour l’instant — commencez par l’œuf ou l’arachide.'
      )
    ).toBeTruthy();
    // No "à découvrir" wall when nothing is introduced.
    expect(screen.queryByText('Œuf')).toBeNull();
  });

  it('renders a Bilan-pour-le-pédiatre CTA linking to /report', () => {
    render(AujourdhuiBento, { props: baseProps });
    const link = screen.getByText('Bilan pour le pédiatre').closest('a');
    expect(link?.getAttribute('href')).toBe('/child/abc/report');
  });

  it('hides the reminder strip when reminders is empty', () => {
    render(AujourdhuiBento, { props: baseProps });
    expect(screen.queryByRole('status')).toBeNull();
  });
});

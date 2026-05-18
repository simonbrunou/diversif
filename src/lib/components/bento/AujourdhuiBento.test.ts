// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
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
      allergens: { introduced: 0, total: 14, ras: 0, inconfort: 0, reaction: 0 }
    },
    streak: 3,
    streakRecord: 5,
    reminders: [],
    priorityAllergensTodo: []
  };

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

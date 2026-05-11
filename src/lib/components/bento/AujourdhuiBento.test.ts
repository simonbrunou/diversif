// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import AujourdhuiBento from './AujourdhuiBento.svelte';

afterEach(() => cleanup());

describe('AujourdhuiBento', () => {
  const baseProps = {
    childId: 'abc',
    childName: 'Léo',
    recent: [],
    stats: {
      foodsIntroduced: 5,
      weekCount: 2,
      allergens: { introduced: 0, total: 14, ras: 0, inconfort: 0, reaction: 0 }
    },
    streak: 3,
    streakRecord: 5,
    reminders: [],
    starterFoods: [],
    priorityAllergensTodo: [],
    onLog: () => {}
  };

  it('renders the hero tile', () => {
    render(AujourdhuiBento, { props: baseProps });
    expect(screen.getByText(/Bienvenue Léo/)).toBeTruthy();
  });

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
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/child/abc/foods?segment=allergens');
  });

  it('hides the reminder strip when reminders is empty', () => {
    render(AujourdhuiBento, { props: baseProps });
    expect(screen.queryByRole('status')).toBeNull();
  });
});

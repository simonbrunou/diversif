import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import CarnetStats from './CarnetStats.svelte';

afterEach(() => cleanup());

describe('CarnetStats', () => {
  it('renders the diversity score', () => {
    render(CarnetStats, {
      props: { diversityScore: 7, distinctFoods: 23, weeklyEntries: [3, 5, 2, 8, 4, 1, 0] }
    });
    expect(screen.getByText('7')).toBeTruthy();
  });

  it('explains what the diversity number counts (categories tasted, all-time)', () => {
    render(CarnetStats, {
      props: { diversityScore: 7, distinctFoods: 23, weeklyEntries: [3, 5, 2, 8, 4, 1, 0] }
    });
    expect(screen.getByText('catégories d’aliments goûtées')).toBeTruthy();
  });

  it('renders the foods total', () => {
    render(CarnetStats, {
      props: { diversityScore: 7, distinctFoods: 23, weeklyEntries: [] }
    });
    expect(screen.getByText('23')).toBeTruthy();
  });

  it('renders one bar per entry in weeklyEntries', () => {
    const { container } = render(CarnetStats, {
      props: { diversityScore: 7, distinctFoods: 23, weeklyEntries: [3, 5, 2, 8, 4, 1, 0] }
    });
    expect(container.querySelectorAll('[data-bar]').length).toBe(7);
  });

  it('renders a day-of-week label under each bar', () => {
    const { container } = render(CarnetStats, {
      props: { diversityScore: 7, distinctFoods: 23, weeklyEntries: [3, 5, 2, 8, 4, 1, 0] }
    });
    const labels = container.querySelectorAll('[data-day]');
    expect(labels.length).toBe(7);
    for (const el of labels) {
      expect(el.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it('anchors labels to anchorUtc when provided (no drift across hydration)', () => {
    // 2026-05-14 was a Thursday in UTC. With anchorUtc pinned to that day,
    // the last bucket must always read "J" (jeudi narrow) regardless of the
    // host clock.
    const anchor = Date.UTC(2026, 4, 14);
    const { container } = render(CarnetStats, {
      props: {
        diversityScore: 7,
        distinctFoods: 23,
        weeklyEntries: [0, 0, 0, 0, 0, 0, 1],
        anchorUtc: anchor
      }
    });
    const labels = container.querySelectorAll('[data-day]');
    expect(labels.length).toBe(7);
    expect(labels[6].textContent?.trim()).toBe('J');
  });
});

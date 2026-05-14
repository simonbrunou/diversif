// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
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
});

// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import RecentFeed from './RecentFeed.svelte';

afterEach(() => cleanup());

describe('RecentFeed', () => {
  const entries = [
    {
      id: 1,
      foodId: 10,
      foodName: 'Poire',
      category: 'fruits' as const,
      reaction: 'ras' as const,
      givenAt: Date.now() - 1000
    },
    {
      id: 2,
      foodId: 11,
      foodName: 'Banane',
      category: 'fruits' as const,
      reaction: 'ras' as const,
      givenAt: Date.now() - 2000
    }
  ];

  it('renders the section header', () => {
    render(RecentFeed, { props: { entries } });
    expect(screen.getByText('Cette semaine')).toBeTruthy();
  });

  it('renders one row per entry, capped at 5', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      foodId: i,
      foodName: `Food ${i}`,
      category: 'fruits' as const,
      reaction: 'ras' as const,
      givenAt: Date.now() - i * 1000
    }));
    render(RecentFeed, { props: { entries: many } });
    expect(screen.getAllByRole('listitem').length).toBe(5);
  });

  it('renders the empty placeholder when entries is empty', () => {
    render(RecentFeed, { props: { entries: [] } });
    expect(screen.getByText('Rien cette semaine')).toBeTruthy();
  });

  it('renders the reaction pill text', () => {
    render(RecentFeed, { props: { entries } });
    expect(screen.getAllByText('OK').length).toBeGreaterThan(0);
  });
});

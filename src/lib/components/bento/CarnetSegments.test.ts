// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import CarnetSegments from './CarnetSegments.svelte';

afterEach(() => cleanup());

describe('CarnetSegments', () => {
  it('renders all four segment labels', () => {
    render(CarnetSegments, { props: { childId: 'abc', currentSegment: 'all' } });
    expect(screen.getByText('Tous')).toBeTruthy();
    expect(screen.getByText('Catégories')).toBeTruthy();
    expect(screen.getByText('Allergènes')).toBeTruthy();
    expect(screen.getByText('Bilan')).toBeTruthy();
  });

  it('marks the active segment with aria-current', () => {
    render(CarnetSegments, { props: { childId: 'abc', currentSegment: 'allergens' } });
    const allergens = screen.getByText('Allergènes').closest('a');
    expect(allergens?.getAttribute('aria-current')).toBe('page');
  });

  it('links each segment to /foods?segment=...', () => {
    render(CarnetSegments, { props: { childId: 'abc', currentSegment: 'all' } });
    expect(screen.getByText('Allergènes').closest('a')?.getAttribute('href')).toBe(
      '/child/abc/foods?segment=allergens'
    );
    expect(screen.getByText('Bilan').closest('a')?.getAttribute('href')).toBe(
      '/child/abc/foods?segment=stats'
    );
  });

  it('uses no query for the Tous segment', () => {
    render(CarnetSegments, { props: { childId: 'abc', currentSegment: 'all' } });
    expect(screen.getByText('Tous').closest('a')?.getAttribute('href')).toBe('/child/abc/foods');
  });
});

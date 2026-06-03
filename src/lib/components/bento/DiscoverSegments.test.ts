import { afterEach, describe, expect, it } from 'bun:test';
// @vitest-environment happy-dom
import { render, screen, cleanup } from '@testing-library/svelte';
import DiscoverSegments from './DiscoverSegments.svelte';

afterEach(() => cleanup());

describe('DiscoverSegments', () => {
  it('renders all three section labels', () => {
    render(DiscoverSegments, { props: { childId: 'abc', currentSection: 'reperes' } });
    expect(screen.getByText('Repères')).toBeTruthy();
    expect(screen.getByText('À essayer')).toBeTruthy();
    expect(screen.getByText('Apprendre')).toBeTruthy();
  });

  it('marks the active section with aria-current', () => {
    render(DiscoverSegments, { props: { childId: 'abc', currentSection: 'apprendre' } });
    const apprendre = screen.getByText('Apprendre').closest('a');
    expect(apprendre?.getAttribute('aria-current')).toBe('page');
  });

  it('links each section to /guide?section=...', () => {
    render(DiscoverSegments, { props: { childId: 'abc', currentSection: 'reperes' } });
    expect(screen.getByText('À essayer').closest('a')?.getAttribute('href')).toBe(
      '/child/abc/guide?section=essayer'
    );
    expect(screen.getByText('Apprendre').closest('a')?.getAttribute('href')).toBe(
      '/child/abc/guide?section=apprendre'
    );
  });

  it('uses no query for the Repères section', () => {
    render(DiscoverSegments, { props: { childId: 'abc', currentSection: 'reperes' } });
    expect(screen.getByText('Repères').closest('a')?.getAttribute('href')).toBe('/child/abc/guide');
  });
});

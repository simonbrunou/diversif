// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import SourcesCluster from './SourcesCluster.svelte';

afterEach(() => cleanup());

describe('SourcesCluster', () => {
  it('renders the five canonical sources', () => {
    render(SourcesCluster, {});
    expect(screen.getByText('LEAP')).toBeTruthy();
    expect(screen.getByText('EAT')).toBeTruthy();
    expect(screen.getByText('ESPGHAN')).toBeTruthy();
    expect(screen.getByText('ANSES')).toBeTruthy();
    expect(screen.getByText('HCSP')).toBeTruthy();
  });

  it('each source links into /sources with an anchor', () => {
    render(SourcesCluster, {});
    expect(screen.getByText('LEAP').closest('a')?.getAttribute('href')).toBe('/sources#leap');
    expect(screen.getByText('ANSES').closest('a')?.getAttribute('href')).toBe('/sources#anses');
  });
});

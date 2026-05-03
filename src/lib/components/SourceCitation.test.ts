// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import '../../test/component';
import SourceCitation from './SourceCitation.svelte';
import { SOURCES } from '$lib/content/sources';

describe('SourceCitation', () => {
  it('renders an unordered list by default', () => {
    const { container } = render(SourceCitation, {
      props: { ids: ['spf-pnns-guide'] }
    });
    expect(container.querySelector('ul')).not.toBeNull();
    const link = container.querySelector('a');
    expect(link?.getAttribute('href')).toBe(SOURCES['spf-pnns-guide'].url);
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('renders inline mode when inline=true', () => {
    const { container } = render(SourceCitation, {
      props: { ids: ['spf-pnns-guide', 'hcsp-2020'], inline: true }
    });
    expect(container.querySelector('ul')).toBeNull();
    expect(container.querySelectorAll('a').length).toBe(2);
    // Separator dot between items
    expect(container.textContent).toMatch(/·/);
  });

  it('does not render the separator after the last inline source', () => {
    const { container } = render(SourceCitation, {
      props: { ids: ['spf-pnns-guide'], inline: true }
    });
    expect(container.textContent?.trim().endsWith(')')).toBe(true);
  });
});

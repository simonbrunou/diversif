import { describe, expect, it } from 'bun:test';
import { render, screen, within } from '@testing-library/svelte';
import '../../test/component';
import SourceCitation from './SourceCitation.svelte';
import { SOURCES } from '#lib/content/sources.js';
import { langWithin } from '../../test/source-lang';

// who-cf has an English title and a French org name, hcsp-2020 is French
// throughout and eaaci-2020 English throughout.
const MIXED = ['who-cf', 'hcsp-2020', 'eaaci-2020'] as const;

describe('SourceCitation languages', () => {
  it('tags each inline link with its title language and its org name with its own', () => {
    const { container } = render(SourceCitation, { props: { ids: [...MIXED], inline: true } });
    const citation = container.firstElementChild;
    if (!citation) throw new Error('nothing rendered');
    const got = MIXED.map((id) => {
      const link = [...citation.querySelectorAll('a')].find(
        (a) => a.getAttribute('href') === SOURCES[id].url
      );
      if (!link) throw new Error(`no link to ${id}`);
      // The org text shares its element with the year: "OMS (2023)".
      const org = within(link).getByText(SOURCES[id].org, { exact: false });
      return { id, link: langWithin(link, citation), org: langWithin(org, citation) };
    });
    expect(got).toEqual([
      { id: 'who-cf', link: 'en', org: 'fr' },
      { id: 'hcsp-2020', link: 'fr', org: 'fr' },
      { id: 'eaaci-2020', link: 'en', org: 'en' }
    ]);
  });

  it('tags each listed title and org name with its own language', () => {
    const { container } = render(SourceCitation, { props: { ids: [...MIXED] } });
    const list = container.querySelector('ul');
    if (!list) throw new Error('no list rendered');
    const got = MIXED.map((id) => ({
      id,
      title: langWithin(screen.getByText(SOURCES[id].label), list),
      org: langWithin(screen.getByText(SOURCES[id].org), list)
    }));
    expect(got).toEqual([
      { id: 'who-cf', title: 'en', org: 'fr' },
      { id: 'hcsp-2020', title: 'fr', org: 'fr' },
      { id: 'eaaci-2020', title: 'en', org: 'en' }
    ]);
  });
});

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

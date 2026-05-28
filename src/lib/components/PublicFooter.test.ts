import { describe, expect, it } from 'bun:test';
// @vitest-environment happy-dom
import { render } from '@testing-library/svelte';
import '../../test/component';
import PublicFooter from './PublicFooter.svelte';

describe('PublicFooter', () => {
  it('renders the brand and copyright with current year', () => {
    const { container } = render(PublicFooter, { props: {} });
    expect(container.textContent).toContain('Diversif');
    expect(container.textContent).toContain(String(new Date().getFullYear()));
  });

  it('links to the GitHub repository', () => {
    const { container } = render(PublicFooter, { props: {} });
    const gh = Array.from(container.querySelectorAll('a')).find(
      (a) => a.textContent?.trim() === 'GitHub'
    );
    expect(gh?.getAttribute('href')).toContain('github.com');
    expect(gh?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('links to /guide, /allergens, /sources, /login', () => {
    const { container } = render(PublicFooter, { props: {} });
    const hrefs = Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href'));
    for (const expected of ['/guide', '/allergens', '/sources', '/login']) {
      expect(hrefs).toContain(expected);
    }
  });
});

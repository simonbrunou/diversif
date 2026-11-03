import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import LandingFeaturesBento from './LandingFeaturesBento.svelte';

afterEach(() => cleanup());

describe('LandingFeaturesBento', () => {
  it('renders the section title', () => {
    render(LandingFeaturesBento);
    expect(screen.getByText('Pourquoi Diversif')).toBeTruthy();
  });

  it('renders four feature tiles', () => {
    render(LandingFeaturesBento);
    const headings = screen.getAllByRole('heading', { level: 3 });
    expect(headings.length).toBe(4);
  });

  // The Paired Foreground Rule (DESIGN.md): text on a tint takes that tint's
  // own -foreground, never ink-soft, which erodes on the dark tiles (#360).
  it("sets each feature's body in its own tile's foreground", () => {
    render(LandingFeaturesBento);
    const articles = screen.getAllByRole('article');
    expect(articles.length).toBe(4);
    for (const article of articles) {
      const tile = /\bbg-tile-(\w+)\b/.exec(article.className)?.[1];
      const body = article.querySelector('p');
      expect(tile).toBeTruthy();
      expect(body?.classList.contains(`text-tile-${tile}-foreground`)).toBe(true);
      expect(body?.className).not.toContain('ink-soft');
    }
  });
});

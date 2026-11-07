import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import { expectPairedForeground } from '../../../test/paired-foreground';
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

  it("sets each feature tile's text in that tile's own foreground (#360)", () => {
    render(LandingFeaturesBento);
    const articles = screen.getAllByRole('article');
    expect(articles.length).toBe(4);
    for (const article of articles) expectPairedForeground(article);
  });
});

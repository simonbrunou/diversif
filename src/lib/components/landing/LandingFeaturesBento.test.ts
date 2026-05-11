// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
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
});

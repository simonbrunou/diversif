import { afterEach, describe, expect, it } from 'bun:test';
// @vitest-environment happy-dom
import { render, screen, cleanup } from '@testing-library/svelte';
import LandingTrustBento from './LandingTrustBento.svelte';

afterEach(() => cleanup());

describe('LandingTrustBento', () => {
  it('renders the three trust pillars', () => {
    render(LandingTrustBento);
    expect(screen.getByText('Sans télémétrie')).toBeTruthy();
    expect(screen.getByText('Sources scientifiques citées')).toBeTruthy();
    expect(screen.getByText('Vos données vous appartiennent')).toBeTruthy();
  });

  it('renders the section title', () => {
    render(LandingTrustBento);
    expect(screen.getByText('De la confiance, par construction')).toBeTruthy();
  });
});

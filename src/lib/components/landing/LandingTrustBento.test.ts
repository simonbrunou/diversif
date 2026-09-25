import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import LandingTrustBento from './LandingTrustBento.svelte';

afterEach(() => cleanup());

describe('LandingTrustBento', () => {
  it('renders the section title', () => {
    render(LandingTrustBento);
    expect(screen.getByText('De la confiance, par construction')).toBeTruthy();
  });
});

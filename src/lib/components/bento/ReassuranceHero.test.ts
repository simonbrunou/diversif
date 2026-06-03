import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import ReassuranceHero from './ReassuranceHero.svelte';

afterEach(() => cleanup());

describe('ReassuranceHero', () => {
  it('renders the reassurance body copy', () => {
    render(ReassuranceHero, {});
    expect(screen.getByText(/On vous accompagne/)).toBeTruthy();
  });
});

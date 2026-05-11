// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import ReassuranceHero from './ReassuranceHero.svelte';

afterEach(() => cleanup());

describe('ReassuranceHero', () => {
  it('renders the reassurance body copy', () => {
    render(ReassuranceHero, {});
    expect(screen.getByText(/On vous accompagne/)).toBeTruthy();
  });
});

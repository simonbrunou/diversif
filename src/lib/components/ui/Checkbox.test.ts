// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import Checkbox from './Checkbox.svelte';

afterEach(() => cleanup());

describe('Checkbox', () => {
  it('renders with role=checkbox', () => {
    render(Checkbox, { props: { checked: false } });
    expect(screen.getByRole('checkbox')).toBeTruthy();
  });

  it('reflects checked state', () => {
    render(Checkbox, { props: { checked: true } });
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('true');
  });
});

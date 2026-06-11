import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import { textSnippet } from '../../../test/component';
import FormError from './FormError.svelte';

afterEach(() => cleanup());

describe('FormError', () => {
  it('renders its message with role="alert" so screen readers announce it', () => {
    render(FormError, { props: { children: textSnippet('Adresse e-mail invalide.') } });
    const alert = screen.getByRole('alert');
    expect(alert.textContent?.trim()).toBe('Adresse e-mail invalide.');
  });

  it('applies the destructive palette tokens', () => {
    render(FormError, { props: { children: textSnippet('Boom') } });
    const alert = screen.getByRole('alert');
    expect(alert.className).toContain('border-destructive/30');
    expect(alert.className).toContain('bg-destructive/10');
    // Text uses the readable ink token, not the bare coral background hue.
    expect(alert.className).toContain('text-severe-text');
  });

  it('forwards an extra class via the class prop', () => {
    render(FormError, { props: { class: 'mt-4', children: textSnippet('x') } });
    expect(screen.getByRole('alert').className).toContain('mt-4');
  });
});

import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';
import { markHydrated } from '#lib/boot-recovery.js';
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

describe('FormError with a message key', () => {
  it('renders nothing while the action returned no key', () => {
    const { container } = render(FormError, { props: { messageKey: undefined, form: null } });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(container.textContent?.trim()).toBe('');
  });

  it('resolves a known key to its message, with role="alert"', () => {
    const form = { errorKey: 'errorsAccountPasswordIncorrect' };
    render(FormError, { props: { messageKey: form.errorKey, form } });
    expect(screen.getByRole('alert').textContent?.trim()).toBe('Mot de passe actuel incorrect.');
  });

  it('falls back to the generic message for an unknown key', () => {
    const form = { errorKey: 'notAMessageKey' };
    render(FormError, { props: { messageKey: form.errorKey, form } });
    expect(screen.getByRole('alert').textContent?.trim()).toBe('Une erreur s’est produite.');
  });

  it('keeps the same alert while the form is unchanged', async () => {
    const form = { errorKey: 'errorsAccountPasswordIncorrect' };
    const { rerender } = render(FormError, {
      props: { messageKey: form.errorKey, form, class: 'mt-2' }
    });
    const first = screen.getByRole('alert');
    await rerender({ messageKey: form.errorKey, form, class: 'mt-4' });
    expect(screen.getByRole('alert')).toBe(first);
    expect(first.className).toContain('mt-4');
  });

  // The next two rerenders swap `form` without the null step SvelteKit's
  // applyAction takes, so only the component's own key can re-insert the alert.
  it('re-inserts the alert for a second identical refusal, so it is announced again', async () => {
    const refusal = { errorKey: 'errorsAccountPasswordIncorrect' };
    const { rerender } = render(FormError, {
      props: { messageKey: refusal.errorKey, form: { ...refusal } }
    });
    const first = screen.getByRole('alert');
    await rerender({ messageKey: refusal.errorKey, form: { ...refusal } });
    expect(screen.getByRole('alert')).not.toBe(first);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('re-inserts a prose alert too when given a new form', async () => {
    const { rerender } = render(FormError, {
      props: { form: {}, children: textSnippet('Trop de tentatives.') }
    });
    const first = screen.getByRole('alert');
    await rerender({ form: {}, children: textSnippet('Trop de tentatives.') });
    expect(screen.getByRole('alert')).not.toBe(first);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });
});

// These tests cover the focus rule in FormError's header (#469). An alert
// that renders before the root layout marks the app hydrated stands in for a
// server-rendered one.
describe('FormError focus', () => {
  afterEach(() => {
    delete document.documentElement.dataset.hydrated;
  });

  it('takes focus when it is part of the server-rendered page', async () => {
    const form = { errorKey: 'errorsAccountPasswordIncorrect' };
    render(FormError, { props: { messageKey: form.errorKey, form } });
    const alert = screen.getByRole('alert');
    expect(alert.getAttribute('tabindex')).toBe('-1');
    await tick();
    expect(document.activeElement).toBe(alert);
  });

  // Focus on the body is the state in which an autofocused alert would take it.
  it('leaves focus alone when inserted after hydration, the JavaScript path', async () => {
    markHydrated();
    expect(document.activeElement?.tagName).toBe('BODY');
    const form = { errorKey: 'errorsAccountPasswordIncorrect' };
    render(FormError, { props: { messageKey: form.errorKey, form } });
    await tick();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(document.activeElement?.tagName).toBe('BODY');
  });

  // A page's FormError mounts with the page, while it hydrates, and its alert
  // comes later with an applied result: the check runs per alert, not per mount.
  it('leaves focus alone for an alert a FormError mounted during hydration shows later', async () => {
    const { rerender } = render(FormError, { props: { messageKey: undefined, form: null } });
    markHydrated();
    expect(document.activeElement?.tagName).toBe('BODY');
    const form = { errorKey: 'errorsAccountPasswordIncorrect' };
    await rerender({ messageKey: form.errorKey, form });
    await tick();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(document.activeElement?.tagName).toBe('BODY');
  });

  it('leaves focus alone when a later refusal replaces a server-rendered alert', async () => {
    const refusal = { errorKey: 'errorsAccountPasswordIncorrect' };
    const { rerender } = render(FormError, {
      props: { messageKey: refusal.errorKey, form: { ...refusal } }
    });
    await tick();
    const first = screen.getByRole('alert');
    expect(document.activeElement).toBe(first);
    markHydrated();
    // Move focus from the alert to the body, as disabling the submit button
    // does. Autofocus acts only when the body has focus, so the new alert
    // would take it from there.
    first.blur();
    expect(document.activeElement?.tagName).toBe('BODY');
    await rerender({ messageKey: refusal.errorKey, form: { ...refusal } });
    await tick();
    expect(screen.getByRole('alert')).not.toBe(first);
    expect(document.activeElement?.tagName).toBe('BODY');
  });
});

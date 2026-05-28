import { afterEach, describe, expect, it, mock } from 'bun:test';
// @vitest-environment happy-dom
import { render, cleanup, screen, fireEvent } from '@testing-library/svelte';

// happy-dom's cloneNode interaction with bits-ui's Portal trips $app/forms'
// "method must be POST" guard. Stub `enhance` for unit tests; e2e covers the
// real form submission.
mock.module('$app/forms', () => ({
  enhance: () => ({ destroy: () => {} })
}));

import ConfirmModal from './ConfirmModal.svelte';

afterEach(() => cleanup());

describe('ConfirmModal', () => {
  it('renders title and description when open', () => {
    render(ConfirmModal, {
      props: {
        open: true,
        title: 'Supprimer Léo ?',
        description: 'Cette action est définitive.',
        action: '?/deleteChild',
        confirmLabel: 'Supprimer'
      }
    });
    expect(screen.getByText('Supprimer Léo ?')).toBeTruthy();
    expect(screen.getByText('Cette action est définitive.')).toBeTruthy();
  });

  it('renders Annuler + Confirmer buttons by default', () => {
    render(ConfirmModal, {
      props: {
        open: true,
        title: 'X',
        action: '?/x',
        confirmLabel: 'OK'
      }
    });
    expect(screen.getByRole('button', { name: 'Annuler' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'OK' })).toBeTruthy();
  });

  it('uses the destructive variant when destructive=true', () => {
    render(ConfirmModal, {
      props: {
        open: true,
        title: 'X',
        action: '?/x',
        confirmLabel: 'Delete',
        destructive: true
      }
    });
    const submit = screen.getByRole('button', { name: 'Delete' }) as HTMLButtonElement;
    expect(submit.className).toContain('bg-severe');
  });

  it('disables the confirm button until requireText matches', async () => {
    render(ConfirmModal, {
      props: {
        open: true,
        title: 'X',
        action: '?/x',
        confirmLabel: 'OK',
        requireText: 'Léo'
      }
    });
    const submit = screen.getByRole('button', { name: 'OK' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    // The text confirm input uses the placeholder of the requireText value
    const input = screen.getByPlaceholderText('Léo') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'Léo' } });
    expect(submit.disabled).toBe(false);
  });

  it('disables the confirm button until requirePassword input has a value', async () => {
    render(ConfirmModal, {
      props: {
        open: true,
        title: 'X',
        action: '?/x',
        confirmLabel: 'OK',
        requirePassword: true
      }
    });
    const submit = screen.getByRole('button', { name: 'OK' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
    const pwd = document.querySelector('input[type="password"]') as HTMLInputElement;
    expect(pwd).not.toBeNull();
    await fireEvent.input(pwd, { target: { value: 'a' } });
    expect(submit.disabled).toBe(false);
  });

  it('sets the form action attribute', () => {
    render(ConfirmModal, {
      props: {
        open: true,
        title: 'X',
        action: '?/myAction',
        confirmLabel: 'OK'
      }
    });
    // bits-ui Portal moves dialog content outside `container`; query document.
    const form = document.querySelector('form');
    expect(form?.getAttribute('action')).toBe('?/myAction');
    expect(form?.getAttribute('method')?.toLowerCase()).toBe('post');
  });

  it('resets confirmText + confirmPassword when open flips to false', async () => {
    const { rerender } = render(ConfirmModal, {
      props: {
        open: true,
        title: 'X',
        action: '?/x',
        confirmLabel: 'OK',
        requireText: 'Léo',
        requirePassword: true
      }
    });
    const input = screen.getByPlaceholderText('Léo') as HTMLInputElement;
    const pwd = document.querySelector('input[type="password"]') as HTMLInputElement;
    await fireEvent.input(input, { target: { value: 'Léo' } });
    await fireEvent.input(pwd, { target: { value: 'secret' } });
    expect(input.value).toBe('Léo');
    expect(pwd.value).toBe('secret');

    // Simulate Escape / overlay-click / parent setting open=false (bypasses Cancel).
    await rerender({
      open: false,
      title: 'X',
      action: '?/x',
      confirmLabel: 'OK',
      requireText: 'Léo',
      requirePassword: true
    });
    await rerender({
      open: true,
      title: 'X',
      action: '?/x',
      confirmLabel: 'OK',
      requireText: 'Léo',
      requirePassword: true
    });

    // After reopen, the input nodes are remounted with empty values.
    const input2 = screen.getByPlaceholderText('Léo') as HTMLInputElement;
    const pwd2 = document.querySelector('input[type="password"]') as HTMLInputElement;
    expect(input2.value).toBe('');
    expect(pwd2.value).toBe('');
    const submit = screen.getByRole('button', { name: 'OK' }) as HTMLButtonElement;
    expect(submit.disabled).toBe(true);
  });
});

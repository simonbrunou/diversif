import { afterEach, describe, expect, it } from 'bun:test';
// @vitest-environment happy-dom
import { render, cleanup, screen } from '@testing-library/svelte';
import { createRawSnippet, type Snippet } from 'svelte';
import Field from './Field.svelte';

afterEach(() => cleanup());

const inputSnippet = (id: string): Snippet =>
  createRawSnippet(() => ({
    render: () => `<input id="${id}" type="text" />`
  })) as unknown as Snippet;

describe('Field', () => {
  it('renders a label whose for attribute matches the name', () => {
    render(Field, {
      props: { name: 'email', label: 'Adresse e-mail', children: inputSnippet('email') }
    });
    const label = screen.getByText('Adresse e-mail') as HTMLLabelElement;
    expect(label.tagName.toLowerCase()).toBe('label');
    expect(label.getAttribute('for')).toBe('email');
  });

  it('renders the children (the input)', () => {
    const { container } = render(Field, {
      props: { name: 'email', label: 'Adresse e-mail', children: inputSnippet('email') }
    });
    expect(container.querySelector('input#email')).not.toBeNull();
  });

  it('renders the optional hint below the input', () => {
    render(Field, {
      props: {
        name: 'email',
        label: 'Adresse e-mail',
        hint: '8 caractères minimum',
        children: inputSnippet('email')
      }
    });
    expect(screen.getByText('8 caractères minimum')).toBeTruthy();
  });

  it('renders FormError when error is provided', () => {
    render(Field, {
      props: {
        name: 'email',
        label: 'Adresse e-mail',
        error: 'Adresse invalide',
        children: inputSnippet('email')
      }
    });
    const err = screen.getByRole('alert');
    expect(err.textContent).toContain('Adresse invalide');
  });

  it('does not render FormError when no error', () => {
    render(Field, {
      props: { name: 'email', label: 'Adresse e-mail', children: inputSnippet('email') }
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('forwards a custom class onto the wrapper', () => {
    const { container } = render(Field, {
      props: {
        name: 'email',
        label: 'Adresse e-mail',
        class: 'mb-4',
        children: inputSnippet('email')
      }
    });
    expect(container.querySelector('div.mb-4')).not.toBeNull();
  });
});

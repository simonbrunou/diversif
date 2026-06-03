import { afterEach, describe, expect, it, spyOn } from 'bun:test';
import { render, fireEvent, screen, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import PrintShell from './PrintShell.svelte';

afterEach(() => cleanup());

function textSnippet(text: string) {
  return createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));
}

describe('PrintShell', () => {
  it('renders the title in <title> and the Imprimer button', () => {
    render(PrintShell, {
      props: {
        title: 'Récap pédiatrique : Léo · Diversif',
        children: textSnippet('contenu')
      }
    });
    expect(document.title).toBe('Récap pédiatrique : Léo · Diversif');
    expect(screen.getByRole('button', { name: /imprimer/i })).toBeTruthy();
    expect(screen.getByText('contenu')).toBeTruthy();
  });

  it('renders the toolbarStart snippet when provided', () => {
    render(PrintShell, {
      props: {
        title: 'Doc',
        toolbarStart: textSnippet('← Tableau'),
        children: textSnippet('body')
      }
    });
    expect(screen.getByText('← Tableau')).toBeTruthy();
  });

  it('invokes window.print() when the Imprimer button is clicked', async () => {
    const spy = spyOn(window, 'print').mockImplementation(() => {});
    render(PrintShell, {
      props: { title: 'Doc', children: textSnippet('body') }
    });
    await fireEvent.click(screen.getByRole('button', { name: /imprimer/i }));
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});

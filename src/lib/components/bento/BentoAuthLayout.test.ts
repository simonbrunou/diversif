import { afterEach, describe, expect, it } from 'bun:test';
import { render, screen, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import BentoAuthLayout from './BentoAuthLayout.svelte';

afterEach(() => cleanup());

describe('BentoAuthLayout', () => {
  function makeSnippet(html: string) {
    return createRawSnippet(() => ({ render: () => html }));
  }

  it('renders the bento mark and title slot', () => {
    render(BentoAuthLayout, {
      props: {
        title: 'Bienvenue',
        subtitle: 'Sub',
        children: makeSnippet('<p>form content</p>')
      }
    });
    expect(screen.getByLabelText('Diversif')).toBeTruthy();
    expect(screen.getByText('Bienvenue')).toBeTruthy();
    expect(screen.getByText('Sub')).toBeTruthy();
    expect(screen.getByText('form content')).toBeTruthy();
  });

  it('applies the gradient backdrop class', () => {
    const { container } = render(BentoAuthLayout, {
      props: { title: 'X', subtitle: 'Y', children: makeSnippet('<p></p>') }
    });
    const backdrop = container.querySelector('.bg-gradient-to-b');
    expect(backdrop).toBeTruthy();
  });
});

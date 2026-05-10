// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Tooltip from './Tooltip.svelte';

afterEach(() => cleanup());

const text = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

describe('Tooltip', () => {
  it('renders the trigger child', () => {
    render(Tooltip, {
      props: {
        content: 'hello',
        children: text('button text')
      }
    });
    expect(screen.getByText('button text')).toBeTruthy();
  });
});

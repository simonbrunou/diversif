// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Popover from './Popover.svelte';

afterEach(() => cleanup());

const text = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

describe('Popover', () => {
  it('renders content when open', () => {
    render(Popover, {
      props: {
        open: true,
        trigger: text('open me'),
        children: text('panel')
      }
    });
    expect(screen.getByText('panel')).toBeTruthy();
  });
});

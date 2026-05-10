// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Tabs from './Tabs.svelte';

afterEach(() => cleanup());

const text = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

describe('Tabs', () => {
  it('renders tab labels and shows the default panel', () => {
    render(Tabs, {
      props: {
        value: 'one',
        items: [
          { value: 'one', label: 'One', panel: text('content one') },
          { value: 'two', label: 'Two', panel: text('content two') }
        ]
      }
    });
    expect(screen.getByText('One')).toBeTruthy();
    expect(screen.getByText('Two')).toBeTruthy();
    expect(screen.getByText('content one')).toBeTruthy();
  });
});

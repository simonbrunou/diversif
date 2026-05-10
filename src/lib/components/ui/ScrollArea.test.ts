// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import ScrollArea from './ScrollArea.svelte';

afterEach(() => cleanup());

const text = (s: string) => createRawSnippet(() => ({ render: () => `<span>${s}</span>` }));

describe('ScrollArea', () => {
  it('renders children inside the viewport', () => {
    render(ScrollArea, { props: { children: text('payload') } });
    expect(screen.getByText('payload')).toBeTruthy();
  });
});

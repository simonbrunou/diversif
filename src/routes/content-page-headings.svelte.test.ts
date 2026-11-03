import { afterEach, describe, expect, it } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/svelte';
import GuidePage from './guide/+page.svelte';
import AllergensPage from './allergens/+page.svelte';
import SourcesPage from './sources/+page.svelte';

afterEach(() => cleanup());

// DESIGN.md: "Don't put an eyebrow above a heading", and sage marks only
// actions (The One Voice Rule). These three headers carried a sage, uppercase
// kicker repeating the page name above the h1 (#360).
describe.each([
  ['/guide', GuidePage],
  ['/allergens', AllergensPage],
  ['/sources', SourcesPage]
] as const)('%s header', (_route, Page) => {
  it('opens on its h1, with no kicker above it', () => {
    render(Page);
    const title = screen.getByRole('heading', { level: 1 });
    // outerHTML: see docs/agents/testing.md, "An element that must be absent".
    expect(title.previousElementSibling?.outerHTML ?? null).toBeNull();
    const header = title.closest('header');
    expect(header).not.toBeNull();
    expect(header?.querySelector('.uppercase, .text-primary-strong')?.outerHTML ?? null).toBeNull();
  });
});

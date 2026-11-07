import { afterEach, describe, expect, it, mock } from 'bun:test';
import { cleanup, render, screen } from '@testing-library/svelte';

// The error page reads the status and error from $app/state, so each test
// sets them on this object before it renders.
const page: {
  url: URL;
  status: number;
  error: { message: string; errorId?: string } | null;
} = { url: new URL('http://localhost/nope'), status: 404, error: null };

mock.module('$app/state', () => ({ page, navigating: null, updated: { current: false } }));
// No DSN: the page offers no problem report, which these tests do not cover.
mock.module('@sentry/sveltekit', () => ({ getClient: () => undefined }));

const { default: ErrorPage } = await import('./+error.svelte');

afterEach(() => cleanup());

describe('error page status (#360)', () => {
  it('shows a 404 status after the title, not as an eyebrow above it', () => {
    page.status = 404;
    page.error = { message: 'Not Found' };
    render(ErrorPage);

    const title = screen.getByRole('heading', { level: 1, name: 'Page introuvable' });
    // outerHTML: see docs/agents/testing.md, "An element that must be absent".
    expect(title.previousElementSibling?.outerHTML ?? null).toBeNull();

    const status = screen.getByText('Erreur 404');
    expect(status.className).not.toContain('uppercase');
    expect(status.className).not.toContain('tracking-');
    expect(title.compareDocumentPosition(status) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('puts the error reference on the status line when the error has one', () => {
    page.status = 500;
    page.error = { message: 'Internal Error', errorId: 'abc123' };
    render(ErrorPage);

    const ref = screen.getByText('abc123');
    expect(ref.parentElement?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Erreur 500 · Réf : abc123'
    );
  });
});

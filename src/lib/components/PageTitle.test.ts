import { afterEach, describe, expect, it } from 'bun:test';
import { render, cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';
import { SITE } from '#lib/seo.js';
import PageTitle, { currentTitle } from './PageTitle.svelte';

const APP_TITLE = SITE.title;

afterEach(() => cleanup());

describe('PageTitle', () => {
  it('sets the document title and names the page while mounted', () => {
    const { unmount } = render(PageTitle, { props: { title: 'Connexion' } });
    expect(document.title).toBe('Connexion');
    expect(currentTitle()).toBe('Connexion');
    unmount();
    // Svelte leaves document.title alone on unmount; the root layout writes
    // currentTitle() to it, which is what brings the app-wide title back.
    expect(currentTitle()).toBe(APP_TITLE);
  });

  it('keeps the newer page title when the older one unmounts after it mounted', () => {
    const older = render(PageTitle, { props: { title: 'Connexion' } });
    const newer = render(PageTitle, { props: { title: 'Guide' } });
    older.unmount();
    expect(currentTitle()).toBe('Guide');
    newer.unmount();
    expect(currentTitle()).toBe(APP_TITLE);
  });

  it('follows a title change without a remount', async () => {
    const { rerender, unmount } = render(PageTitle, { props: { title: 'Bilan : Léo' } });
    await rerender({ title: 'Bilan : Emma' });
    await tick();
    expect(document.title).toBe('Bilan : Emma');
    expect(currentTitle()).toBe('Bilan : Emma');
    // The change replaced the claim instead of stacking a second one.
    unmount();
    expect(currentTitle()).toBe(APP_TITLE);
  });
});

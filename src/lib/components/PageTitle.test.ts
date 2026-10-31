import { afterEach, describe, expect, it } from 'bun:test';
import path from 'node:path';
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

  it('is the only component that renders a <title>', async () => {
    // A second source would bring #483 back: the server keeps one <title> by
    // tree position, which a component bind: breaks (#596), and a title that
    // no PageTitle claims stays on the tab after a client navigation.
    const src = path.resolve(import.meta.dir, '../..');
    const others: string[] = [];
    for await (const file of new Bun.Glob('**/*.svelte').scan(src)) {
      if (file === 'lib/components/PageTitle.svelte') continue;
      const code = (await Bun.file(path.join(src, file)).text()).replace(/<!--[\s\S]*?-->/g, '');
      const heads = code.match(/<svelte:head\b[^>]*>[\s\S]*?<\/svelte:head>/g) ?? [];
      // An SVG's <title> labels the drawing, not the document.
      const documentTitle = (head: string) =>
        /<title[\s>]/.test(head.replace(/<svg\b[\s\S]*?<\/svg>/g, ''));
      if (heads.some(documentTitle)) others.push(file);
    }
    expect(others).toEqual([]);
  });
});

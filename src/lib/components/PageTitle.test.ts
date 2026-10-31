import { afterEach, describe, expect, it } from 'bun:test';
import path from 'node:path';
import { render, cleanup } from '@testing-library/svelte';
import { tick } from 'svelte';
import { parse } from 'svelte/compiler';
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
      if (rendersHeadTitle(await Bun.file(path.join(src, file)).text())) others.push(file);
    }
    expect(others).toEqual([]);
  });
});

// Svelte's parser marks a <title> directly in <svelte:head> as TitleElement.
// One under a component there is a RegularElement, yet the component can
// render it into the head, so any <title> inside the head counts, except an
// SVG's, which labels the drawing. Attribute text holds no element. Markup
// that a {@html} tag writes into the head is not seen.
function rendersHeadTitle(code: string): boolean {
  const walk = (node: unknown, inHead: boolean): boolean => {
    if (typeof node !== 'object' || node === null) return false;
    const { type, name } = node as { type?: unknown; name?: unknown };
    if (type === 'TitleElement' || (inHead && type === 'RegularElement' && name === 'title')) {
      return true;
    }
    if (type === 'RegularElement' && name === 'svg') return false;
    return Object.values(node).some((child) => walk(child, inHead || type === 'SvelteHead'));
  };
  return walk(parse(code, { modern: true }).fragment, false);
}

describe('the <title> source guard', () => {
  it.each([
    ['<svelte:head><title>x</title></svelte:head>', true],
    ['<svelte:head ><title>x</title></svelte:head>', true],
    ['<svelte:head>{#if ok}<title>x</title>{/if}</svelte:head>', true],
    ['<svelte:head><Wrapper><title>x</title></Wrapper></svelte:head>', true],
    ['<svelte:head><svg><title>x</title></svg></svelte:head>', false],
    ['<svelte:head><meta content="<title>x</title>" /></svelte:head>', false],
    ['<svg><title>x</title></svg>', false]
  ])('reads %s as %p', (code, expected) => {
    expect(rendersHeadTitle(code)).toBe(expected);
  });
});

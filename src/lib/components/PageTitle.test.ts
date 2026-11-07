import { afterEach, describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
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

  it('is the only component that renders a <title>', () => {
    // A second source would bring #483 back: the server keeps one <title> by
    // tree position, which a component bind: breaks (#596), and a title that
    // no PageTitle claims stays on the tab after a client navigation.
    // On a loaded runner, parsing and awaiting a read of every file once took
    // this test past the 5 s timeout (#687). rendersHeadTitle now skips the
    // parse for most files, and the reads are synchronous.
    const src = path.resolve(import.meta.dir, '../..');
    const scanned: string[] = [];
    const others: string[] = [];
    for (const file of new Bun.Glob('**/*.svelte').scanSync(src)) {
      scanned.push(file);
      if (file === 'lib/components/PageTitle.svelte') continue;
      if (rendersHeadTitle(readFileSync(path.join(src, file), 'utf8'))) others.push(file);
    }
    // The scan must reach the file it skips: one that found no file would pass.
    expect(scanned).toContain('lib/components/PageTitle.svelte');
    expect(others).toEqual([]);
  });
});

// Svelte's parser marks a <title> directly in <svelte:head> as TitleElement.
// One under a component there is a RegularElement, yet the component can
// render it into the head, so any <title> inside the head counts, except an
// SVG's, which labels the drawing. Attribute text holds no element. Markup
// that a {@html} tag writes into the head is not seen.
//
// The parser builds either node only from the literal text `<title`, so a
// file without that text, as most are, needs no parse (#687). The parser
// still decides every file that holds it: it replaced a regex that flagged
// title text in an attribute value (ed4e7ca).
function rendersHeadTitle(code: string): boolean {
  if (!code.includes('<title')) return false;
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
    ['<svg><title>x</title></svg>', false],
    ['<svelte:head><title\n>x</title></svelte:head>', true],
    // The parser rejects this, so it passes only when the text check, which
    // finds no <title, decides it.
    ['{#if', false]
  ])('reads %s as %p', (code, expected) => {
    expect(rendersHeadTitle(code)).toBe(expected);
  });
});

// The components that render a page's PageTitle. A page renders one of them
// anywhere in its markup, a branch of an {#if} included: the landing page
// names itself differently signed in and signed out.
const TITLE_COMPONENTS = new Set(['PageTitle', 'Seo', 'PrintShell']);

function rendersTitleComponent(code: string): boolean {
  const walk = (node: unknown): boolean => {
    if (typeof node !== 'object' || node === null) return false;
    const { type, name } = node as { type?: unknown; name?: unknown };
    if (type === 'Component' && typeof name === 'string' && TITLE_COMPONENTS.has(name)) return true;
    return Object.values(node).some(walk);
  };
  return walk(parse(code, { modern: true }).fragment);
}

async function routeFiles(pattern: string): Promise<{ file: string; code: string }[]> {
  const routes = path.resolve(import.meta.dir, '../../routes');
  const files: { file: string; code: string }[] = [];
  for await (const file of new Bun.Glob(pattern).scan(routes)) {
    files.push({ file, code: await Bun.file(path.join(routes, file)).text() });
  }
  return files;
}

describe('every route names itself', () => {
  it('renders PageTitle, Seo or PrintShell on every page and error page', async () => {
    // Without one, the page carries the app-wide title, and a screen reader
    // announces the same title on every such page (#597).
    const pages = await routeFiles('**/{+page,+error}.svelte');
    // The glob reaches both file names and a nested dynamic segment.
    expect(pages.map((p) => p.file)).toEqual(
      expect.arrayContaining(['+error.svelte', 'child/[id]/foods/+page.svelte'])
    );
    const untitled = pages.filter(({ code }) => !rendersTitleComponent(code)).map((p) => p.file);
    expect(untitled).toEqual([]);
  });

  it('renders none of them in a layout', async () => {
    // A layout title next to the page's would be two sources, and Svelte's
    // server render can pick the layout's under a component bind: (#596).
    const layouts = await routeFiles('**/+layout.svelte');
    expect(layouts.map((l) => l.file)).toEqual(
      expect.arrayContaining(['+layout.svelte', 'child/[id]/+layout.svelte'])
    );
    const titled = layouts.filter(({ code }) => rendersTitleComponent(code)).map((l) => l.file);
    expect(titled).toEqual([]);
  });

  it.each([
    ['<PageTitle title="x" />', true],
    ['{#if ok}<Seo title="x" path="/" />{/if}', true],
    ['<PrintShell title="x">y</PrintShell>', true],
    ['<!-- <PageTitle title="x" /> -->', false],
    ['<p>PageTitle</p>', false],
    ['<OtherTitle title="x" />', false]
  ])('reads %s as %p', (code, expected) => {
    expect(rendersTitleComponent(code)).toBe(expected);
  });
});

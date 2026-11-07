import { afterEach, describe, expect, it } from 'bun:test';
import { cleanup, render } from '@testing-library/svelte';
import GuidePage from './guide/+page.svelte';
import SourcesPage from './sources/+page.svelte';
import { mistaggedSourceTexts } from '../test/source-lang';

afterEach(() => cleanup());

// /guide's sources section and the /sources page print every title and org
// name inside the page's <section lang="fr">, but the catalog mixes French
// and English: espghan-2017's title is English, who-cf's title English and
// its org name French, eaaci-2020's org name English. Each text declares its
// own language, so the section's lang="fr" does not count (#665).
describe.each([
  ['/guide', GuidePage, 'section[lang="fr"] #sources ul'],
  ['/sources', SourcesPage, 'section[lang="fr"] ul']
] as const)('%s source list', (_route, Page, listSelector) => {
  it('tags each title and org name with the language the catalog declares', () => {
    const { container } = render(Page);
    const list = container.querySelector(listSelector);
    if (!list) throw new Error(`no ${listSelector} on the page`);
    expect(mistaggedSourceTexts(list)).toEqual([]);
  });
});

import { afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { cleanup, render } from '@testing-library/svelte';
import { baseLocale, overwriteGetLocale } from '#lib/paraglide/runtime.js';
import GuidePage from './guide/+page.svelte';
import AllergensPage from './allergens/+page.svelte';
import { ALLERGENS, getAllergenLabel, type AllergenId } from '#lib/utils/allergens.js';
import { ALL_SOURCE_IDS, SOURCES } from '#lib/content/sources.js';

afterEach(() => {
  cleanup();
  overwriteGetLocale(() => baseLocale);
});

type Text = { text: string; langEl: Element | null };

/** Each text inside the page's French-only section, with the element it takes its lang from. */
function frSectionTexts(Page: typeof GuidePage, locale: 'fr' | 'en'): Text[] {
  overwriteGetLocale(() => locale);
  const { container } = render(Page);
  const section = container.querySelector('section[lang="fr"]');
  if (!section) throw new Error('no <section lang="fr"> on the page');
  const walker = document.createTreeWalker(section, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent?.trim() ?? '';
    if (text) texts.push({ text, langEl: node.parentElement?.closest('[lang]') ?? null });
  }
  cleanup();
  return texts;
}

// /guide and /allergens keep their content in French on /en too, inside a
// <section lang="fr">. A label that follows the locale (a paraglide message)
// prints English there, so it must declare lang="en", or a screen reader
// reads "Advantages" or "Peanut" with French pronunciation. A text that reads
// the same in both renders is French content, unless it is an allergen name
// spelled alike in both languages ("Gluten"), or a source title or org name
// the catalog declares English (#665). An inline citation prints its org name
// and year as one text: "NEJM (Perkin et al.) (2016)".
const englishSourceTexts = new Set(
  ALL_SOURCE_IDS.flatMap((id) => {
    const s = SOURCES[id];
    return [
      ...(s.labelLang === 'en' ? [s.label] : []),
      ...(s.orgLang === 'en' ? [s.org, `${s.org} (${s.year})`] : [])
    ];
  })
);

describe.each([
  ['/guide', GuidePage],
  ['/allergens', AllergensPage]
] as const)('%s French-only section', (_route, Page) => {
  let fr: Text[] = [];
  let en: Text[] = [];
  let namesAlike = new Set<string>();
  beforeAll(() => {
    fr = frSectionTexts(Page, 'fr');
    en = frSectionTexts(Page, 'en');
    const label = (locale: 'fr' | 'en', id: AllergenId) => {
      overwriteGetLocale(() => locale);
      return getAllergenLabel(id);
    };
    namesAlike = new Set(
      ALLERGENS.filter((a) => label('fr', a.id) === label('en', a.id)).map((a) => label('en', a.id))
    );
    overwriteGetLocale(() => baseLocale);
  });
  const changed = (i: number) => en[i].text !== fr[i].text;

  it('renders the same texts in both locales, in the same order', () => {
    expect(en.length).toBe(fr.length);
    // The checks below reach the labels they guard: some text does change.
    expect(en.some((_, i) => changed(i))).toBe(true);
  });

  it('tags every text that follows the locale with that locale', () => {
    const untagged = en.filter((t, i) => changed(i) && t.langEl?.getAttribute('lang') !== 'en');
    expect(untagged.map((t) => t.text)).toEqual([]);
  });

  it('keeps French text out of the elements it tags English', () => {
    const french = en.filter(
      (t, i) =>
        !changed(i) &&
        t.langEl?.getAttribute('lang') === 'en' &&
        !namesAlike.has(t.text) &&
        !englishSourceTexts.has(t.text)
    );
    expect(french.map((t) => t.text)).toEqual([]);
  });
});

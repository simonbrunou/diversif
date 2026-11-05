import { within } from '@testing-library/svelte';
import { ALL_SOURCE_IDS, SOURCES } from '#lib/content/sources.js';

/**
 * The language `el` resolves to, from its nearest `[lang]` ancestor, or null
 * when that ancestor lies outside `root`. A citation must tag its own texts,
 * so the page around it (a `<section lang="fr">`, `<html lang="en">`) must
 * not decide the result (#665).
 */
export function langWithin(el: Element, root: Element): string | null {
  const tagged = el.closest('[lang]');
  return tagged && root.contains(tagged) ? tagged.getAttribute('lang') : null;
}

/**
 * Checks a list that shows every source as a `<li>` holding its title and
 * org name as texts of their own (/guide's sources section, the /sources
 * page). Returns one line per text that does not resolve, inside its `<li>`,
 * to the language the catalog declares for it.
 */
export function mistaggedSourceTexts(list: Element): string[] {
  return ALL_SOURCE_IDS.flatMap((id) => {
    const s = SOURCES[id];
    const link = [...list.querySelectorAll('a')].find((a) => a.getAttribute('href') === s.url);
    const item = link?.closest('li');
    if (!item) return [`${id}: no list item links to ${s.url}`];
    const q = within(item as HTMLElement);
    return [
      { text: 'title', got: langWithin(q.getByText(s.label), item), want: s.labelLang },
      { text: 'org', got: langWithin(q.getByText(s.org), item), want: s.orgLang }
    ]
      .filter((t) => t.got !== t.want)
      .map((t) => `${id} ${t.text}: ${t.got}, want ${t.want}`);
  });
}

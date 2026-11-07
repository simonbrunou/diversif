import { afterEach, describe, expect, it } from 'bun:test';
import { render } from '@testing-library/svelte';
import '../../../../../../test/component';
import '../../../../../../test/app-stubs';
import { baseLocale, overwriteGetLocale } from '#lib/paraglide/runtime.js';
import type { PageData } from './$types';

// Static imports would hoist past the app-stubs mocks, so Page is imported
// after them.
const { default: Page } = await import('./+page.svelte');

afterEach(() => {
  overwriteGetLocale(() => baseLocale);
});

// The loader formats the dates in the request's locale; the page gets them as
// text.
function makeData(givenAt: string): PageData {
  return {
    childName: 'Léo',
    months: 7,
    foodName: 'Poire',
    reaction: 'reaction',
    givenAt,
    symptoms: [],
    generatedAt: givenAt
  } as unknown as PageData;
}

// The paragraph of the « Aliment » / "Food" section.
function foodLine(container: HTMLElement): string | undefined {
  return container.querySelectorAll('section')[0]?.querySelector('p')?.textContent?.trim();
}

describe('print +page.svelte — food line', () => {
  it('joins the food and its date with the French colon and names the reaction (fr)', () => {
    overwriteGetLocale(() => 'fr');
    const { container } = render(Page, { props: { data: makeData('2 novembre 2026 à 10:00') } });
    expect(foodLine(container)).toBe('Poire : 2 novembre 2026 à 10:00 (Réaction marquée)');
  });

  it('puts no space before the colon and names the reaction in English (en)', () => {
    overwriteGetLocale(() => 'en');
    const { container } = render(Page, { props: { data: makeData('2 November 2026 at 10:00') } });
    expect(foodLine(container)).toBe('Poire: 2 November 2026 at 10:00 (Marked reaction)');
  });
});

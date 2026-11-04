import { afterEach, describe, expect, it } from 'bun:test';
import { render } from '@testing-library/svelte';
import '../../test/component';
import { baseLocale, overwriteGetLocale } from '#lib/paraglide/runtime.js';
import StageBadge from './StageBadge.svelte';
import { STAGES } from '#lib/content/guidance.js';

afterEach(() => overwriteGetLocale(() => baseLocale));

describe('StageBadge', () => {
  // The badge sits beside its stage's title in the guide: both name the same
  // range, "12 mois–3 ans", never the id's "12-36 mois".
  for (const stage of STAGES) {
    it(`names the range of its stage's title for ${stage.id}`, () => {
      const { container } = render(StageBadge, { props: { stage } });
      const titleRange = stage.title.split(' · ')[0];
      expect(container.textContent?.trim()).toBe(`Étape ${titleRange}`);
    });
  }

  it('names the range in English', () => {
    overwriteGetLocale(() => 'en');
    const { container } = render(StageBadge, { props: { stage: STAGES[STAGES.length - 1] } });
    expect(container.textContent?.trim()).toBe('Stage 12 months–3 years');
  });

  // /guide wraps its stages in <section lang="fr">, also on /en/guide, where
  // the badge prints English: it carries its own lang so a screen reader
  // doesn't read "Stage 9–12 months" with French pronunciation.
  for (const locale of ['fr', 'en'] as const) {
    it(`declares the ${locale} locale it prints in`, () => {
      overwriteGetLocale(() => locale);
      const { container } = render(StageBadge, { props: { stage: STAGES[0] } });
      expect(container.querySelector('span')?.getAttribute('lang')).toBe(locale);
    });
  }

  it('renders an icon', () => {
    const { container } = render(StageBadge, { props: { stage: STAGES[0] } });
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('appends additional classes', () => {
    const stage = STAGES[0];
    const { container } = render(StageBadge, { props: { stage, class: 'extra' } });
    expect(container.querySelector('span')?.className).toContain('extra');
  });
});

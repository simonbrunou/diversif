import { describe, expect, it } from 'bun:test';
import { render } from '@testing-library/svelte';
import '../../test/component';
import EmphasisText from './EmphasisText.svelte';

function renderText(text: string) {
  const { container } = render(EmphasisText, { props: { text } });
  const strongs = [...container.querySelectorAll('strong')];
  return { container, strongs: strongs.map((s) => s.textContent), strongEls: strongs };
}

describe('EmphasisText', () => {
  it('prints a string without markers as it is', () => {
    const { container, strongs } = renderText('Dès 4 mois, en purée lisse.');
    expect(container.textContent).toBe('Dès 4 mois, en purée lisse.');
    expect(strongs).toEqual([]);
  });

  it('sets the marked text in <strong>, without the markers or added spaces', () => {
    const { container, strongs } = renderText('Le lait de vache **liquide** ne remplace pas.');
    expect(container.textContent).toBe('Le lait de vache liquide ne remplace pas.');
    expect(strongs).toEqual(['liquide']);
  });

  it('opens on the <strong> when the string starts with a marker', () => {
    const { container, strongs } = renderText('**Jamais** de cacahuètes entières.');
    expect(container.textContent).toBe('Jamais de cacahuètes entières.');
    expect(container.firstElementChild?.tagName).toBe('STRONG');
    expect(strongs).toEqual(['Jamais']);
  });

  // DESIGN.md, The Paired Foreground Rule: inside a tint, the <strong> takes
  // the tint's foreground from its parent.
  it('gives the <strong> no class of its own', () => {
    const { strongEls } = renderText('**Jamais** seul, **toujours** assis.');
    expect(strongEls.map((s) => s.getAttribute('class'))).toEqual([null, null]);
  });

  it('keeps an unpaired marker as literal text', () => {
    const { container, strongs } = renderText('5 ** 2');
    expect(container.textContent).toBe('5 ** 2');
    expect(strongs).toEqual([]);
  });

  it('prints markup inside a guidance string as text', () => {
    const { container, strongs } = renderText('**<img src=x onerror=alert(1)>**');
    expect(strongs).toEqual(['<img src=x onerror=alert(1)>']);
    expect(container.querySelector('img')?.outerHTML ?? null).toBeNull();
  });
});

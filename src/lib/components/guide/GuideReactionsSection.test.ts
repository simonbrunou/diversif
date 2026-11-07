import { describe, expect, it } from 'bun:test';
import { render, screen } from '@testing-library/svelte';
import '../../../test/component';
import { expectPairedForeground } from '../../../test/paired-foreground';
import GuideReactionsSection from './GuideReactionsSection.svelte';

function cardOf(title: string | RegExp): Element {
  const card = screen.getByText(title).closest('.rounded-tile');
  if (!card) throw new Error(`no card around ${String(title)}`);
  return card;
}

describe('GuideReactionsSection', () => {
  it("sets the reaction card, sources included, in the reaction tint's own foreground (#649)", () => {
    render(GuideReactionsSection);
    const card = cardOf('Symptômes pouvant évoquer une réaction allergique');
    expect(card.classList.contains('bg-reaction-reaction/5')).toBe(true);
    expect(card.querySelector('a[href]')).not.toBeNull();
    expectPairedForeground(card);
  });

  it('sets the marked safety point of the reaction card in <strong>, with no ** (#668)', () => {
    render(GuideReactionsSection);
    const card = cardOf('Symptômes pouvant évoquer une réaction allergique');
    const strong = screen.getByText('appeler le 15 ou le 112 sans attendre');
    expect(strong.tagName).toBe('STRONG');
    expect(card.contains(strong)).toBe(true);
    expect(card.textContent).not.toContain('**');
  });

  it("sets the emergency card in the reaction tint's own foreground (#649)", () => {
    render(GuideReactionsSection);
    const card = cardOf(/Urgence : appeler le/);
    expect(card.classList.contains('bg-reaction-reaction/10')).toBe(true);
    expectPairedForeground(card);
  });

  it('keeps the grey eyebrows and near-ink text on the untinted card', () => {
    render(GuideReactionsSection);
    const card = cardOf('Symptôme léger après un aliment');
    expect(card.classList.contains('bg-card')).toBe(true);
    const eyebrows = [...card.querySelectorAll('h4')];
    expect(eyebrows.map((h) => h.classList.contains('text-muted-foreground'))).toEqual([
      true,
      true
    ]);
    expect(card.querySelector('ul')?.classList.contains('text-foreground/90')).toBe(true);
    expect(card.querySelector('p')?.classList.contains('text-foreground/90')).toBe(true);
    expect(card.querySelector('span.text-2xs')?.classList.contains('text-muted-foreground')).toBe(
      true
    );
  });
});

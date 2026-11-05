import { describe, expect, it } from 'bun:test';
import { render } from '@testing-library/svelte';
import { Heart } from '@lucide/svelte';
import '../../test/component';
import { textSnippet } from '../../test/component';
import { expectPairedForeground } from '../../test/paired-foreground';
import TipCard from './TipCard.svelte';

describe('TipCard', () => {
  it('renders title and body', () => {
    const { container } = render(TipCard, {
      props: { title: 'Hello', body: 'World' }
    });
    expect(container.textContent).toContain('Hello');
    expect(container.textContent).toContain('World');
  });

  it('renders no eyebrow unless one is asked for', () => {
    const { container } = render(TipCard, { props: { title: 'Hello' } });
    expect(container.textContent?.trim()).toBe('Hello');
  });

  it('renders an eyebrow when given one', () => {
    const { container } = render(TipCard, { props: { eyebrow: 'Astuce' } });
    expect(container.textContent).toContain('Astuce');
  });

  it.each(['info', 'warn', 'important'] as const)('applies tone=%s', (tone) => {
    const { container } = render(TipCard, { props: { tone, title: 'X' } });
    const wrapper = container.firstElementChild!;
    expect(wrapper.className.length).toBeGreaterThan(0);
  });

  it('renders the children snippet when provided', () => {
    const { container } = render(TipCard, {
      props: { title: 'X', children: textSnippet('Body custom') }
    });
    expect(container.textContent).toContain('Body custom');
  });

  it('renders source citations inline when sources provided', () => {
    const { container } = render(TipCard, {
      props: { title: 'X', sources: ['spf-pnns-guide'] }
    });
    const link = container.querySelector('a');
    expect(link?.getAttribute('target')).toBe('_blank');
  });

  it.each([
    ['info', 'bg-accent-sky/15'],
    ['warn', 'bg-reaction-inconfort/10'],
    ['celebrate', 'bg-accent-butter/25']
  ] as const)(
    "sets the %s card, body, children and sources in its tint's own foreground (#667)",
    (tone, tint) => {
      const { container } = render(TipCard, {
        props: {
          tone,
          eyebrow: 'Astuce',
          body: 'Corps',
          sources: ['spf-pnns-guide'],
          children: textSnippet('Suite')
        }
      });
      const card = container.firstElementChild;
      if (!card) throw new Error('no card');
      expect(card.classList.contains(tint)).toBe(true);
      expectPairedForeground(card);
    }
  );

  it('uses a custom icon', () => {
    const { container } = render(TipCard, {
      props: { title: 'X', icon: Heart }
    });
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

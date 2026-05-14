// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import { textSnippet } from '../../../test/component';
import EmptyHint from './EmptyHint.svelte';

afterEach(() => cleanup());

describe('EmptyHint', () => {
  it('renders a dashed paragraph with the message', () => {
    const { container } = render(EmptyHint, {
      props: { children: textSnippet('Rien à signaler.') }
    });
    const p = container.querySelector('p');
    expect(p?.textContent?.trim()).toBe('Rien à signaler.');
    expect(p?.className).toContain('border-dashed');
    expect(p?.className).toContain('text-ink-soft');
  });

  it('appends additional classes via class prop', () => {
    const { container } = render(EmptyHint, {
      props: { class: 'mb-2', children: textSnippet('X') }
    });
    expect(container.querySelector('p')?.className).toContain('mb-2');
  });
});

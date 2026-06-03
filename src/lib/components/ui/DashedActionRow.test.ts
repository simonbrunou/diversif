import { afterEach, describe, expect, it, mock } from 'bun:test';
import { render, screen, cleanup, fireEvent } from '@testing-library/svelte';
import { textSnippet } from '../../../test/component';
import { Plus } from 'lucide-svelte';
import DashedActionRow from './DashedActionRow.svelte';

afterEach(() => cleanup());

describe('DashedActionRow', () => {
  it('renders as an <a> when href is provided', () => {
    render(DashedActionRow, {
      props: { href: '/foo', icon: Plus, children: textSnippet('Aller') }
    });
    const link = screen.getByText('Aller').closest('a');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toBe('/foo');
  });

  it('renders as a <button> when href is omitted', () => {
    const onclick = mock();
    render(DashedActionRow, {
      props: { onclick, icon: Plus, children: textSnippet('Ajouter') }
    });
    const btn = screen.getByText('Ajouter').closest('button');
    expect(btn).toBeTruthy();
    fireEvent.click(btn!);
    expect(onclick).toHaveBeenCalledOnce();
  });

  it('applies the dashed bordered tile classes', () => {
    render(DashedActionRow, {
      props: { href: '/x', icon: Plus, children: textSnippet('X') }
    });
    const link = screen.getByText('X').closest('a');
    expect(link?.className).toContain('border-dashed');
    expect(link?.className).toContain('rounded-tile');
    expect(link?.className).toContain('bg-canvas');
  });

  it('merges caller class with base via tailwind', () => {
    render(DashedActionRow, {
      props: {
        href: '/x',
        icon: Plus,
        class: 'mt-4 px-4 py-3',
        children: textSnippet('X')
      }
    });
    const link = screen.getByText('X').closest('a');
    expect(link?.className).toContain('mt-4');
    expect(link?.className).toContain('px-4');
    expect(link?.className).toContain('py-3');
    // The base px-3 py-2 should be overridden by px-4 py-3 via tailwind-merge.
    expect(link?.className).not.toMatch(/\bpx-3\b/);
    expect(link?.className).not.toMatch(/\bpy-2\b/);
  });
});

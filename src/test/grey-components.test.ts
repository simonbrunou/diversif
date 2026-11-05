// Renders each GREY_COMPONENTS entry of the paired-foreground lint, on every
// branch that sets a grey: each part's own element must carry the grey the
// lint names, and the override prop the lint accepts on a tint must replace
// it on that element. Without this, a prop the component ignores or applies
// to another part (a hint that drops `hintClass`) passes the lint while its
// text stays grey (#667).
import { describe, expect, it } from 'bun:test';
import path from 'node:path';
import { render } from '@testing-library/svelte';
import type { Component } from 'svelte';
import './component';
import { textSnippet } from './component';
import { GREY_COMPONENTS } from '../../scripts/lint-paired-foreground';

/** One render per branch that sets a grey, with every part shown. */
const RENDERS: Record<string, Record<string, unknown>[]> = {
  Label: [{ children: textSnippet('Libellé') }],
  Field: [{ name: 'x', label: 'Libellé', hint: 'Aide', children: textSnippet('Champ') }],
  SectionHeader: [{ children: textSnippet('Titre') }, { as: 'h3', children: textSnippet('Titre') }],
  SourceCitation: [{ ids: ['spf-pnns-guide'], inline: true }, { ids: ['spf-pnns-guide'] }]
};

/** The element that holds each part's text, keyed by the part's override prop. */
const PART: Record<string, Record<string, string>> = {
  Label: { class: 'label' },
  Field: { labelClass: 'label', hintClass: 'p' },
  SectionHeader: { class: 'h2, h3' },
  SourceCitation: { class: 'a' }
};

/** For a part with `greyWhen`, a value of its prop that sets no grey. */
const NOT_GREY: Record<string, Record<string, unknown>> = {
  SectionHeader: { tone: 'destructive' }
};

async function load(file: string): Promise<Component<Record<string, unknown>>> {
  const mod = await import(path.resolve(import.meta.dir, '../..', file));
  return mod.default;
}

/**
 * The colour among `colours` that the element at `selector` takes, from
 * itself or its nearest ancestor that sets one, in a render with `props`.
 * `null` when the render has no such element.
 */
async function colourOf(
  file: string,
  props: Record<string, unknown>,
  selector: string,
  colours: string[]
): Promise<string | null | undefined> {
  const { container, unmount } = render(await load(file), { props });
  let colour: string | null | undefined = null;
  const el = container.querySelector(selector);
  if (el) {
    colour = undefined;
    for (let e: Element | null = el; e && !colour; e = e.parentElement) {
      colour = colours.find((c) => e?.classList.contains(c));
    }
  }
  unmount();
  return colour;
}

describe.each([...GREY_COMPONENTS])('%s', (name, spec) => {
  const renders = RENDERS[name] ?? [];
  const cases = renders.flatMap((props, i) =>
    spec.parts.map((part) => ({ render: i + 1, prop: part.prop, part, props }))
  );

  it('has renders and a part element for each part in this test', () => {
    expect(renders.length).toBeGreaterThan(0);
    for (const part of spec.parts) expect(PART[name]?.[part.prop]).toBeDefined();
  });

  it.each(cases)('render $render: its $prop part carries the grey', async ({ part, props }) => {
    const colours = [part.grey, 'text-current'];
    expect(await colourOf(spec.file, props, PART[name][part.prop], colours)).toBe(part.grey);
  });

  it.each(cases)(
    'render $render: text-current in its $prop prop replaces that grey',
    async ({ part, props }) => {
      const overridden = { ...props, [part.prop]: 'text-current' };
      const colours = [part.grey, 'text-current'];
      const selector = PART[name][part.prop];
      expect(await colourOf(spec.file, overridden, selector, colours)).toBe('text-current');
    }
  );

  it.each(cases.filter((c) => c.part.shownBy))(
    'render $render: renders no $prop part without its shownBy prop',
    async ({ part, props }) => {
      const hidden = { ...props, [part.shownBy as string]: undefined };
      const selector = PART[name][part.prop];
      expect(await colourOf(spec.file, hidden, selector, [part.grey])).toBeNull();
    }
  );

  it.each(cases.filter((c) => c.part.greyWhen))(
    'render $render: sets no grey on its $prop part for a greyWhen value outside the list',
    async ({ part, props }) => {
      const other = NOT_GREY[name];
      expect(other).toBeDefined();
      expect(part.greyWhen?.values).not.toContain(other[part.greyWhen?.prop as string]);
      const selector = PART[name][part.prop];
      expect(await colourOf(spec.file, { ...props, ...other }, selector, [part.grey])).toBe(
        undefined
      );
    }
  );
});

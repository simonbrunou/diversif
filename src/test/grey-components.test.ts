// Renders each GREY_COMPONENTS entry of the paired-foreground lint, on every
// branch that sets a grey: each part's own element must carry the grey the
// lint names, and the override prop the lint accepts on a tint must replace
// it on that element and nowhere else. Without this, a prop the component
// ignores or applies to another part (a hint that drops `hintClass`) passes
// the lint while its text stays grey (#667).
import { describe, expect, it } from 'bun:test';
import path from 'node:path';
import { render } from '@testing-library/svelte';
import type { Component } from 'svelte';
import './component';
import { textSnippet } from './component';
import { GREY_COMPONENTS } from '../../scripts/lint-paired-foreground';

/**
 * One render per branch that sets a grey, with every part shown, and the
 * element that holds each part's text in it, keyed by the part's override
 * prop.
 */
type Render = { props: Record<string, unknown>; parts: Record<string, string> };

const RENDERS: Record<string, Render[]> = {
  Label: [{ props: { children: textSnippet('Libellé') }, parts: { class: 'label' } }],
  Field: [
    {
      props: { name: 'x', label: 'Libellé', hint: 'Aide', children: textSnippet('Champ') },
      parts: { labelClass: 'label', hintClass: 'p' }
    }
  ],
  SectionHeader: [
    { props: { children: textSnippet('Titre') }, parts: { class: 'h2' } },
    { props: { as: 'h3', children: textSnippet('Titre') }, parts: { class: 'h3' } }
  ],
  SourceCitation: [
    { props: { ids: ['spf-pnns-guide'], inline: true }, parts: { class: 'span > a' } },
    { props: { ids: ['spf-pnns-guide'] }, parts: { class: 'ul a' } }
  ]
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
 * In a render of `file` with `props`: the colour, `grey` or `text-current`,
 * that the element at `selector` takes from itself or its nearest ancestor
 * (`null` with no such element, `undefined` with neither colour), and how
 * many elements carry each of the two.
 */
async function inspect(
  file: string,
  props: Record<string, unknown>,
  selector: string,
  grey: string
): Promise<{ colour: string | null | undefined; greys: number; currents: number }> {
  const { container, unmount } = render(await load(file), { props });
  const el = container.querySelector(selector);
  let colour: string | null | undefined = el ? undefined : null;
  for (let e: Element | null = el; e && !colour; e = e.parentElement) {
    colour = [grey, 'text-current'].find((c) => e?.classList.contains(c));
  }
  const carrying = (cls: string) =>
    [...container.querySelectorAll('[class]')].filter((e) => e.classList.contains(cls)).length;
  const found = { colour, greys: carrying(grey), currents: carrying('text-current') };
  unmount();
  return found;
}

describe.each([...GREY_COMPONENTS])('%s', (name, spec) => {
  const renders = RENDERS[name] ?? [];
  const cases = renders.flatMap((r, i) =>
    spec.parts.map((part) => ({
      render: i + 1,
      prop: part.prop,
      part,
      props: r.props,
      selector: r.parts[part.prop],
      // Every part is shown in each render, so each one that sets this grey adds one.
      greys: spec.parts.filter((p) => p.grey === part.grey).length
    }))
  );

  it('has renders and a part element for each part in this test', () => {
    expect(renders.length).toBeGreaterThan(0);
    for (const r of renders) {
      for (const part of spec.parts) expect(r.parts[part.prop]).toBeDefined();
    }
  });

  it.each(cases)(
    'render $render: its $prop part carries the grey, once per part',
    async ({ part, props, selector, greys }) => {
      expect(await inspect(spec.file, props, selector, part.grey)).toEqual({
        colour: part.grey,
        greys,
        currents: 0
      });
    }
  );

  it.each(cases)(
    'render $render: text-current in its $prop prop replaces that grey there only',
    async ({ part, props, selector, greys }) => {
      const overridden = { ...props, [part.prop]: 'text-current' };
      expect(await inspect(spec.file, overridden, selector, part.grey)).toEqual({
        colour: 'text-current',
        greys: greys - 1,
        currents: 1
      });
    }
  );

  it.each(cases.filter((c) => c.part.shownBy))(
    'render $render: renders no $prop part without its shownBy prop',
    async ({ part, props, selector, greys }) => {
      const hidden = { ...props, [part.shownBy as string]: undefined };
      expect(await inspect(spec.file, hidden, selector, part.grey)).toEqual({
        colour: null,
        greys: greys - 1,
        currents: 0
      });
    }
  );

  it.each(cases.filter((c) => c.part.greyWhen))(
    'render $render: sets no grey on its $prop part for a greyWhen value outside the list',
    async ({ part, props, selector, greys }) => {
      const other = NOT_GREY[name];
      expect(other).toBeDefined();
      expect(part.greyWhen?.values).not.toContain(other[part.greyWhen?.prop as string]);
      expect(await inspect(spec.file, { ...props, ...other }, selector, part.grey)).toEqual({
        colour: undefined,
        greys: greys - 1,
        currents: 0
      });
    }
  );
});

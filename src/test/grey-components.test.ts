// Renders each GREY_COMPONENTS entry of the paired-foreground lint: it must
// set the grey the lint names, and the override prop the lint accepts on a
// tint must remove it. Without this, a prop the component ignores (a hint
// that drops `hintClass`) passes the lint while its text stays grey (#667).
import { describe, expect, it } from 'bun:test';
import path from 'node:path';
import { render } from '@testing-library/svelte';
import type { Component } from 'svelte';
import './component';
import { textSnippet } from './component';
import { GREY_COMPONENTS } from '../../scripts/lint-paired-foreground';

/** The smallest props each component renders with, its parts all shown. */
const PROPS: Record<string, Record<string, unknown>> = {
  Label: { children: textSnippet('Libellé') },
  Field: { name: 'x', label: 'Libellé', hint: 'Aide', children: textSnippet('Champ') },
  SectionHeader: { children: textSnippet('Titre') },
  SourceCitation: { ids: ['spf-pnns-guide'], inline: true }
};

/** For a part with `greyWhen`, a value of its prop that sets no grey. */
const NOT_GREY: Record<string, Record<string, unknown>> = {
  SectionHeader: { tone: 'destructive' }
};

async function load(file: string): Promise<Component<Record<string, unknown>>> {
  const mod = await import(path.resolve(import.meta.dir, '../..', file));
  return mod.default;
}

/** How many elements in a render of `file` with `props` carry `cls`. */
async function count(file: string, props: Record<string, unknown>, cls: string): Promise<number> {
  const { container, unmount } = render(await load(file), { props });
  const n = [...container.querySelectorAll('[class]')].filter((el) =>
    el.classList.contains(cls)
  ).length;
  unmount();
  return n;
}

describe.each([...GREY_COMPONENTS])('%s', (name, spec) => {
  const props = PROPS[name];
  const greys = [...new Set(spec.parts.map((p) => p.grey))];

  it('has render props in this test', () => {
    expect(props).toBeDefined();
  });

  it('sets its grey once per part when the call passes no override', async () => {
    for (const grey of greys) {
      const parts = spec.parts.filter((p) => p.grey === grey).length;
      expect(await count(spec.file, props, grey)).toBe(parts);
    }
  });

  it.each(spec.parts)('drops one grey for text-current in its $prop prop', async (part) => {
    const before = await count(spec.file, props, part.grey);
    const overridden = { ...props, [part.prop]: 'text-current' };
    expect(await count(spec.file, overridden, part.grey)).toBe(before - 1);
    expect(await count(spec.file, overridden, 'text-current')).toBe(1);
  });

  it.each(spec.parts.filter((p) => p.shownBy))(
    'renders no $prop part without its $shownBy prop',
    async (part) => {
      const before = await count(spec.file, props, part.grey);
      const hidden = { ...props, [part.shownBy as string]: undefined };
      expect(await count(spec.file, hidden, part.grey)).toBe(before - 1);
    }
  );

  it.each(spec.parts.filter((p) => p.greyWhen))(
    'sets no $grey when its $greyWhen.prop prop holds a value outside the list',
    async (part) => {
      const other = NOT_GREY[name];
      expect(other).toBeDefined();
      expect(part.greyWhen?.values).not.toContain(other[part.greyWhen?.prop as string]);
      expect(await count(spec.file, { ...props, ...other }, part.grey)).toBe(0);
    }
  );
});

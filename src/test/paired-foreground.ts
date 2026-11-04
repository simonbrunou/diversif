import { expect } from 'bun:test';

const TILES = ['peach', 'butter', 'mint', 'sky', 'lilac'];

/**
 * DESIGN.md, The Paired Foreground Rule: text on a tint uses that tint's own
 * -foreground token, never ink, ink-soft or a grey. Each tint here maps to the
 * text utility it pairs with: the five tiles, the three reaction levels, and
 * the app.css aliases of a tile. scripts/lint-paired-foreground.ts reads the
 * same set from app.css, and its test keeps the two equal.
 */
export const PAIRED_TINTS: ReadonlyMap<string, string> = new Map([
  ...TILES.map((t) => [`tile-${t}`, `text-tile-${t}-foreground`] as const),
  ...TILES.map((t) => [`accent-${t}`, `text-tile-${t}-foreground`] as const),
  ...['ras', 'inconfort', 'reaction'].map(
    (l) => [`reaction-${l}`, `text-reaction-${l}-foreground`] as const
  ),
  ...['success', 'warning', 'info', 'celebrate'].map((s) => [s, `text-${s}-foreground`] as const)
]);
const TINT = new RegExp(`(?:^|[\\s:!])bg-(${[...PAIRED_TINTS.keys()].join('|')})(?=[\\s/!]|$)`);
// text-* utilities that set a size, an alignment or wrapping, or keep the
// inherited colour, rather than set a colour of their own.
const NOT_A_COLOUR =
  /^text-(?:\d*x[sl]|sm|base|lg|left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip|current|inherit|\[\d[^\]]*\])$/;
// bg-* utilities that set no colour, so the tint behind them still shows. A
// gradient's colours come from its from-*/to-* stops, which are not read here.
const NOT_A_BACKGROUND =
  /^bg-(?:transparent|none|inherit|fixed|local|scroll|auto|cover|contain|no-repeat|repeat(?:-\w+)?|clip-\S+|origin-\S+|blend-\S+|(?:top|bottom|left|right|center)(?:-(?:left|right))?|(?:linear|radial|conic|gradient)(?:-\S+)?)$/;

function classes(el: Element): string[] {
  return (el.getAttribute('class') ?? '').split(/\s+/).filter(Boolean);
}

/** The text colour utilities in `el`'s class, without variants, `!` or opacity. */
function textColours(el: Element): string[] {
  return classes(el)
    .map((c) =>
      c
        .slice(c.lastIndexOf(':') + 1)
        .replace(/^!|!$/g, '')
        .replace(/\/\d+$/, '')
    )
    .filter((c) => c.startsWith('text-') && !NOT_A_COLOUR.test(c));
}

/**
 * Whether `el` paints a background of its own that is not a tint (an input's
 * `bg-canvas`, a button's `bg-severe`): its text sits on that surface, not on
 * the tile's. A background behind a variant (`hover:bg-card`) does not count.
 */
function setsOwnSurface(el: Element): boolean {
  return classes(el).some(
    (c) => c.startsWith('bg-') && !NOT_A_BACKGROUND.test(c.replace(/\/\d+$/, '')) && !TINT.test(c)
  );
}

/**
 * Asserts that `tile` (an element carrying a tint's `bg-*` class, see
 * PAIRED_TINTS) sets its own tint's foreground as its only text colour, and
 * that nothing inside it sets another one: ink under any alias, a grey, or
 * another tint's foreground. A descendant that paints its own non-tint
 * background (an input, a button) starts a surface of its own, so the check
 * skips it and everything inside it.
 */
export function expectPairedForeground(tile: Element): void {
  const tint = TINT.exec(tile.getAttribute('class') ?? '')?.[1];
  expect(tint).toBeDefined();
  const own = PAIRED_TINTS.get(tint ?? '') ?? '';
  expect([...new Set(textColours(tile))]).toEqual([own]);
  const others = [...tile.querySelectorAll('[class]')]
    .filter((el) => {
      for (let p: Element | null = el; p && p !== tile; p = p.parentElement) {
        if (setsOwnSurface(p)) return false;
      }
      return true;
    })
    .filter((el) => textColours(el).some((c) => c !== own))
    .map((el) => el.outerHTML);
  expect(others).toEqual([]);
}

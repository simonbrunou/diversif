import { expect } from 'bun:test';

// DESIGN.md, The Paired Foreground Rule: text on a tint uses that tint's own
// -foreground token, never ink, ink-soft or a grey.
const TINT = /(?:^|[\s:])bg-tile-(peach|butter|mint|sky|lilac)(?=[\s/]|$)/;
// text-* utilities that set a size, an alignment or wrapping, or keep the
// inherited colour, rather than set a colour of their own.
const NOT_A_COLOUR =
  /^text-(?:\d*x[sl]|sm|base|lg|left|center|right|justify|start|end|wrap|nowrap|balance|pretty|ellipsis|clip|current|inherit|\[\d[^\]]*\])$/;

/** The text colour utilities in `el`'s class, without variants, `!` or opacity. */
function textColours(el: Element): string[] {
  return (el.getAttribute('class') ?? '')
    .split(/\s+/)
    .map((c) =>
      c
        .slice(c.lastIndexOf(':') + 1)
        .replace(/^!|!$/g, '')
        .replace(/\/\d+$/, '')
    )
    .filter((c) => c.startsWith('text-') && !NOT_A_COLOUR.test(c));
}

/**
 * Asserts that `tile` (an element carrying a `bg-tile-*` class) sets its own
 * tint's foreground as its only text colour, and that nothing inside it sets
 * another one: ink under any alias, a grey, or another tint's foreground.
 */
export function expectPairedForeground(tile: Element): void {
  const tint = TINT.exec(tile.getAttribute('class') ?? '')?.[1];
  expect(tint).toBeDefined();
  const own = `text-tile-${tint}-foreground`;
  expect([...new Set(textColours(tile))]).toEqual([own]);
  const others = [...tile.querySelectorAll('[class]')]
    .filter((el) => textColours(el).some((c) => c !== own))
    .map((el) => el.outerHTML);
  expect(others).toEqual([]);
}

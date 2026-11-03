import { afterEach, describe, expect, it } from 'bun:test';
import { expectPairedForeground } from './paired-foreground';

afterEach(() => {
  document.body.innerHTML = '';
});

function tile(html: string): Element {
  document.body.innerHTML = html;
  const el = document.body.firstElementChild;
  if (!el) throw new Error('no tile in the markup');
  return el;
}

describe('expectPairedForeground', () => {
  it.each([
    [
      'its own foreground, inherited',
      '<div class="rounded-tile bg-tile-mint/40 p-3 text-sm text-tile-mint-foreground"><p class="text-xs font-semibold uppercase">Texture</p><svg class="lucide"></svg></div>'
    ],
    [
      'its own foreground again inside, with a variant',
      '<button class="bg-tile-lilac text-left text-tile-lilac-foreground hover:scale-[1.01]"><p class="text-[11px] hover:text-tile-lilac-foreground">x</p></button>'
    ],
    [
      'its own foreground twice, and text-current inside',
      '<div class="bg-tile-sky text-tile-sky-foreground hover:text-tile-sky-foreground"><svg class="text-current"></svg></div>'
    ]
  ])('passes a tile with %s', (_case, html) => {
    expectPairedForeground(tile(html));
  });

  it.each([
    ['no foreground of its own', '<div class="bg-tile-mint"><p>x</p></div>'],
    [
      'a grey on itself',
      '<div class="bg-tile-mint text-tile-mint-foreground text-ink-soft"><p>x</p></div>'
    ],
    [
      'ink inside',
      '<div class="bg-tile-mint text-tile-mint-foreground"><p class="text-ink">x</p></div>'
    ],
    [
      'ink inside, under an alias',
      '<div class="bg-tile-sky text-tile-sky-foreground"><p class="text-card-foreground">x</p></div>'
    ],
    [
      'a grey inside, behind a variant and an opacity',
      '<div class="bg-tile-sky text-tile-sky-foreground"><p class="hover:text-muted-foreground/80">x</p></div>'
    ],
    [
      'ink inside, marked important',
      '<div class="bg-tile-sky text-tile-sky-foreground"><p class="text-ink!">x</p></div>'
    ],
    [
      "another tint's foreground inside",
      '<div class="bg-tile-mint text-tile-mint-foreground"><p class="text-tile-sky-foreground">x</p></div>'
    ],
    ['no bg-tile-* class at all', '<div class="bg-surface text-foreground"><p>x</p></div>']
  ])('fails a tile with %s', (_case, html) => {
    expect(() => expectPairedForeground(tile(html))).toThrow();
  });
});

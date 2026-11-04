// The Paired Foreground lint's matcher, on markup strings. Most cases read
// their rules from the real src/app.css; the alias cases use a small
// stylesheet of their own, to prove a new alias is read without editing the
// script.
import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  findPairedForegroundViolations,
  formatViolation,
  rulesFromCss
} from './lint-paired-foreground';

const appCss = readFileSync(path.resolve(import.meta.dir, '../src/app.css'), 'utf8');
const rules = rulesFromCss(appCss);

function flagged(markup: string, r = rules): string[] {
  return findPairedForegroundViolations(markup, r).map((v) => `${v.line}:${v.cls}`);
}

describe('findPairedForegroundViolations', () => {
  it.each([
    [
      'a static bg-tile-*',
      '<div class="bg-tile-mint">\n  <p class="text-ink-soft">x</p>\n</div>',
      ['2:text-ink-soft']
    ],
    [
      'a bg-tile-*/NN wash',
      '<div class="bg-tile-mint/40"><p class="text-ink">x</p></div>',
      ['1:text-ink']
    ],
    [
      'a reaction tint',
      '<div class="bg-reaction-inconfort/5"><p class="text-muted-foreground">x</p></div>',
      ['1:text-muted-foreground']
    ],
    [
      'a tint behind a variant',
      '<div class="dark:bg-tile-sky"><p class="text-ink">x</p></div>',
      ['1:text-ink']
    ],
    [
      'an alias of a tint',
      '<div class="bg-accent-sky/15"><p class="text-ink-soft">x</p></div>',
      ['1:text-ink-soft']
    ],
    [
      'a Card variant="tile-*"',
      '<Card variant="tile-lilac" class="p-4">\n  <span class="text-ink-soft">x</span>\n</Card>',
      ['2:text-ink-soft']
    ],
    [
      'a forbidden class two levels under the tint',
      '<section class="bg-tile-butter"><div><ul><li class="text-foreground">x</li></ul></div></section>',
      ['1:text-foreground']
    ],
    [
      'a forbidden class on the tinted element itself',
      '<p class="bg-tile-peach text-ink-soft">x</p>',
      ['1:text-ink-soft']
    ],
    [
      'a tint literal in one branch of a dynamic class',
      "<li class={cn('bg-canvas p-3', on && 'bg-tile-peach/20')}>\n  <p class=\"text-ink-soft\">x</p>\n</li>",
      ['2:text-ink-soft']
    ],
    [
      'a tint literal in a template literal',
      '<li class={`p-3 bg-reaction-reaction/20 ${extra}`}><p class="text-ink-soft">x</p></li>',
      ['1:text-ink-soft']
    ],
    [
      'a tint literal interpolated into a quoted class',
      '<li class="p-3 {on ? \'bg-tile-mint\' : \'\'}"><p class="text-ink">x</p></li>',
      ['1:text-ink']
    ],
    [
      'a tint set by a class directive',
      '<li class:bg-tile-mint={on}><p class="text-ink">x</p></li>',
      ['1:text-ink']
    ],
    [
      'a forbidden literal in one branch of a dynamic class',
      "<div class=\"bg-tile-sky\"><p class={on ? 'text-ink-soft' : 'text-xs'}>x</p></div>",
      ['1:text-ink-soft']
    ],
    [
      'a forbidden class directive',
      '<div class="bg-tile-sky"><p class:text-muted-foreground={on}>x</p></div>',
      ['1:text-muted-foreground']
    ],
    [
      'an alias of ink',
      '<div class="bg-tile-sky"><p class="text-card-foreground">x</p></div>',
      ['1:text-card-foreground']
    ],
    [
      'a forbidden class behind a variant',
      '<div class="bg-tile-sky"><a class="hover:text-ink">x</a></div>',
      ['1:hover:text-ink']
    ],
    [
      'a forbidden class marked important',
      '<div class="bg-tile-sky"><p class="!text-ink-soft">x</p><p class="text-ink!">y</p></div>',
      ['1:!text-ink-soft', '1:text-ink!']
    ],
    [
      'a forbidden class with an opacity',
      '<div class="bg-tile-sky"><p class="text-foreground/90">x</p></div>',
      ['1:text-foreground/90']
    ],
    [
      'a descendant whose background is set only on hover',
      '<div class="bg-tile-mint"><p class="hover:bg-card text-ink">x</p></div>',
      ['1:text-ink']
    ],
    [
      'a descendant whose bg-* utility sets no colour',
      '<div class="bg-tile-mint"><p class="bg-transparent text-ink">x</p></div>',
      ['1:text-ink']
    ],
    [
      'a tile inside an untinted surface inside a tile',
      '<div class="bg-tile-mint"><div class="bg-card"><p class="bg-tile-sky/40 text-ink">x</p></div></div>',
      ['1:text-ink']
    ]
  ])('flags %s', (_case, markup, expected) => {
    expect(flagged(markup)).toEqual(expected);
  });

  it.each([
    [
      'a paired foreground',
      '<div class="bg-tile-mint text-tile-mint-foreground"><p class="text-xs text-tile-mint-foreground">x</p></div>'
    ],
    [
      'a descendant that sets its own background',
      '<div class="bg-tile-butter"><input class="bg-canvas text-foreground placeholder:text-ink-soft" /></div>'
    ],
    [
      'a default Card inside a tint, which paints bg-card',
      '<div class="bg-tile-butter"><Card class="p-4"><p class="text-ink-soft">x</p></Card></div>'
    ],
    [
      'a size, text-current and text-inherit',
      '<div class="bg-tile-mint"><p class="text-sm text-current">x</p><p class="text-inherit">y</p></div>'
    ],
    [
      'the escape marker on the flagged line',
      "<li class={cn('p-3', tinted && 'bg-tile-peach/20')}>\n  <p class=\"text-ink-soft\">x</p><!-- paired-foreground-ok: only the canvas rows -->\n</li>"
    ],
    ['a grey outside any tint', '<div class="bg-canvas"><p class="text-ink-soft">x</p></div>'],
    [
      'a class held in a variable',
      '<div class="bg-tile-mint {tone}"><p class="text-xs {caption}">x</p></div>'
    ],
    [
      'a grey after the tinted element closes',
      '<div class="bg-tile-mint">x</div>\n<p class="text-ink-soft">y</p>'
    ],
    [
      'a Card variant that is not a tile',
      '<Card variant="surface"><p class="text-ink-soft">x</p></Card>'
    ],
    [
      'tints and greys in the script and style blocks',
      '<script>const c = "bg-tile-mint text-ink";</script>\n<style>p { color: red; }</style>\n<p class="text-ink-soft">x</p>'
    ]
  ])('passes %s', (_case, markup) => {
    expect(flagged(markup)).toEqual([]);
  });

  it('names the tint, its line and the paired token in each failure', () => {
    const markup =
      "<li\n  class={cn('p-3', a && 'bg-reaction-reaction/20', b && 'bg-tile-peach/20')}\n>\n  <p class=\"text-ink-soft\">x</p>\n</li>";
    const [v] = findPairedForegroundViolations(markup, rules);
    expect(formatViolation('src/x.svelte', v)).toBe(
      'src/x.svelte:4: text-ink-soft on bg-reaction-reaction/20, bg-tile-peach/20 (line 2). ' +
        'Set text-reaction-reaction-foreground or text-tile-peach-foreground on the tinted element and let its text inherit it.'
    );
  });

  it('names the Card variant as the tint', () => {
    const [v] = findPairedForegroundViolations(
      '<Card variant="tile-butter"><p class="text-ink-soft">x</p></Card>',
      rules
    );
    expect(v.tints).toEqual(['Card variant="tile-butter"']);
    expect(v.use).toEqual(['text-tile-butter-foreground']);
  });

  it('throws on markup the Svelte parser rejects', () => {
    expect(() =>
      findPairedForegroundViolations('<div class="bg-tile-mint">{#if}</div>', rules)
    ).toThrow();
  });
});

describe('rulesFromCss', () => {
  const css = `
    @theme inline {
      --color-shade: hsl(var(--ink-soft));
      --color-accent-mint: hsl(var(--tile-mint));
    }
    :root {
      --foreground: 0 0% 10%;
      --ink-soft: 0 0% 32%;
      --sidebar-foreground: var(--foreground);
      --tile-mint: 142 35% 84%;
      --tile-mint-foreground: 142 41% 21%;
      --go: var(--tile-mint);
      --go-foreground: var(--tile-mint-foreground);
      --tile-plain: 0 0% 90%;
    }`;
  const fixture = rulesFromCss(css);

  it('reads every alias of ink or a grey, in the theme tables and in @theme', () => {
    expect(
      flagged('<div class="bg-tile-mint"><p class="text-sidebar-foreground">x</p></div>', fixture)
    ).toEqual(['1:text-sidebar-foreground']);
    expect(flagged('<div class="bg-tile-mint"><p class="text-shade">x</p></div>', fixture)).toEqual(
      ['1:text-shade']
    );
  });

  it('pairs an alias of a tint with its own foreground, or else the tint’s', () => {
    expect(fixture.tints.get('go')).toBe('text-go-foreground');
    expect(fixture.tints.get('accent-mint')).toBe('text-tile-mint-foreground');
  });

  it('reads a tile with no -foreground token as no tint', () => {
    expect(fixture.tints.has('tile-plain')).toBe(false);
  });

  it('reads the tints and the greys app.css declares today', () => {
    expect([...rules.tints.keys()].filter((t) => /^(?:tile|reaction)-/.test(t)).sort()).toEqual([
      'reaction-inconfort',
      'reaction-ras',
      'reaction-reaction',
      'tile-butter',
      'tile-lilac',
      'tile-mint',
      'tile-peach',
      'tile-sky'
    ]);
    for (const grey of [
      'card-foreground',
      'popover-foreground',
      'secondary-foreground',
      'accent-foreground'
    ]) {
      expect(rules.forbidden.has(grey)).toBe(true);
    }
  });
});

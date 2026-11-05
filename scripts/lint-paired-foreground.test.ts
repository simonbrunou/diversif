// The Paired Foreground lint's matcher, on markup strings. Most cases read
// their rules from the real src/app.css; the alias cases use a small
// stylesheet of their own, to prove a new alias is read without editing the
// script.
import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  GREY_COMPONENTS,
  findGreyComponents,
  findPairedForegroundViolations,
  findUnpairedTints,
  formatGreyComponent,
  formatUnpairedTint,
  formatViolation,
  rulesFromCss
} from './lint-paired-foreground';
import { PAIRED_TINTS } from '../src/test/paired-foreground';

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
    ],
    [
      'a grey whose own background is set in one branch only',
      "<div class=\"bg-tile-mint\"><p class={cn('text-ink-soft', on && 'bg-card')}>x</p></div>",
      ['1:text-ink-soft']
    ],
    [
      'ink under an ancestor whose background is set in one branch only',
      '<div class="bg-tile-mint"><div class={on ? \'bg-card\' : \'\'}><p class="text-ink">x</p></div></div>',
      ['1:text-ink']
    ],
    [
      'ink on a gradient inside a tint',
      '<div class="bg-tile-mint"><p class="bg-linear-to-r text-ink">x</p></div>',
      ['1:text-ink']
    ],
    [
      'a grey whose escape marker gives no reason',
      '<div class="bg-tile-mint">\n  <p class="text-ink-soft">x</p><!-- paired-foreground-ok -->\n</div>',
      ['2:text-ink-soft']
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

function unpaired(markup: string): string[] {
  return findUnpairedTints(markup, rules).map((u) => `${u.line}:${u.tint}`);
}

describe('findUnpairedTints', () => {
  it.each([
    [
      'a static tint with text and no foreground',
      '<div class="bg-tile-mint">x</div>',
      ['1:bg-tile-mint']
    ],
    [
      'a tint whose text sits two levels down',
      '<section class="bg-tile-peach">\n  <div><h1 class="text-4xl">x</h1></div>\n</section>',
      ['1:bg-tile-peach']
    ],
    [
      'a tint whose only text child pairs the foreground itself',
      '<section class="bg-tile-sky"><h2 class="text-tile-sky-foreground">x</h2></section>',
      ['1:bg-tile-sky']
    ],
    [
      'a tint whose foreground sits only in another branch',
      "<span class={cn('px-2', a && 'bg-tile-mint', b && 'text-tile-mint-foreground')}>x</span>",
      ['1:bg-tile-mint']
    ],
    [
      'a tint in one branch beside a branch that pairs another tint',
      "<li\n  class={cn(\n    'p-3',\n    warn && 'border-warning bg-tile-butter',\n    severe && 'bg-tile-peach text-tile-peach-foreground'\n  )}\n>\n  {label}\n</li>",
      ['4:bg-tile-butter']
    ],
    ['a tint behind a variant', '<div class="dark:bg-tile-sky">x</div>', ['1:dark:bg-tile-sky']],
    [
      'a foreground behind a variant the tint does not share',
      '<div class="bg-tile-sky hover:text-tile-sky-foreground">x</div>',
      ['1:bg-tile-sky']
    ],
    ['a tint set by a class directive', '<li class:bg-tile-mint={on}>x</li>', ['1:bg-tile-mint']],
    [
      'an alias of a tint, which pairs the tint’s foreground',
      '<div class="bg-accent-sky/15 text-info-foreground">x</div>',
      ['1:bg-accent-sky/15']
    ],
    [
      'a tint whose content is an expression',
      '<span class="bg-tile-lilac">{name}</span>',
      ['1:bg-tile-lilac']
    ],
    [
      'a tint whose content is a render tag',
      '<div class="bg-tile-mint">{@render children()}</div>',
      ['1:bg-tile-mint']
    ],
    [
      'a tint whose content is a component',
      '<div class="bg-tile-mint"><Icon /></div>',
      ['1:bg-tile-mint']
    ],
    [
      'a tint whose content sits in a block',
      '<ul class="bg-tile-mint">{#each xs as x}<li>{x}</li>{/each}</ul>',
      ['1:bg-tile-mint']
    ],
    [
      'a marker with no reason',
      '<div class="bg-tile-mint"><!-- paired-foreground-ok -->\n  x\n</div>',
      ['1:bg-tile-mint']
    ]
  ])('flags %s', (_case, markup, expected) => {
    expect(unpaired(markup)).toEqual(expected);
  });

  it.each([
    [
      'the foreground in the same literal',
      "<li class={cn('p-3', on && 'bg-tile-mint text-tile-mint-foreground')}>x</li>"
    ],
    [
      'the foreground in the static text',
      "<li class=\"text-tile-mint-foreground {on ? 'bg-tile-mint' : ''}\">x</li>"
    ],
    [
      'the foreground in another part of the same template literal',
      '<li class={`bg-tile-mint ${pad} text-tile-mint-foreground`}>x</li>'
    ],
    [
      'the foreground behind the variant the tint carries',
      '<div class="dark:bg-tile-sky dark:text-tile-sky-foreground">x</div>'
    ],
    ['a tint element with no content', '<span class="h-2 w-2 bg-tile-mint"></span>'],
    [
      'a tint element holding only whitespace and a comment',
      '<div class="bg-tile-mint">\n  <!-- x -->\n</div>'
    ],
    ['a Card variant="tile-*"', '<Card variant="tile-lilac"><p>x</p></Card>'],
    [
      'a marker with a reason',
      '<div class="bg-tile-mint"><!-- paired-foreground-ok: only a swatch shows -->\n  x\n</div>'
    ],
    ['a tint held in a variable', '<div class="p-3 {tone}">x</div>']
  ])('passes %s', (_case, markup) => {
    expect(unpaired(markup)).toEqual([]);
  });

  it('names the element, the tint, its line and the utility to add', () => {
    const [u] = findUnpairedTints('<p>\n  <span class="bg-tile-lilac">{x}</span>\n</p>', rules);
    expect(formatUnpairedTint('src/x.svelte', u)).toBe(
      'src/x.svelte:2: <span> holds bg-tile-lilac but sets no foreground of its own, so its text inherits ink. ' +
        'Add text-tile-lilac-foreground to the string that holds the tint, or to the static class text, and let its text inherit it.'
    );
  });
});

function greyCalls(markup: string): string[] {
  return findGreyComponents(markup, rules).map((g) => `${g.line}:${g.component}.${g.prop}`);
}

const ON_A_TINT = (call: string) =>
  `<div class="bg-tile-mint text-tile-mint-foreground">\n  ${call}\n</div>`;
const OFF_A_TINT = (call: string) => `<div class="bg-card">\n  ${call}\n</div>`;

describe('findGreyComponents', () => {
  it.each([
    [
      'Label',
      '<Label for="x">x</Label>',
      '<Label for="x" class="text-current">x</Label>',
      'Label.class'
    ],
    [
      'Field’s label',
      '<Field name="x" label="X"><input /></Field>',
      '<Field name="x" label="X" labelClass="text-current"><input /></Field>',
      'Field.labelClass'
    ],
    [
      'Field’s hint',
      '<Field name="x" label="X" labelClass="text-current" hint="h"><input /></Field>',
      '<Field name="x" label="X" labelClass="text-current" hint="h" hintClass="text-current"><input /></Field>',
      'Field.hintClass'
    ],
    [
      'SectionHeader',
      '<SectionHeader>x</SectionHeader>',
      '<SectionHeader class="text-current">x</SectionHeader>',
      'SectionHeader.class'
    ],
    [
      'SourceCitation',
      '<SourceCitation ids={ids} inline />',
      '<SourceCitation ids={ids} inline class="text-current" />',
      'SourceCitation.class'
    ]
  ])(
    'flags %s on a tint, passes it with text-current or off a tint',
    (_name, bareCall, overridden, flag) => {
      expect(greyCalls(ON_A_TINT(bareCall))).toEqual([`2:${flag}`]);
      expect(greyCalls(ON_A_TINT(overridden))).toEqual([]);
      expect(greyCalls(OFF_A_TINT(bareCall))).toEqual([]);
    }
  );

  it.each([
    [
      'a SectionHeader with a tone the lint cannot read',
      '<SectionHeader tone={t}>x</SectionHeader>',
      ['2:SectionHeader.class']
    ],
    [
      'an override in one branch only',
      "<Label class={on ? 'text-current' : ''}>x</Label>",
      ['2:Label.class']
    ],
    [
      'an override held in a variable',
      '<SourceCitation ids={ids} class={tone.sources} />',
      ['2:SourceCitation.class']
    ],
    [
      'an override behind a variant',
      '<Label class="hover:text-current">x</Label>',
      ['2:Label.class']
    ],
    [
      'an override with another tint’s foreground',
      '<Label class="text-tile-sky-foreground">x</Label>',
      ['2:Label.class']
    ],
    ['a marker with no reason', '<Label>x</Label><!-- paired-foreground-ok -->', ['2:Label.class']]
  ])('flags %s', (_case, call, expected) => {
    expect(greyCalls(ON_A_TINT(call))).toEqual(expected);
  });

  it.each([
    ['a destructive SectionHeader', '<SectionHeader tone="destructive">x</SectionHeader>'],
    ['the tint’s own foreground', '<Label class="font-bold text-tile-mint-foreground">x</Label>'],
    ['text-inherit', '<SourceCitation ids={ids} class="text-inherit" />'],
    [
      'a Field with no hint, its label overridden',
      '<Field name="x" label="X" labelClass="text-current">y</Field>'
    ],
    [
      'a marker with a reason',
      '<Label>x</Label><!-- paired-foreground-ok: the card test checks it -->'
    ],
    ['a component of another name', '<Badge>x</Badge>']
  ])('passes %s', (_case, call) => {
    expect(greyCalls(ON_A_TINT(call))).toEqual([]);
  });

  it('reads a Card variant="tile-*" as a tint, and a surface inside it as none', () => {
    expect(
      greyCalls('<Card variant="tile-butter">\n  <SectionHeader>x</SectionHeader>\n</Card>')
    ).toEqual(['2:SectionHeader.class']);
    expect(
      greyCalls(
        '<Card variant="tile-butter">\n  <div class="bg-card"><Label>x</Label></div>\n</Card>'
      )
    ).toEqual([]);
  });

  it('names the component, its grey, the tint and the prop to set', () => {
    const [g] = findGreyComponents(
      '<Card variant="tile-butter">\n  <Field name="x" label="X" hint="h" labelClass="text-current">y</Field>\n</Card>',
      rules
    );
    expect(formatGreyComponent('src/x.svelte', g)).toBe(
      'src/x.svelte:2: <Field> sets text-ink-soft inside itself, on Card variant="tile-butter" (line 1). ' +
        "Pass text-current or text-tile-butter-foreground in its hintClass prop's static text."
    );
  });

  it.each([...GREY_COMPONENTS])(
    '%s still sets its grey and takes each override prop',
    (_name, spec) => {
      const source = readFileSync(path.resolve(import.meta.dir, '..', spec.file), 'utf8');
      for (const part of spec.parts) {
        expect(source).toContain(part.grey);
        const props = /let \{([\s\S]*?)\}[^=]*= \$props\(\)/.exec(source)?.[1] ?? '';
        for (const prop of [part.prop, part.shownBy, part.greyWhen?.prop].filter(Boolean)) {
          expect(props).toMatch(new RegExp(`(?:^|[\\s,])${prop}\\b`));
        }
      }
    }
  );
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

  it('reads the same tints, paired the same way, as expectPairedForeground', () => {
    expect(new Map([...rules.tints].sort())).toEqual(new Map([...PAIRED_TINTS].sort()));
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

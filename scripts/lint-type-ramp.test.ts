// The type-ramp lint (#365): one failing and one passing fixture per rule,
// the SCOPED_SIZES counts, the files it reads and its exit codes.
import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  checkSource,
  lintProject,
  rulesFromCss,
  sourceFiles,
  staleScopedSizes,
  type TypeRampRules
} from './lint-type-ramp';
import { FONT_SIZE_PX, SCOPED_SIZES, type ScopedSize } from './type-ramp';

const SCRIPT = path.resolve(import.meta.dir, 'lint-type-ramp.ts');
const appCss = fs.readFileSync(path.resolve(import.meta.dir, '../src/app.css'), 'utf8');
const rules = rulesFromCss(appCss);

/** `line:first word of the message` for each finding: the class, or `font-size:`. */
function flagged(
  source: string,
  file = 'src/lib/X.svelte',
  r: TypeRampRules = rules,
  scoped: readonly ScopedSize[] = []
): string[] {
  return checkSource(file, source, r, scoped).findings.map(
    (f) => `${f.line}:${f.message.split(' ')[0]}`
  );
}

function messages(source: string, file = 'src/lib/X.svelte'): string[] {
  return checkSource(file, source, rules, []).findings.map((f) => f.message);
}

describe('sizes off the ramp', () => {
  it.each([
    ['a named size', '<p class="text-base">x</p>', ['1:text-base']],
    ['text-3xl on an element without font-display', '<h1 class="text-3xl">x</h1>', ['1:text-3xl']],
    ['an arbitrary px size', '<p class="text-[30px]">x</p>', ['1:text-[30px]']],
    ['a size behind a variant', '<p class="text-sm md:text-lg">x</p>', ['1:md:text-lg']],
    [
      'a size behind an arbitrary variant holding a colon',
      '<p class="[@media(min-width:20rem)]:text-lg">x</p>',
      ['1:[@media(min-width:20rem)]:text-lg']
    ],
    [
      'a size with a line height',
      '<p class="text-base/6 text-[30px]/none">x</p>',
      ['1:text-base/6', '1:text-[30px]/none']
    ],
    [
      'a size marked important',
      '<p class="!text-base">x</p><p class="text-lg!">y</p>',
      ['1:!text-base', '1:text-lg!']
    ],
    ['a size name app.css adds in @theme', '<p class="text-3xs">x</p>', ['1:text-3xs']],
    ['a class directive', '<p class:text-lg={on}>x</p>', ['1:text-lg']],
    [
      'a literal in a dynamic class',
      "<p class={cn('p-2', on && 'text-base')}>x</p>",
      ['1:text-base']
    ],
    ['a template literal', '<p class={`p-2 text-lg ${x}`}>x</p>', ['1:text-lg']],
    [
      'a literal interpolated into a quoted class',
      "<p class=\"p-2 {on ? 'text-lg' : ''}\">x</p>",
      ['1:text-lg']
    ],
    ['a class prop other than class', '<Sheet contentClass="text-lg">x</Sheet>', ['1:text-lg']],
    [
      'a literal in a spread or an action',
      "<p {...{ class: 'text-lg' }} use:tip={'text-base'}>x</p>",
      ['1:text-lg', '1:text-base']
    ],
    [
      'a string in a block expression',
      "{#each ['text-lg'] as c}<p class={c}>x</p>{/each}",
      ['1:text-lg']
    ],
    [
      'a string in the instance script',
      "<script lang=\"ts\">\n  const size = on ? 'text-sm' : 'text-lg';\n</script>",
      ['2:text-lg']
    ],
    [
      'a string in the module script',
      '<script lang="ts" module>\n  const SIZES = { lg: \'h-12 text-base\' };\n</script>',
      ['2:text-base']
    ],
    [
      '@apply in a style block',
      '<style>\n  .a {\n    @apply text-lg font-bold;\n  }\n</style>',
      ['3:text-lg']
    ]
  ])('flags %s', (_name, source, expected) => {
    expect(flagged(source)).toEqual(expected);
  });

  it('flags a string in a .ts file, on its own line', () => {
    expect(
      flagged("export const a = 'text-sm';\nexport const b = 'text-lg';\n", 'src/lib/x.ts')
    ).toEqual(['2:text-lg']);
  });

  it('flags @apply in a .css file', () => {
    expect(flagged('.a {\n  @apply text-base;\n}\n', 'src/x.css')).toEqual(['2:text-base']);
  });

  it('names the class and its px in the message', () => {
    expect(messages('<p class="text-base">x</p>\n<p class="text-[11.5px]">x</p>')).toEqual([
      'text-base sets 16px, which is not a step of the type ramp.',
      'text-[11.5px] sets 11.5px, which is not a step of the type ramp.'
    ]);
  });
});

describe('sizes on the ramp', () => {
  it.each([
    ['each named step', '<p class="text-2xs text-xs text-sm text-xl text-2xl">x</p>'],
    ['an arbitrary px size equal to a step', '<p class="text-[28px] text-[11px]">x</p>'],
    [
      'a step behind a variant, with a line height or marked important',
      '<p class="md:text-xl text-sm/6 !text-xs text-2xl!">x</p>'
    ],
    [
      'a step in a literal, a directive, a script and @apply',
      "<script>const a = 'text-sm';</script><p class:text-xs={on} class={on ? 'text-xl' : ''}>x</p><style>.a { @apply text-sm; }</style>"
    ],
    [
      'text- utilities that set no size',
      '<p class="text-left text-ink text-primary-foreground text-[#fff] text-[color:var(--x)] text-[var(--c)] text-(--c) text-balance">x</p>'
    ],
    [
      'a size in a comment',
      '<!-- text-lg -->\n<script>\n  // text-lg\n  /* text-base */\n</script>\n<style>\n  /* text-lg */\n</style>'
    ],
    ['a size in text content', '<p>Use text-lg here</p>']
  ])('passes %s', (_name, source) => {
    expect(flagged(source)).toEqual([]);
  });
});

describe('font-display', () => {
  it.each([
    ['a Display step', '<h1 class="font-display text-3xl italic">x</h1>', []],
    [
      'each Display step',
      '<p class="font-display text-xl"></p><p class="font-display text-2xl"></p><p class="font-display text-4xl sm:text-5xl"></p>',
      []
    ],
    [
      'a size below the Display steps',
      '<p class="font-display text-lg italic">x</p>',
      ['1:text-lg']
    ],
    [
      'a body size on a font-display element',
      '<p class="font-display text-sm">x</p>',
      ['1:text-sm']
    ],
    [
      'font-display on the parent only',
      '<div class="font-display"><p class="text-3xl">x</p></div>',
      ['1:text-3xl']
    ],
    [
      'font-display in the static text, the size in a literal',
      "<p class=\"font-display {big ? 'text-4xl' : 'text-xl'}\">x</p>",
      []
    ],
    ['font-display in the same literal', "<p class={cn('font-display text-3xl', x)}>x</p>", []],
    [
      'font-display in another branch only',
      "<p class={on ? 'font-display text-3xl' : 'text-3xl'}>x</p>",
      ['1:text-3xl']
    ],
    [
      'font-display in another attribute',
      '<Sheet class="font-display" titleClass="text-3xl">x</Sheet>',
      ['1:text-3xl']
    ],
    ['font-display behind a variant', '<p class="md:font-display text-3xl">x</p>', ['1:text-3xl']],
    [
      'font-display in the static class, a size by class directive',
      '<p class="font-display" class:text-3xl={on}>x</p>',
      []
    ],
    [
      'font-display in the same string in a script',
      "<script>const t = 'font-display text-5xl';</script>",
      []
    ],
    [
      'font-display in another string in a script',
      "<script>const a = 'font-display'; const b = 'text-5xl';</script>",
      ['1:text-5xl']
    ]
  ])('%s', (_name, source, expected) => {
    expect(flagged(source)).toEqual(expected);
  });

  it('says the element is a font-display one', () => {
    expect(messages('<p class="font-display text-lg">x</p>')).toEqual([
      'text-lg sets 18px on a font-display element, which is not a Display step.'
    ]);
  });
});

describe('CSS font-size', () => {
  it.each([
    ['px on the ramp', '<style>.a { font-size: 14px; }</style>', []],
    [
      'rem on the ramp, marked important',
      '<style>.a { font-size: 0.6875rem !important; }</style>',
      []
    ],
    ['rem off the ramp', '<style>\n.a {\n  font-size: 1rem;\n}\n</style>', ['3:font-size:']],
    ['px off the ramp, nested', '<style>.a { .b { font-size: 13px; } }</style>', ['1:font-size:']],
    [
      'inside @media print',
      '<style>@media print { :global(body) { font-size: 11pt; } .a { .b { font-size: 9px } } }</style>',
      []
    ],
    ['inside @media only print', '<style>@media only print { .a { font-size: 9px; } }</style>', []],
    [
      'inside @media only screen',
      '<style>@media only screen { .a { font-size: 9px; } }</style>',
      ['1:font-size:']
    ],
    [
      'inside a media query that also matches screen',
      '<style>\n  @media print, screen { .a { font-size: 13px; } }\n  @media screen, print { .a { font-size: 13px; } }\n</style>',
      ['2:font-size:', '3:font-size:']
    ],
    ['rem with no leading zero', '<style>.a { font-size: .6875rem; }</style>', []],
    [
      'inside another media query',
      '<style>@media (min-width: 40rem) { .a { font-size: 13px; } }</style>',
      ['1:font-size:']
    ]
  ])('%s', (_name, source, expected) => {
    expect(flagged(source)).toEqual(expected);
  });

  it('reads a .css file', () => {
    expect(flagged('.a {\n  font-size: 18px;\n}\n', 'src/x.css')).toEqual(['2:font-size:']);
  });
});

describe('sizes the lint cannot read', () => {
  it.each([
    [
      'an arbitrary rem size',
      '<p class="text-[1rem]">x</p>',
      'text-[1rem] sets an arbitrary size other than px (1rem)'
    ],
    [
      'an arbitrary length hint',
      '<p class="text-[length:var(--x)]">x</p>',
      'text-[length:var(--x)] sets an arbitrary size other than px'
    ],
    [
      'an arbitrary clamp()',
      '<p class="text-[clamp(1rem,2vw,2rem)]">x</p>',
      'text-[clamp(1rem,2vw,2rem)] sets an arbitrary size'
    ],
    [
      'a CSS variable size',
      '<p class="text-(length:--x)">x</p>',
      'text-(length:--x) sets a size from a CSS variable'
    ],
    [
      'a Tailwind size FONT_SIZE_PX does not list',
      '<p class="text-6xl">x</p>',
      'text-6xl sets a size name FONT_SIZE_PX does not list'
    ],
    ['a style attribute', '<p style="font-size: 12px">x</p>', 'a style attribute sets font-size'],
    [
      'a dynamic style attribute',
      '<p style={`font-size: ${n}px`}>x</p>',
      'a style attribute sets font-size'
    ],
    ['a style directive', '<p style:font-size="12px">x</p>', 'style:font-size sets a size'],
    [
      'font-size in em',
      '<style>.a { font-size: 1em; }</style>',
      'font-size: 1em is a form this lint cannot read'
    ],
    [
      'font-size from clamp()',
      '<style>.a { font-size: clamp(1rem, 2vw, 2rem); }</style>',
      'font-size: clamp(1rem, 2vw, 2rem) is a form'
    ],
    [
      'font-size in pt on screen',
      '<style>.a { font-size: 11pt; }</style>',
      'font-size: 11pt is a form'
    ],
    [
      'the font shorthand',
      '<style>.a { font: 600 12px/1 Inter; }</style>',
      'font: 600 12px/1 Inter is a shorthand'
    ]
  ])('fails on %s, by name', (_name, source, message) => {
    const found = messages(source);
    expect(found).toHaveLength(1);
    expect(found[0]).toContain(message);
  });

  it('passes a style attribute without font-size', () => {
    expect(flagged('<p style="height: 2px" style:color="red">x</p>')).toEqual([]);
  });
});

describe('@theme sizes', () => {
  const css =
    '@theme {\n  --text-3xs: 0.625rem;\n  --text-huge: 2rem;\n  --text-xs--line-height: 1;\n}\n';

  it('reads the size names app.css adds', () => {
    expect([...rulesFromCss(css).themeSizes]).toEqual([
      ['3xs', 10],
      ['huge', 32]
    ]);
  });

  it('matches FONT_SIZE_PX for every name the real app.css adds', () => {
    expect(rules.themeSizes.size).toBeGreaterThan(0);
    for (const [name, px] of rules.themeSizes)
      expect([name, FONT_SIZE_PX[name]]).toEqual([name, px]);
  });

  it('fails on a theme size name FONT_SIZE_PX does not list, where it is used', () => {
    expect(flagged('<p class="text-huge">x</p>', 'src/lib/X.svelte', rulesFromCss(css))).toEqual([
      '1:text-huge'
    ]);
    expect(flagged('<p class="text-huge">x</p>')).toEqual([]);
  });

  it('fails on a @theme size that differs from FONT_SIZE_PX, or that it does not list', () => {
    expect(messages(css, 'src/app.css')).toEqual([
      "--text-huge: 2rem does not match FONT_SIZE_PX['huge'] (missingpx) in scripts/type-ramp.ts."
    ]);
    expect(messages('@theme inline { --text-2xs: 0.75rem; }', 'src/app.css')).toEqual([
      "--text-2xs: 0.75rem does not match FONT_SIZE_PX['2xs'] (11px) in scripts/type-ramp.ts."
    ]);
    expect(
      messages('@theme { --text-2xs: 0.6875rem; }\n.a { --text-2xs: 3rem; }', 'src/app.css')
    ).toEqual([]);
  });

  it('passes the real app.css', () => {
    expect(messages(appCss, 'src/app.css')).toEqual([]);
  });
});

describe('SCOPED_SIZES', () => {
  const scoped: ScopedSize[] = [
    {
      step: 'Large button',
      file: 'src/lib/Button.svelte',
      cls: 'text-base',
      count: 1,
      reason: 'r'
    },
    { step: 'Headline', file: 'src/routes/g.svelte', cls: 'md:text-3xl', count: 1, reason: 'r' }
  ];

  it('passes the class in its own file and counts it', () => {
    const report = checkSource(
      'src/lib/Button.svelte',
      "<script>const s = 'h-12 text-base';</script>",
      rules,
      scoped
    );
    expect(report.findings).toEqual([]);
    expect([...report.scopedUses]).toEqual([['text-base', 1]]);
  });

  it('fails the class in another file', () => {
    expect(flagged('<p class="text-base">x</p>', 'src/lib/Other.svelte', rules, scoped)).toEqual([
      '1:text-base'
    ]);
  });

  it('matches the class as written, variants included', () => {
    expect(
      flagged('<h1 class="text-2xl md:text-3xl">x</h1>', 'src/routes/g.svelte', rules, scoped)
    ).toEqual([]);
    expect(flagged('<h1 class="text-3xl">x</h1>', 'src/routes/g.svelte', rules, scoped)).toEqual([
      '1:text-3xl'
    ]);
  });

  it('reports an entry whose file writes its class more or fewer times than its count', () => {
    const uses = new Map([
      ['src/lib/Button.svelte', new Map([['text-base', 2]])],
      ['src/routes/g.svelte', new Map([['md:text-3xl', 1]])]
    ]);
    expect(staleScopedSizes(uses, scoped)).toEqual([
      'src/lib/Button.svelte: SCOPED_SIZES expects 1 use(s) of text-base (Large button: r), found 2. Update scripts/type-ramp.ts and DESIGN.md together.'
    ]);
    expect(staleScopedSizes(new Map(), scoped)).toHaveLength(2);
  });
});

describe('the files it reads', () => {
  let root = '';

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true });
    root = '';
  });

  function write(file: string, text: string): void {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }

  it('reads Svelte, TS, JS and CSS under src, but no test, generated or other file', () => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'type-ramp-'));
    for (const file of [
      'src/a.svelte',
      'src/lib/b.ts',
      'src/lib/c.js',
      'src/d.css',
      'src/lib/e.svelte.ts',
      'src/lib/test/f.ts',
      'src/lib/g.test.ts',
      'src/lib/h.svelte.test.ts',
      'src/lib/i.spec.ts',
      'src/test/j.ts',
      'src/lib/paraglide/k.js',
      'src/lib/l.md',
      'src/lib/m.json'
    ]) {
      write(file, '');
    }
    expect(
      sourceFiles(path.join(root, 'src'))
        .map((f) => path.relative(root, f))
        .sort()
    ).toEqual([
      'src/a.svelte',
      'src/d.css',
      'src/lib/b.ts',
      'src/lib/c.js',
      'src/lib/e.svelte.ts',
      'src/lib/test/f.ts'
    ]);
  });
});

describe('the lint-type-ramp command', () => {
  let root = '';

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true });
    root = '';
  });

  function write(file: string, text: string): void {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }

  /** A project whose files hold every SCOPED_SIZES use, and `files`. */
  function project(files: Record<string, string>): void {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'type-ramp-'));
    write('src/app.css', '@theme {\n  --text-2xs: 0.6875rem;\n  --text-3xs: 0.625rem;\n}\n');
    const byFile = new Map<string, string[]>();
    for (const s of SCOPED_SIZES) {
      for (let i = 0; i < s.count; i++) byFile.set(s.file, [...(byFile.get(s.file) ?? []), s.cls]);
    }
    for (const [file, classes] of byFile)
      write(file, classes.map((c) => `<p class="${c}">x</p>`).join('\n'));
    for (const [file, text] of Object.entries(files)) write(file, text);
  }

  function run() {
    const proc = Bun.spawnSync([process.execPath, SCRIPT], { cwd: root });
    return {
      exitCode: proc.exitCode,
      stdout: proc.stdout.toString(),
      stderr: proc.stderr.toString()
    };
  }

  it('exits 0 and prints the OK line on a tree on the ramp', () => {
    project({ 'src/lib/ok.svelte': '<p class="text-sm">x</p>' });
    expect(run()).toEqual({ exitCode: 0, stdout: 'type ramp OK\n', stderr: '' });
  });

  it('exits 1 and lists each problem with its file and line', () => {
    project({ 'src/lib/bad.svelte': '<p class="text-sm">x</p>\n<p class="text-[30px]">y</p>' });
    const result = run();
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toStartWith(
      'Found 1 font size(s) off the type ramp:\n' +
        '  src/lib/bad.svelte:2: text-[30px] sets 30px, which is not a step of the type ramp.\n\n' +
        'The ramp (DESIGN.md, Typography > Hierarchy): Headline text-2xl, Section title text-xl, '
    );
  });

  it('exits 1 on a file the parser rejects', () => {
    project({ 'src/lib/broken.svelte': '<p class="text-sm">x</div>' });
    const result = run();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('  src/lib/broken.svelte: could not parse: ');
  });

  it('exits 1 when a SCOPED_SIZES use is gone', () => {
    project({ [SCOPED_SIZES[0].file]: '<p class="text-sm">x</p>' });
    const result = run();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      `  ${SCOPED_SIZES[0].file}: SCOPED_SIZES expects 1 use(s) of ${SCOPED_SIZES[0].cls}`
    );
  });

  it('fails when src/app.css cannot be read', () => {
    project({});
    fs.rmSync(path.join(root, 'src/app.css'));
    expect(lintProject(root)[0]).toStartWith('src/app.css: could not read its @theme sizes: ');
  });
});

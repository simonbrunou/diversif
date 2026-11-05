#!/usr/bin/env bun
/**
 * lint-paired-foreground: fails when markup sets ink or a grey on a tint.
 *
 * DESIGN.md, The Paired Foreground Rule: "Text on a tint uses that tint's own
 * `-foreground` token. Never `ink-soft`, never `ink`, never a grey."
 * scripts/lint-contrast.ts cannot see this: `ink-soft` clears AA on every
 * solid tint, it skips `bg-x/NN` washes, and it reads no background from a
 * dynamic `class={...}` (#649).
 *
 * - A tint is a `bg-*` class for a `tile-*` or `reaction-*` token that
 *   src/app.css pairs with a `-foreground` token, or for an alias of one
 *   (`warning`, `accent-sky`), with or without `/NN` and behind any variant,
 *   or a `<Card>` whose `variant` is `tile-*`. It covers the element and its
 *   descendants until one sets a background of its own.
 * - A forbidden foreground is `text-ink`, `text-ink-soft`, `text-foreground`,
 *   `text-muted-foreground`, or any token app.css aliases to one of them,
 *   behind any variant, `!` or `/NN`.
 * - Every string literal inside a `class={...}` or `class="... {...}"`
 *   expression counts, whichever branch it sits in, and so does a
 *   `class:name={...}` directive: dynamic classes hid the #360 sites from the
 *   contrast lint. A class held in a variable (`{f.tile}`) is not read.
 *
 * - Only a background set in the static part of a class (`class="bg-card"`,
 *   not `class={on ? 'bg-card' : ''}`) or by a `<Card>` ends the tint: one
 *   set in a single branch leaves the other branches on the tint.
 *
 * Two more checks catch what that read cannot see (#667):
 *
 * - Unpaired tint: a tint class on an element with content needs its paired
 *   `text-*-foreground` in the same string, or in the static class text.
 *   Without it the text inherits ink, with no class for the read above to
 *   flag.
 * - Grey component: `Label`, `Field`, `SectionHeader` and `SourceCitation` set
 *   a grey inside themselves (GREY_COMPONENTS). Inside a tint, a call
 *   overrides it with `text-current`, `text-inherit` or the paired foreground
 *   in the static text of the matching class prop.
 *
 * Tints held in script values (a `TONES` record) are not read: their
 * component tests assert expectPairedForeground (src/test/paired-foreground.ts).
 *
 * Escape marker: `paired-foreground-ok: <reason>` on the flagged line, for a
 * class the conservative dynamic read flags on an untinted branch. A marker
 * with no reason after its colon does not count.
 *
 * Run via `bun run lint:paired-foreground` (part of `bun run lint`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'svelte/compiler';

export const ESCAPE_MARKER = 'paired-foreground-ok';
const ESCAPE_WITH_REASON = new RegExp(`${ESCAPE_MARKER}:\\s*[^\\s*-]`);

/** Ink and the greys: never a foreground on a tint. */
const INK_AND_GREYS = ['ink', 'ink-soft', 'foreground', 'muted-foreground'];

export type PairedForegroundRules = {
  /** Tint colour name (`tile-peach`, `reaction-inconfort`) -> its paired text utility. */
  tints: Map<string, string>;
  /** Colour names that are ink or a grey (`ink`, `card-foreground`, ...). */
  forbidden: Set<string>;
};

export type PairedForegroundViolation = {
  line: number;
  /** The forbidden class as written, variants included. */
  cls: string;
  /** The tint classes in force, as written (`bg-tile-peach/20`, `Card variant="tile-lilac"`). */
  tints: string[];
  /** The line that set the tint. */
  tintLine: number;
  /** The paired text utility of each tint, in the order of `tints`. */
  use: string[];
};

/** Each alias name and the names it points at, in any theme block. */
type Aliases = Map<string, Set<string>>;

/**
 * Every `--name` app.css declares, and its aliases. A declaration
 * `--x: var(--y)` (theme tables) or `--color-x: hsl(var(--y))` (`@theme`)
 * makes `x` an alias of `y`.
 */
function readDeclarations(css: string): { declared: Set<string>; aliases: Aliases } {
  const declared = new Set<string>();
  const aliases: Aliases = new Map();
  for (const [, name, value] of css.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    declared.add(name);
    const target = /^(?:hsl\()?var\(--([\w-]+)\)\)?$/.exec(value.trim())?.[1];
    const alias = name.replace(/^color-/, '');
    if (!target || alias === target) continue;
    aliases.set(alias, (aliases.get(alias) ?? new Set<string>()).add(target));
  }
  return { declared, aliases };
}

/**
 * Adds to `found` every alias whose chain reaches one of its names, with the
 * value `valueOf(alias, the name it reached)`.
 */
function addAliases(
  found: Map<string, string>,
  aliases: Aliases,
  valueOf: (alias: string, target: string) => string
): void {
  for (let grew = true; grew;) {
    grew = false;
    for (const [alias, targets] of aliases) {
      const target = [...targets].find((t) => found.has(t));
      if (found.has(alias) || target === undefined) continue;
      found.set(alias, valueOf(alias, target));
      grew = true;
    }
  }
}

/**
 * Reads the tints and the forbidden foregrounds from app.css, aliases
 * included, so a new alias of ink or of a tint is caught without editing this
 * script.
 */
export function rulesFromCss(css: string): PairedForegroundRules {
  const { declared, aliases } = readDeclarations(css);
  const greys = new Map(INK_AND_GREYS.map((g) => [g, g]));
  addAliases(greys, aliases, (alias) => alias);
  const tints = new Map(
    [...declared]
      .filter((name) => /^(?:tile|reaction)-[a-z]+$/.test(name))
      .filter((name) => declared.has(`${name}-foreground`))
      .map((name) => [name, `text-${name}-foreground`])
  );
  // An alias of a tint (`--warning: var(--tile-butter)`, `--color-accent-sky:
  // hsl(var(--tile-sky))`) paints the same tint: it pairs its own -foreground
  // when it declares one, else the tint's.
  addAliases(tints, aliases, (alias, tint) =>
    declared.has(`${alias}-foreground`) ? `text-${alias}-foreground` : (tints.get(tint) ?? '')
  );
  return { tints, forbidden: new Set(greys.keys()) };
}

/** A class with its variants, `!` and `/NN` removed. */
function bare(cls: string): string {
  return cls
    .slice(cls.lastIndexOf(':') + 1)
    .replace(/^!|!$/g, '')
    .replace(/\/(?:\d+|\[[^\]]*\])$/, '');
}

/**
 * `bg-*` utilities that set no colour of their own, so the tint behind them
 * still shows. A gradient's colours come from its `from-*`/`to-*` stops, which
 * are not read, so it does not end the tint either. expectPairedForeground
 * (src/test/paired-foreground.ts) uses the same list.
 */
export const NOT_A_BACKGROUND =
  /^bg-(?:transparent|none|inherit|fixed|local|scroll|auto|cover|contain|no-repeat|repeat(?:-\w+)?|clip-\S+|origin-\S+|blend-\S+|(?:top|bottom|left|right|center)(?:-(?:left|right))?|(?:linear|radial|conic|gradient)(?:-\S+)?)$/;

/**
 * A class, where it starts, whether it applies in every branch (static text),
 * and the string it sits in: the start of its string literal, template
 * literal or class directive, or `STATIC` for the static text.
 */
type ClassToken = { cls: string; offset: number; always: boolean; group: number };
type Tint = { name: string; label: string; offset: number };
type Context = { tints: Tint[] } | null;

const STATIC = -1;

type EstreeNode = { type: string; start: number; end: number; [key: string]: unknown };

function isNode(value: unknown): value is EstreeNode {
  return (
    typeof value === 'object' && value !== null && typeof (value as EstreeNode).type === 'string'
  );
}

function splitClasses(text: string, offset: number, out: ClassToken[], group: number): void {
  for (const m of text.matchAll(/\S+/g)) {
    out.push({ cls: m[0], offset: offset + (m.index ?? 0), always: group === STATIC, group });
  }
}

/** Every string literal in a JS expression, split into classes. */
function literalClasses(node: unknown, out: ClassToken[]): void {
  if (Array.isArray(node)) {
    for (const child of node) literalClasses(child, out);
    return;
  }
  if (!isNode(node)) return;
  if (node.type === 'Literal' && typeof node.value === 'string') {
    splitClasses(node.value, node.start + 1, out, node.start);
    return;
  }
  // The static parts of a template literal (`bg-tile-mint ${x}`), one string.
  if (node.type === 'TemplateLiteral') {
    for (const quasi of node.quasis as EstreeNode[]) {
      splitClasses((quasi.value as { raw: string }).raw, quasi.start, out, node.start);
    }
    literalClasses(node.expressions, out);
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key !== 'loc' && key !== 'metadata') literalClasses(value, out);
  }
}

/** An attribute value's static text and the string literals in its expressions. */
function attributeClasses(value: unknown, out: ClassToken[]): void {
  for (const part of Array.isArray(value) ? value : [value]) {
    if (!isNode(part)) continue;
    if (part.type === 'Text') splitClasses(String(part.raw), part.start, out, STATIC);
    else if (part.type === 'ExpressionTag') literalClasses(part.expression, out);
  }
}

type SvelteAttribute = EstreeNode & { name: string; value: unknown };

function elementClasses(attributes: SvelteAttribute[]): ClassToken[] {
  const out: ClassToken[] = [];
  for (const attr of attributes) {
    if (attr.type === 'Attribute' && attr.name === 'class') attributeClasses(attr.value, out);
    else if (attr.type === 'ClassDirective') {
      const offset = attr.start + 'class:'.length;
      out.push({ cls: attr.name, offset, always: false, group: offset });
    }
  }
  return out;
}

/**
 * The tints an element's classes set, and whether one of its classes paints a
 * background of another colour in every branch.
 */
function classBackground(
  classes: ClassToken[],
  rules: PairedForegroundRules
): { tints: Tint[]; setsBackground: boolean } {
  const tints: Tint[] = [];
  let setsBackground = false;
  for (const { cls, offset, always } of classes) {
    const b = bare(cls);
    if (!b.startsWith('bg-')) continue;
    const name = b.slice('bg-'.length);
    if (rules.tints.has(name)) tints.push({ name, label: cls, offset });
    else if (always && !cls.includes(':') && !NOT_A_BACKGROUND.test(b)) setsBackground = true;
  }
  return { tints, setsBackground };
}

/** The tile tints a `<Card variant="tile-*">` sets, static or in any branch. */
function cardTints(node: EstreeNode, rules: PairedForegroundRules): Tint[] {
  const variant = (node.attributes as SvelteAttribute[]).find(
    (a) => a.type === 'Attribute' && a.name === 'variant'
  );
  const values: ClassToken[] = [];
  if (variant) attributeClasses(variant.value, values);
  return values
    .filter(({ cls }) => /^tile-/.test(cls) && rules.tints.has(cls))
    .map(({ cls, offset }) => ({ name: cls, label: `Card variant="${cls}"`, offset }));
}

/** The tint in force on an element and its children: its own, none, or its parent's. */
function ownContext(
  node: EstreeNode,
  classes: ClassToken[],
  inherited: Context,
  rules: PairedForegroundRules
): Context {
  const own = classBackground(classes, rules);
  // ui/Card sets a background for every variant: bg-card unless a tile.
  const isCard = node.type === 'Component' && node.name === 'Card';
  const tints = isCard ? [...own.tints, ...cardTints(node, rules)] : own.tints;
  if (tints.length > 0) return { tints };
  return own.setsBackground || isCard ? null : inherited;
}

/** A 1-based line lookup for offsets in `source`, and whether a line carries the marker. */
function lineIndex(source: string): {
  lineOf: (offset: number) => number;
  marked: (line: number) => boolean;
} {
  const lineStarts = [0];
  for (const m of source.matchAll(/\n/g)) lineStarts.push((m.index ?? 0) + 1);
  const lines = source.split('\n');
  return {
    lineOf: (offset) => {
      let lo = 0;
      let hi = lineStarts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (lineStarts[mid] <= offset) lo = mid;
        else hi = mid - 1;
      }
      return lo + 1;
    },
    marked: (line) => ESCAPE_WITH_REASON.test(lines[line - 1] ?? '')
  };
}

/**
 * Calls `onElement` on every element and component of one Svelte file, with
 * its classes and the tint in force on it (its own, else its parent's, unless
 * it sets a background of its own). Throws on a file the parser rejects.
 */
function walkTints(
  source: string,
  rules: PairedForegroundRules,
  onElement: (node: EstreeNode, classes: ClassToken[], context: Context) => void
): void {
  function visit(node: unknown, context: Context): void {
    if (Array.isArray(node)) {
      for (const child of node) visit(child, context);
      return;
    }
    if (!isNode(node)) return;
    let inner = context;
    if (Array.isArray(node.attributes)) {
      const classes = elementClasses(node.attributes as SvelteAttribute[]);
      inner = ownContext(node, classes, context, rules);
      onElement(node, classes, inner);
    }
    for (const value of Object.values(node)) {
      if (isNode(value) && value.type === 'Fragment') visit(value.nodes, inner);
    }
  }

  const ast = parse(source, { modern: true });
  visit(ast.fragment.nodes, null);
}

/** The distinct tints in force, in order, and the line of the first. */
function tintsInForce(
  context: { tints: Tint[] },
  rules: PairedForegroundRules,
  lineOf: (offset: number) => number
): { tints: string[]; tintLine: number; use: string[] } {
  const seen = new Set<string>();
  const tints = context.tints.filter((t) => !seen.has(t.label) && seen.add(t.label));
  return {
    tints: tints.map((t) => t.label),
    tintLine: lineOf(tints[0].offset),
    use: tints.map((t) => rules.tints.get(t.name) ?? '')
  };
}

/**
 * Every class that sets ink or a grey on a tint, in one Svelte file's source.
 * Throws on a file the Svelte parser rejects.
 */
export function findPairedForegroundViolations(
  source: string,
  rules: PairedForegroundRules
): PairedForegroundViolation[] {
  const { lineOf, marked } = lineIndex(source);
  const violations: PairedForegroundViolation[] = [];
  walkTints(source, rules, (_node, classes, context) => {
    if (!context) return;
    for (const { cls, offset } of classes) {
      const b = bare(cls);
      if (!b.startsWith('text-') || !rules.forbidden.has(b.slice('text-'.length))) continue;
      const line = lineOf(offset);
      if (marked(line)) continue;
      violations.push({ line, cls, ...tintsInForce(context, rules, lineOf) });
    }
  });
  return violations;
}

export function formatViolation(file: string, v: PairedForegroundViolation): string {
  const tint = v.tints.join(', ');
  const use = v.use.join(' or ');
  return `${file}:${v.line}: ${v.cls} on ${tint} (line ${v.tintLine}). Set ${use} on the tinted element and let its text inherit it.`;
}

export type UnpairedTint = {
  line: number;
  /** The element or component that holds the tint (`span`, `Card`). */
  element: string;
  /** The tint class as written, variants included. */
  tint: string;
  /** The tint's paired text utility. */
  use: string;
};

/** A class's variant prefix (`dark:`, `hover:`), empty for none. */
function variantOf(cls: string): string {
  return cls.slice(0, cls.lastIndexOf(':') + 1);
}

/** Nodes that put something on screen inside an element. */
const CONTENT = new Set([
  'ExpressionTag',
  'RenderTag',
  'HtmlTag',
  'Component',
  'SvelteComponent',
  'SvelteSelf',
  'SlotElement'
]);

/** Whether any of `nodes`, or anything under them, is text or renders some. */
function hasContent(nodes: unknown): boolean {
  if (Array.isArray(nodes)) return nodes.some(hasContent);
  if (!isNode(nodes)) return false;
  if (nodes.type === 'Text') return /\S/.test(String(nodes.data));
  if (CONTENT.has(nodes.type)) return true;
  return Object.values(nodes).some(
    (v) => isNode(v) && v.type === 'Fragment' && hasContent(v.nodes)
  );
}

/**
 * Every tint class on an element with content whose paired text utility is
 * neither in the same string as the tint nor in the element's static class
 * text, in one Svelte file's source. Without it the text inherits ink. A
 * utility in another branch of a dynamic class does not count, and neither
 * does one behind a variant the tint does not share (`hover:`). A `<Card
 * variant="tile-*">` sets its own foreground and is not checked.
 */
export function findUnpairedTints(source: string, rules: PairedForegroundRules): UnpairedTint[] {
  const { lineOf, marked } = lineIndex(source);
  const unpaired: UnpairedTint[] = [];
  walkTints(source, rules, (node, classes) => {
    const tints = classes.filter((c) => {
      const b = bare(c.cls);
      return b.startsWith('bg-') && rules.tints.has(b.slice('bg-'.length));
    });
    if (tints.length === 0) return;
    const content =
      node.type === 'Component' ||
      Object.values(node).some((v) => isNode(v) && v.type === 'Fragment' && hasContent(v.nodes));
    if (!content) return;
    for (const tint of tints) {
      const use = rules.tints.get(bare(tint.cls).slice('bg-'.length)) ?? '';
      const paired = classes.some(
        (c) =>
          (c.always || c.group === tint.group) &&
          bare(c.cls) === use &&
          ['', variantOf(tint.cls)].includes(variantOf(c.cls))
      );
      const line = lineOf(tint.offset);
      if (paired || marked(line)) continue;
      unpaired.push({ line, element: String(node.name), tint: tint.cls, use });
    }
  });
  return unpaired;
}

export function formatUnpairedTint(file: string, u: UnpairedTint): string {
  return `${file}:${u.line}: <${u.element}> holds ${u.tint} but sets no foreground of its own, so its text inherits ink. Add ${u.use} to the string that holds the tint, or to the static class text, and let its text inherit it.`;
}

/** One grey a component sets inside itself, and the prop a caller overrides it with. */
type GreyPart = {
  /** The class prop whose classes merge over the grey. */
  prop: string;
  /** The grey, as the component writes it. */
  grey: string;
  /** The part renders only when the call passes this prop. */
  shownBy?: string;
  /**
   * The grey applies only when this prop is absent or holds one of these
   * values. A value the lint cannot read counts as one of them.
   */
  greyWhen?: { prop: string; values: string[] };
};

/**
 * The components that set a grey inside themselves, so the call site shows
 * none for the lint to read. Their test checks each one still sets that grey
 * and takes that prop.
 */
export const GREY_COMPONENTS: ReadonlyMap<string, { file: string; parts: GreyPart[] }> = new Map([
  [
    'Label',
    {
      file: 'src/lib/components/ui/Label.svelte',
      parts: [{ prop: 'class', grey: 'text-ink-soft' }]
    }
  ],
  [
    'Field',
    {
      file: 'src/lib/components/ui/Field.svelte',
      parts: [
        { prop: 'labelClass', grey: 'text-ink-soft' },
        { prop: 'hintClass', grey: 'text-ink-soft', shownBy: 'hint' }
      ]
    }
  ],
  [
    'SectionHeader',
    {
      file: 'src/lib/components/ui/SectionHeader.svelte',
      parts: [
        { prop: 'class', grey: 'text-ink-soft', greyWhen: { prop: 'tone', values: ['default'] } }
      ]
    }
  ],
  [
    'SourceCitation',
    {
      file: 'src/lib/components/SourceCitation.svelte',
      parts: [{ prop: 'class', grey: 'text-muted-foreground' }]
    }
  ]
]);

export type GreyComponent = {
  line: number;
  component: string;
  grey: string;
  /** The class prop that would override the grey. */
  prop: string;
  tints: string[];
  tintLine: number;
  use: string[];
};

function attribute(node: EstreeNode, name: string): SvelteAttribute | undefined {
  return (node.attributes as SvelteAttribute[]).find(
    (a) => a.type === 'Attribute' && a.name === name
  );
}

/** An attribute's static text (`tone="destructive"`), or undefined when it holds an expression. */
function staticValue(attr: SvelteAttribute): string | undefined {
  const parts = Array.isArray(attr.value) ? attr.value : [attr.value];
  if (!parts.every((p) => isNode(p) && p.type === 'Text')) return undefined;
  return parts.map((p) => String((p as EstreeNode).raw)).join('');
}

/**
 * Every call to a GREY_COMPONENTS component inside a tint that leaves its grey
 * in place, in one Svelte file's source. The call overrides it with
 * `text-current`, `text-inherit` or the tint's paired foreground in the
 * static text of the part's class prop. A class in one branch of a dynamic
 * prop does not count, as a background in one branch does not end a tint.
 */
export function findGreyComponents(source: string, rules: PairedForegroundRules): GreyComponent[] {
  const { lineOf, marked } = lineIndex(source);
  const found: GreyComponent[] = [];
  walkTints(source, rules, (node, _classes, context) => {
    const spec = node.type === 'Component' ? GREY_COMPONENTS.get(String(node.name)) : undefined;
    if (!spec || !context) return;
    const inForce = tintsInForce(context, rules, lineOf);
    const line = lineOf(node.start);
    if (marked(line)) return;
    for (const part of spec.parts) {
      if (part.shownBy && !attribute(node, part.shownBy)) continue;
      if (part.greyWhen) {
        const set = attribute(node, part.greyWhen.prop);
        const value = set && staticValue(set);
        if (value !== undefined && !part.greyWhen.values.includes(value)) continue;
      }
      const prop = attribute(node, part.prop);
      const overrides: ClassToken[] = [];
      if (prop) attributeClasses(prop.value, overrides);
      const overridden = overrides.some(
        (c) =>
          c.always &&
          variantOf(c.cls) === '' &&
          ['text-current', 'text-inherit', ...inForce.use].includes(bare(c.cls))
      );
      if (overridden) continue;
      found.push({
        line,
        component: String(node.name),
        grey: part.grey,
        prop: part.prop,
        ...inForce
      });
    }
  });
  return found;
}

export function formatGreyComponent(file: string, g: GreyComponent): string {
  const use = ['text-current', ...g.use].join(' or ');
  return `${file}:${g.line}: <${g.component}> sets ${g.grey} inside itself, on ${g.tints.join(', ')} (line ${g.tintLine}). Pass ${use} in its ${g.prop} prop's static text.`;
}

function svelteFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'paraglide' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) svelteFiles(full, out);
    else if (entry.isFile() && entry.name.endsWith('.svelte')) out.push(full);
  }
  return out;
}

if (import.meta.main) {
  const root = process.cwd();
  const rules = rulesFromCss(fs.readFileSync(path.join(root, 'src/app.css'), 'utf8'));
  const problems: string[] = [];
  for (const full of svelteFiles(path.join(root, 'src')).sort()) {
    const file = path.relative(root, full);
    try {
      const source = fs.readFileSync(full, 'utf8');
      for (const v of findPairedForegroundViolations(source, rules)) {
        problems.push(formatViolation(file, v));
      }
      for (const u of findUnpairedTints(source, rules)) problems.push(formatUnpairedTint(file, u));
      for (const g of findGreyComponents(source, rules))
        problems.push(formatGreyComponent(file, g));
    } catch (error) {
      problems.push(`${file}: could not parse: ${(error as Error).message}`);
    }
  }
  if (problems.length > 0) {
    console.error(`Found ${problems.length} break(s) of The Paired Foreground Rule:`);
    for (const p of problems) console.error(`  ${p}`);
    console.error(
      "\nDESIGN.md, The Paired Foreground Rule: text on a tint uses that tint's own\n" +
        '-foreground token. If the lint reads a branch that never sits on the tint, add a\n' +
        `\`${ESCAPE_MARKER}: <reason>\` comment on the flagged line.`
    );
    process.exit(1);
  }
  console.log('paired foregrounds OK');
}

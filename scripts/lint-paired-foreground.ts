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

/**
 * Reads the tints and the forbidden foregrounds from app.css. A declaration
 * `--x: var(--y)` (theme tables) or `--color-x: hsl(var(--y))` (`@theme`)
 * makes `x` an alias of `y`, so a new alias of ink is caught without editing
 * this script.
 */
export function rulesFromCss(css: string): PairedForegroundRules {
  const declared = new Set<string>();
  const aliases = new Map<string, Set<string>>();
  for (const [, name, value] of css.matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) {
    declared.add(name);
    const target = /^(?:hsl\()?var\(--([\w-]+)\)\)?$/.exec(value.trim())?.[1];
    if (!target) continue;
    const alias = name.replace(/^color-/, '');
    if (alias === target) continue;
    if (!aliases.has(alias)) aliases.set(alias, new Set());
    aliases.get(alias)?.add(target);
  }

  const forbidden = new Set(INK_AND_GREYS);
  for (let grew = true; grew;) {
    grew = false;
    for (const [alias, targets] of aliases) {
      if (!forbidden.has(alias) && [...targets].some((t) => forbidden.has(t))) {
        forbidden.add(alias);
        grew = true;
      }
    }
  }

  const tints = new Map<string, string>();
  for (const name of declared) {
    if (/^(?:tile|reaction)-[a-z]+$/.test(name) && declared.has(`${name}-foreground`)) {
      tints.set(name, `text-${name}-foreground`);
    }
  }
  // An alias of a tint (`--warning: var(--tile-butter)`, `--color-accent-sky:
  // hsl(var(--tile-sky))`) paints the same tint: it pairs its own -foreground
  // when it declares one, else the tint's.
  for (let grew = true; grew;) {
    grew = false;
    for (const [alias, targets] of aliases) {
      const tint = [...targets].find((t) => tints.has(t));
      if (tints.has(alias) || !tint) continue;
      const own = `${alias}-foreground`;
      tints.set(alias, declared.has(own) ? `text-${own}` : (tints.get(tint) ?? ''));
      grew = true;
    }
  }
  return { tints, forbidden };
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

/** A class, where it starts, and whether it applies in every branch (static text). */
type ClassToken = { cls: string; offset: number; always: boolean };
type Tint = { name: string; label: string; offset: number };
type Context = { tints: Tint[] } | null;

type EstreeNode = { type: string; start: number; end: number; [key: string]: unknown };

function isNode(value: unknown): value is EstreeNode {
  return (
    typeof value === 'object' && value !== null && typeof (value as EstreeNode).type === 'string'
  );
}

function splitClasses(text: string, offset: number, out: ClassToken[], always = false): void {
  for (const m of text.matchAll(/\S+/g)) {
    out.push({ cls: m[0], offset: offset + (m.index ?? 0), always });
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
    splitClasses(node.value, node.start + 1, out);
    return;
  }
  // The static parts of a template literal (`bg-tile-mint ${x}`).
  if (node.type === 'TemplateElement') {
    splitClasses((node.value as { raw: string }).raw, node.start, out);
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
    if (part.type === 'Text') splitClasses(String(part.raw), part.start, out, true);
    else if (part.type === 'ExpressionTag') literalClasses(part.expression, out);
  }
}

type SvelteAttribute = EstreeNode & { name: string; value: unknown };

function elementClasses(attributes: SvelteAttribute[]): ClassToken[] {
  const out: ClassToken[] = [];
  for (const attr of attributes) {
    if (attr.type === 'Attribute' && attr.name === 'class') attributeClasses(attr.value, out);
    else if (attr.type === 'ClassDirective') {
      out.push({ cls: attr.name, offset: attr.start + 'class:'.length, always: false });
    }
  }
  return out;
}

/**
 * Every class that sets ink or a grey on a tint, in one Svelte file's source.
 * Throws on a file the Svelte parser rejects.
 */
export function findPairedForegroundViolations(
  source: string,
  rules: PairedForegroundRules
): PairedForegroundViolation[] {
  const lineStarts = [0];
  for (const m of source.matchAll(/\n/g)) lineStarts.push((m.index ?? 0) + 1);
  const lineOf = (offset: number): number => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
  const lines = source.split('\n');
  const violations: PairedForegroundViolation[] = [];

  function ownContext(node: EstreeNode, classes: ClassToken[], inherited: Context): Context {
    const tints: Tint[] = [];
    let setsBackground = false;
    for (const { cls, offset, always } of classes) {
      const b = bare(cls);
      if (!b.startsWith('bg-')) continue;
      const name = b.slice('bg-'.length);
      if (rules.tints.has(name)) tints.push({ name, label: cls, offset });
      else if (always && !cls.includes(':') && !NOT_A_BACKGROUND.test(b)) setsBackground = true;
    }
    if (node.type === 'Component' && node.name === 'Card') {
      // ui/Card sets a background for every variant: bg-card unless a tile.
      setsBackground = true;
      const variant = (node.attributes as SvelteAttribute[]).find(
        (a) => a.type === 'Attribute' && a.name === 'variant'
      );
      const values: ClassToken[] = [];
      if (variant) attributeClasses(variant.value, values);
      for (const { cls, offset } of values) {
        if (/^tile-/.test(cls) && rules.tints.has(cls)) {
          tints.push({ name: cls, label: `Card variant="${cls}"`, offset });
        }
      }
    }
    if (tints.length > 0) return { tints };
    return setsBackground ? null : inherited;
  }

  function visitElement(node: EstreeNode, inherited: Context): Context {
    const classes = elementClasses(node.attributes as SvelteAttribute[]);
    const context = ownContext(node, classes, inherited);
    if (!context) return context;
    for (const { cls, offset } of classes) {
      const b = bare(cls);
      if (!b.startsWith('text-') || !rules.forbidden.has(b.slice('text-'.length))) continue;
      const line = lineOf(offset);
      if (ESCAPE_WITH_REASON.test(lines[line - 1] ?? '')) continue;
      const seen = new Set<string>();
      const tints = context.tints.filter((t) => !seen.has(t.label) && seen.add(t.label));
      violations.push({
        line,
        cls,
        tints: tints.map((t) => t.label),
        tintLine: lineOf(tints[0].offset),
        use: tints.map((t) => rules.tints.get(t.name) ?? '')
      });
    }
    return context;
  }

  function visit(node: unknown, context: Context): void {
    if (Array.isArray(node)) {
      for (const child of node) visit(child, context);
      return;
    }
    if (!isNode(node)) return;
    const inner = Array.isArray(node.attributes) ? visitElement(node, context) : context;
    for (const value of Object.values(node)) {
      if (isNode(value) && value.type === 'Fragment') visit(value.nodes, inner);
    }
  }

  const ast = parse(source, { modern: true });
  visit(ast.fragment.nodes, null);
  return violations;
}

export function formatViolation(file: string, v: PairedForegroundViolation): string {
  const tint = v.tints.join(', ');
  const use = v.use.join(' or ');
  return `${file}:${v.line}: ${v.cls} on ${tint} (line ${v.tintLine}). Set ${use} on the tinted element and let its text inherit it.`;
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
      const found = findPairedForegroundViolations(fs.readFileSync(full, 'utf8'), rules);
      for (const v of found) problems.push(formatViolation(file, v));
    } catch (error) {
      problems.push(`${file}: could not parse: ${(error as Error).message}`);
    }
  }
  if (problems.length > 0) {
    console.error(`Found ${problems.length} grey or ink foreground(s) on a tint:`);
    for (const p of problems) console.error(`  ${p}`);
    console.error(
      "\nDESIGN.md, The Paired Foreground Rule: text on a tint uses that tint's own\n" +
        '-foreground token. If the class only applies to an untinted branch of a dynamic\n' +
        `class, add a \`${ESCAPE_MARKER}: <reason>\` comment on its line.`
    );
    process.exit(1);
  }
  console.log('paired foregrounds OK');
}

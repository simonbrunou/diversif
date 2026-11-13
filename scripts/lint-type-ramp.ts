#!/usr/bin/env bun
/**
 * lint-type-ramp: fails on a font size outside DESIGN.md's type ramp (#365).
 *
 * The steps live in scripts/type-ramp.ts. A size passes when it is a step
 * any element may use, a Display step on an element whose class also holds
 * `font-display`, or one of the SCOPED_SIZES uses in its own file.
 *
 * What it reads, in every .svelte, .ts, .js and .css file under src/ except
 * tests (`*.test.ts`, `*.spec.ts`, src/test/) and the generated paraglide/:
 *
 * - Tailwind size classes (`text-sm`, `md:text-3xl`, `text-[28px]/none`,
 *   `!text-xs`) in attribute values, `class:` directives, every string or
 *   template literal in markup and scripts, and `@apply`. A size name is one
 *   of Tailwind's (`xs`, `sm`, `base`, `lg`, `Nxl`, `Nxs`) or a `--text-*`
 *   that src/app.css declares in `@theme`.
 * - CSS `font-size` declarations in px or rem, outside a print-only `@media`
 *   block (the print stylesheet is a documented deviation in DESIGN.md).
 * - `@theme` `--text-*` declarations, which must match FONT_SIZE_PX.
 *
 * `font-display` counts in the same string literal as the size, or in the
 * static text of the same attribute. These forms fail by name, as sizes the
 * lint cannot read: `text-[1rem]`, `text-(length:--x)`, `font-size: 1em`, the
 * `font` shorthand, a `style:font-size` or `style:font` directive, an
 * attribute or string whose text declares `font-size` or `font` (a style
 * attribute, `cssText`, a spread's `style`), the bare string `font-size`
 * (`setProperty`), and the name `fontSize`. CSS property names match in any
 * case. It does not see a size a script builds at run time from other text.
 * There is no inline escape: a kept off-ramp size is a SCOPED_SIZES entry,
 * named in DESIGN.md.
 *
 * Run via `bun run lint:type-ramp` (part of `bun run lint`).
 */
import fs from 'node:fs';
import path from 'node:path';
import { parse } from 'svelte/compiler';
import {
  DISPLAY_PX,
  FONT_SIZE_PX,
  RAMP,
  RAMP_PX,
  SCOPED_SIZES,
  type ScopedSize
} from './type-ramp';

export type TypeRampRules = {
  /** Size names src/app.css adds in `@theme` (`2xs`, `3xs`), with their px. */
  themeSizes: Map<string, number>;
};

export type TypeRampFinding = { line: number; message: string };

export type FileReport = {
  findings: TypeRampFinding[];
  /** Uses of each SCOPED_SIZES class in this file, keyed by the class. */
  scopedUses: Map<string, number>;
};

type Node = { type: string; start: number; end: number; [key: string]: unknown };

function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && typeof (value as Node).type === 'string';
}

const TAILWIND_SIZE_NAME = /^(?:\d*x[sl]|sm|base|lg)$/;

/** Colours an arbitrary `text-[...]` can hold: those set no size. */
const ARBITRARY_COLOUR = /^(?:#|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color-mix|var)\(|color:|--)/;

/** The pixel size a font-size value in CSS sets: px or rem, else undefined. */
function cssPx(value: string): number | undefined {
  const m = /^(\d+(?:\.\d+)?|\.\d+)(px|rem)$/.exec(value.replace(/\s*!important$/, '').trim());
  if (!m) return undefined;
  return m[2] === 'rem' ? Number(m[1]) * 16 : Number(m[1]);
}

/** The `@theme` `--text-<name>` declarations of a stylesheet. */
function themeDeclarations(css: string): { name: string; value: string; start: number }[] {
  const out: { name: string; value: string; start: number }[] = [];
  const ast = parse(`<style>${css}</style>`, { modern: true });
  const visit = (nodes: unknown[], inTheme: boolean) => {
    for (const n of nodes) {
      if (!isNode(n)) continue;
      const block = n.block as { children: unknown[] } | null | undefined;
      if (n.type === 'Atrule' && block) visit(block.children, inTheme || n.name === 'theme');
      else if (n.type === 'Rule' && block) visit(block.children, inTheme);
      else if (n.type === 'Declaration' && inTheme) {
        const name = /^--text-([\w-]+)$/.exec(String(n.property))?.[1];
        // `--text-xs--line-height` and the like set no size.
        if (name && !name.includes('--'))
          out.push({ name, value: String(n.value), start: n.start });
      }
    }
  };
  visit(ast.css?.children ?? [], false);
  return out;
}

/** Reads the extra size names from src/app.css's `@theme` block. */
export function rulesFromCss(css: string): TypeRampRules {
  const themeSizes = new Map<string, number>();
  for (const { name, value } of themeDeclarations(css)) {
    const px = cssPx(value);
    if (px !== undefined) themeSizes.set(name, px);
  }
  return { themeSizes };
}

/** Splits `md:hover:text-sm` into its variants and its utility, outside brackets. */
function splitVariants(cls: string): { variants: string; utility: string } {
  let depth = 0;
  let cut = -1;
  for (let i = 0; i < cls.length; i++) {
    const c = cls[i];
    if (c === '[' || c === '(') depth++;
    else if (c === ']' || c === ')') depth--;
    else if (c === ':' && depth === 0) cut = i;
  }
  return { variants: cls.slice(0, cut + 1), utility: cls.slice(cut + 1) };
}

type Size = { px: number } | { unreadable: string } | null;

/** The font size a class sets, `{ unreadable }` for a size form the lint cannot read, else null. */
function classSize(cls: string, rules: TypeRampRules): Size {
  const utility = splitVariants(cls).utility.replace(/^!|!$/g, '');
  if (!utility.startsWith('text-')) return null;
  const value = utility.slice('text-'.length);
  if (value.startsWith('[')) {
    const inner = value.slice(1, value.lastIndexOf(']'));
    const px = /^(\d+(?:\.\d+)?)px$/.exec(inner);
    if (px) return { px: Number(px[1]) };
    if (ARBITRARY_COLOUR.test(inner)) return null;
    return { unreadable: `an arbitrary size other than px (${inner})` };
  }
  if (value.startsWith('(')) {
    return /^\(length:/.test(value) ? { unreadable: 'a size from a CSS variable' } : null;
  }
  const name = value.replace(/\/.*$/, '');
  if (!TAILWIND_SIZE_NAME.test(name) && !rules.themeSizes.has(name)) return null;
  const px = FONT_SIZE_PX[name];
  return px === undefined ? { unreadable: `a size name FONT_SIZE_PX does not list` } : { px };
}

/** A class with where it sits and the string it shares with others. */
type Token = { cls: string; offset: number; group: number };

const STATIC = -1;

function splitTokens(text: string, offset: number, group: number, out: Token[]): void {
  for (const m of text.matchAll(/\S+/g))
    out.push({ cls: m[0], offset: offset + (m.index ?? 0), group });
}

function lineIndex(source: string): (offset: number) => number {
  const starts = [0];
  for (const m of source.matchAll(/\n/g)) starts.push((m.index ?? 0) + 1);
  return (offset) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= offset) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
}

/** The ramp, for the end of each finding's explanation. */
export function describeRamp(): string {
  const steps = RAMP.filter((s) => !s.display)
    .map((s) => `${s.name} ${s.classes.join('/')}`)
    .join(', ');
  const display = RAMP.find((s) => s.display);
  return `${steps}; with font-display: ${display?.classes.join(', ')}`;
}

/** What the check of one file reads, and what it found. */
type FileContext = {
  /** The parsed text: the source, wrapped for a .ts, .js or .css file. */
  text: string;
  rules: TypeRampRules;
  /** The SCOPED_SIZES classes of this file. */
  ownScoped: Set<string>;
  lineOf: (offset: number) => number;
  findings: TypeRampFinding[];
  scopedUses: Map<string, number>;
};

function report(ctx: FileContext, offset: number, message: string): void {
  ctx.findings.push({ line: ctx.lineOf(offset), message });
}

/** Why a readable size is off the ramp for its element, or null when it is on it. */
function offRampMessage(cls: string, px: number, display: boolean): string | null {
  if (display ? DISPLAY_PX.has(px) : RAMP_PX.has(px)) return null;
  return display
    ? `${cls} sets ${px}px on a font-display element, which is not a Display step.`
    : `${cls} sets ${px}px, which is not a step of the type ramp.`;
}

function checkToken(ctx: FileContext, t: Token, display: boolean): void {
  const size = classSize(t.cls, ctx.rules);
  if (size === null) return;
  if (ctx.ownScoped.has(t.cls)) {
    ctx.scopedUses.set(t.cls, (ctx.scopedUses.get(t.cls) ?? 0) + 1);
    return;
  }
  if ('unreadable' in size) {
    report(ctx, t.offset, `${t.cls} sets ${size.unreadable}, which this lint cannot read.`);
    return;
  }
  const message = offRampMessage(t.cls, size.px, display);
  if (message) report(ctx, t.offset, message);
}

/** Checks the classes of one string, attribute or `@apply`. */
function checkTokens(ctx: FileContext, tokens: Token[]): void {
  const displayGroups = new Set(tokens.filter((t) => t.cls === 'font-display').map((t) => t.group));
  const staticDisplay = displayGroups.has(STATIC);
  for (const t of tokens) checkToken(ctx, t, staticDisplay || displayGroups.has(t.group));
}

/** Every string and template literal under `node`, each its own group. */
function literalTokens(node: unknown, out: Token[]): void {
  if (Array.isArray(node)) {
    for (const child of node) literalTokens(child, out);
    return;
  }
  if (!isNode(node)) return;
  if (node.type === 'Literal' && typeof node.value === 'string') {
    splitTokens(String(node.raw ?? '').slice(1, -1), node.start + 1, node.start, out);
    return;
  }
  if (node.type === 'TemplateLiteral') {
    for (const quasi of node.quasis as Node[]) {
      splitTokens((quasi.value as { raw: string }).raw, quasi.start, node.start, out);
    }
    literalTokens(node.expressions, out);
    return;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key !== 'metadata' && key !== 'loc') literalTokens(value, out);
  }
}

/** The static text of an attribute's value and the literals in its expressions. */
function attributeTokens(value: unknown, out: Token[]): void {
  for (const part of Array.isArray(value) ? value : [value]) {
    if (!isNode(part)) continue;
    if (part.type === 'Text') splitTokens(String(part.raw), part.start, STATIC, out);
    else literalTokens(part, out);
  }
}

function scopeOf(scopes: Map<string, Token[]>, name: string): Token[] {
  const tokens = scopes.get(name) ?? [];
  scopes.set(name, tokens);
  return tokens;
}

/** The CSS properties that set a font size, in any case: `font-size` and the `font` shorthand. */
const SIZE_PROPERTY = /^font(?:-size)?$/i;
/** A `font-size` or `font` declaration in CSS text, after anything but a name character. */
const CSS_TEXT_SIZE = /(?:^|[^\w-])font(?:-size)?\s*:/i;

const CSS_TEXT_MESSAGE =
  'a string sets font-size or font as CSS text, which this lint cannot read; use a ramp class.';

function tokenText(tokens: Token[]): string {
  return tokens.map((t) => t.cls).join(' ');
}

/**
 * Checks each literal of `tokens` (one group each) for its classes and for
 * CSS text that sets a size: `cssText = 'font-size: …'`, a spread's
 * `style: 'font: …'`, or `setProperty('font-size', …)`'s bare name.
 */
function checkLiteralGroups(ctx: FileContext, tokens: Token[]): void {
  for (const group of new Set(tokens.map((t) => t.group))) {
    const own = tokens.filter((t) => t.group === group);
    checkTokens(ctx, own);
    const text = tokenText(own);
    if (CSS_TEXT_SIZE.test(text) || /^font-size$/i.test(text)) report(ctx, group, CSS_TEXT_MESSAGE);
  }
}

/** Adds an attribute's classes to its scope, or checks one that has no scope. */
function readAttribute(ctx: FileContext, attr: Node, scopes: Map<string, Token[]>): void {
  const name = String(attr.name);
  if (attr.type === 'StyleDirective' && SIZE_PROPERTY.test(name)) {
    report(ctx, attr.start, `style:${name} sets a size this lint cannot read; use a ramp class.`);
    return;
  }
  if (attr.type === 'ClassDirective') {
    const offset = attr.start + 'class:'.length;
    scopeOf(scopes, 'class').push({ cls: name, offset, group: offset });
    return;
  }
  if (attr.type !== 'Attribute') {
    // Spreads, bindings, actions, transitions: each literal on its own.
    const tokens: Token[] = [];
    literalTokens(attr, tokens);
    checkLiteralGroups(ctx, tokens);
    return;
  }
  const own: Token[] = [];
  attributeTokens(attr.value, own);
  scopeOf(scopes, name).push(...own);
  if (CSS_TEXT_SIZE.test(tokenText(own))) {
    report(
      ctx,
      attr.start,
      `a ${name} attribute sets font-size or font, which this lint cannot read; use a ramp class.`
    );
  }
}

/** One element's attributes: each attribute is one scope for `font-display`. */
function checkAttributes(ctx: FileContext, attributes: Node[]): void {
  const scopes = new Map<string, Token[]>();
  for (const attr of attributes) readAttribute(ctx, attr, scopes);
  for (const tokens of scopes.values()) checkTokens(ctx, tokens);
}

/** Where a CSS node sits: inside `@media print`, inside `@theme`. */
type CssState = { printOnly: boolean; inTheme: boolean };

function blockChildren(n: Node): unknown[] {
  return (n.block as { children?: unknown[] } | null | undefined)?.children ?? [];
}

/** `@media print` or `@media only print`, but not `@media print, screen`. */
function isPrintOnly(prelude: string): boolean {
  return /^(?:only\s+)?print\b/.test(prelude.trim()) && !prelude.includes(',');
}

function checkAtrule(ctx: FileContext, n: Node, state: CssState): void {
  const prelude = String(n.prelude);
  if (n.name === 'apply') {
    const tokens: Token[] = [];
    splitTokens(prelude, ctx.text.indexOf(prelude, n.start), n.start, tokens);
    checkTokens(ctx, tokens);
  }
  checkCss(ctx, blockChildren(n), {
    printOnly: state.printOnly || (n.name === 'media' && isPrintOnly(prelude)),
    inTheme: state.inTheme || n.name === 'theme'
  });
}

function checkCss(ctx: FileContext, nodes: unknown[], state: CssState): void {
  for (const n of nodes) {
    if (!isNode(n)) continue;
    if (n.type === 'Atrule') checkAtrule(ctx, n, state);
    else if (n.type === 'Rule') checkCss(ctx, blockChildren(n), state);
    else if (n.type === 'Declaration') checkDeclaration(ctx, n, state);
  }
}

/** A `@theme` `--text-<name>` must set the px FONT_SIZE_PX gives `name`. */
function checkThemeSize(ctx: FileContext, n: Node, name: string): void {
  const value = String(n.value);
  const px = cssPx(value);
  if (px !== undefined && px === FONT_SIZE_PX[name]) return;
  report(
    ctx,
    n.start,
    `${String(n.property)}: ${value} does not match FONT_SIZE_PX['${name}'] (${FONT_SIZE_PX[name] ?? 'missing'}px) in scripts/type-ramp.ts.`
  );
}

function checkFontSize(ctx: FileContext, n: Node): void {
  const value = String(n.value);
  const px = cssPx(value);
  if (px === undefined) {
    report(ctx, n.start, `font-size: ${value} is a form this lint cannot read; use px or rem.`);
  } else if (!RAMP_PX.has(px)) {
    report(ctx, n.start, `font-size: ${value} sets ${px}px, which is not a step of the type ramp.`);
  }
}

function checkDeclaration(ctx: FileContext, n: Node, state: CssState): void {
  const property = String(n.property);
  const theme = /^--text-([\w-]+)$/.exec(property)?.[1];
  if (state.inTheme && theme && !theme.includes('--')) {
    checkThemeSize(ctx, n, theme);
  } else if (state.printOnly || !SIZE_PROPERTY.test(property)) {
    return;
  } else if (property.toLowerCase() === 'font') {
    report(
      ctx,
      n.start,
      `font: ${String(n.value)} is a shorthand this lint cannot read; set font-size on its own.`
    );
  } else {
    checkFontSize(ctx, n);
  }
}

/** A string or template literal outside an attribute: each literal is its own group. */
function checkLiterals(ctx: FileContext, node: Node): void {
  const tokens: Token[] = [];
  literalTokens(node, tokens);
  checkLiteralGroups(ctx, tokens);
}

/** `fontSize` anywhere, attributes included: `el.style.fontSize = …`, or a style object's key. */
function checkNames(ctx: FileContext, node: unknown, seen: Set<unknown>): void {
  if (Array.isArray(node)) {
    for (const child of node) checkNames(ctx, child, seen);
    return;
  }
  if (!isNode(node) || seen.has(node)) return;
  seen.add(node);
  if (node.type === 'Identifier' && node.name === 'fontSize') {
    report(ctx, node.start, 'fontSize sets a size this lint cannot read; use a ramp class.');
  }
  for (const [key, value] of Object.entries(node)) {
    if (key !== 'metadata' && key !== 'loc') checkNames(ctx, value, seen);
  }
}

function visit(ctx: FileContext, node: unknown, seen: Set<unknown>): void {
  if (Array.isArray(node)) {
    for (const child of node) visit(ctx, child, seen);
    return;
  }
  if (!isNode(node) || seen.has(node)) return;
  seen.add(node);
  if (node.type === 'StyleSheet') {
    checkCss(ctx, node.children as unknown[], { printOnly: false, inTheme: false });
  } else if (node.type === 'Literal' || node.type === 'TemplateLiteral') {
    checkLiterals(ctx, node);
  } else {
    for (const [key, value] of Object.entries(node)) visitField(ctx, key, value, seen);
  }
}

function visitField(ctx: FileContext, key: string, value: unknown, seen: Set<unknown>): void {
  if (key === 'attributes' && Array.isArray(value)) checkAttributes(ctx, value as Node[]);
  else if (key !== 'metadata' && key !== 'loc') visit(ctx, value, seen);
}

/**
 * The text the parser reads: a .ts/.js file as the body of a script tag, a
 * .css file as the body of a style tag. Neither wrapper adds a newline, so
 * line numbers stay true.
 */
function parsedText(file: string, source: string): string {
  if (file.endsWith('.svelte')) return source;
  if (file.endsWith('.css')) return `<style>${source}</style>`;
  return `<script lang="ts">${source}</script>`;
}

/**
 * Checks one file's source. `file` is its repo-relative path, which picks
 * the parser (by extension) and its SCOPED_SIZES entries. Throws when the
 * parser rejects the file.
 */
export function checkSource(
  file: string,
  source: string,
  rules: TypeRampRules,
  scoped: readonly ScopedSize[] = SCOPED_SIZES
): FileReport {
  const text = parsedText(file, source);
  const ctx: FileContext = {
    text,
    rules,
    ownScoped: new Set(scoped.filter((s) => s.file === file).map((s) => s.cls)),
    lineOf: lineIndex(text),
    findings: [],
    scopedUses: new Map()
  };
  const ast = parse(text, { modern: true });
  visit(ctx, ast, new Set());
  checkNames(ctx, ast, new Set());
  ctx.findings.sort((a, b) => a.line - b.line);
  return { findings: ctx.findings, scopedUses: ctx.scopedUses };
}

/** A SCOPED_SIZES entry whose file no longer writes its class `count` times. */
export function staleScopedSizes(
  uses: Map<string, Map<string, number>>,
  scoped: readonly ScopedSize[] = SCOPED_SIZES
): string[] {
  return scoped
    .filter((s) => (uses.get(s.file)?.get(s.cls) ?? 0) !== s.count)
    .map(
      (s) =>
        `${s.file}: SCOPED_SIZES expects ${s.count} use(s) of ${s.cls} (${s.step}: ${s.reason}), found ${uses.get(s.file)?.get(s.cls) ?? 0}. Update scripts/type-ramp.ts and DESIGN.md together.`
    );
}

/** The files the lint reads under `src`: no tests, no generated paraglide. */
export function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'paraglide' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!(entry.name === 'test' && path.basename(dir) === 'src')) sourceFiles(full, out);
    } else if (
      entry.isFile() &&
      /\.(svelte|ts|js|css)$/.test(entry.name) &&
      !/\.(test|spec)\.ts$/.test(entry.name)
    ) {
      out.push(full);
    }
  }
  return out;
}

/** Every problem in the project at `root`, one line each. */
export function lintProject(root: string, scoped: readonly ScopedSize[] = SCOPED_SIZES): string[] {
  const problems: string[] = [];
  let rules: TypeRampRules = { themeSizes: new Map() };
  try {
    rules = rulesFromCss(fs.readFileSync(path.join(root, 'src/app.css'), 'utf8'));
  } catch (error) {
    problems.push(`src/app.css: could not read its @theme sizes: ${(error as Error).message}`);
  }
  const uses = new Map<string, Map<string, number>>();
  for (const full of sourceFiles(path.join(root, 'src')).sort()) {
    const file = path.relative(root, full).split(path.sep).join('/');
    try {
      const report = checkSource(file, fs.readFileSync(full, 'utf8'), rules, scoped);
      for (const f of report.findings) problems.push(`${file}:${f.line}: ${f.message}`);
      uses.set(file, report.scopedUses);
    } catch (error) {
      problems.push(`${file}: could not parse: ${(error as Error).message.split('\n')[0]}`);
    }
  }
  problems.push(...staleScopedSizes(uses, scoped));
  return problems;
}

if (import.meta.main) {
  const problems = lintProject(process.cwd());
  if (problems.length > 0) {
    console.error(`Found ${problems.length} font size(s) off the type ramp:`);
    for (const p of problems) console.error(`  ${p}`);
    console.error(
      `\nThe ramp (DESIGN.md, Typography > Hierarchy): ${describeRamp()}.\n` +
        'Move the size to the nearest step. A size that DESIGN.md or its component names\n' +
        'a role for goes in SCOPED_SIZES (scripts/type-ramp.ts) and in DESIGN.md together.'
    );
    process.exit(1);
  }
  console.log('type ramp OK');
}

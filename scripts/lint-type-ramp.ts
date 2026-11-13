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
 * - CSS `font-size` declarations in px or rem, outside `@media print` (the
 *   print stylesheet is a documented deviation in DESIGN.md).
 * - `@theme` `--text-*` declarations, which must match FONT_SIZE_PX.
 *
 * `font-display` counts in the same string literal as the size, or in the
 * static text of the same attribute. A size the lint cannot read (`text-[1rem]`,
 * `text-(length:--x)`, `font-size: 1em`, the `font` shorthand, a `font-size` in
 * a `style` attribute or directive) fails by name, so a new form cannot slip
 * past it. There is no inline escape: a kept off-ramp size is a SCOPED_SIZES
 * entry, named in DESIGN.md.
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
  const findings: TypeRampFinding[] = [];
  const scopedUses = new Map<string, number>();
  const ownScoped = new Set(scoped.filter((s) => s.file === file).map((s) => s.cls));

  // A .ts/.js file parses as the body of a script tag and a .css file as the
  // body of a style tag: the wrapper adds no newline, so lines stay true.
  const prefix = file.endsWith('.svelte')
    ? ''
    : file.endsWith('.css')
      ? '<style>'
      : '<script lang="ts">';
  const suffix = file.endsWith('.svelte') ? '' : file.endsWith('.css') ? '</style>' : '</script>';
  const text = prefix + source + suffix;
  const lineOf = lineIndex(text);
  const ast = parse(text, { modern: true });

  function report(offset: number, message: string): void {
    findings.push({ line: lineOf(offset), message });
  }

  /** Checks the classes of one string, attribute or `@apply`. */
  function checkTokens(tokens: Token[]): void {
    const displayGroups = new Set(
      tokens.filter((t) => t.cls === 'font-display').map((t) => t.group)
    );
    for (const t of tokens) {
      const size = classSize(t.cls, rules);
      if (size === null) continue;
      if (ownScoped.has(t.cls)) {
        scopedUses.set(t.cls, (scopedUses.get(t.cls) ?? 0) + 1);
        continue;
      }
      if ('unreadable' in size) {
        report(t.offset, `${t.cls} sets ${size.unreadable}, which this lint cannot read.`);
        continue;
      }
      const display = displayGroups.has(t.group) || displayGroups.has(STATIC);
      if (display ? DISPLAY_PX.has(size.px) : RAMP_PX.has(size.px)) continue;
      report(
        t.offset,
        display
          ? `${t.cls} sets ${size.px}px on a font-display element, which is not a Display step.`
          : `${t.cls} sets ${size.px}px, which is not a step of the type ramp.`
      );
    }
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

  /** One element's attributes: each attribute is one scope for `font-display`. */
  function checkAttributes(attributes: Node[]): void {
    const scopes = new Map<string, Token[]>();
    const scope = (name: string) => scopes.get(name) ?? scopes.set(name, []).get(name)!;
    for (const attr of attributes) {
      const name = String(attr.name);
      if (attr.type === 'StyleDirective' && name === 'font-size') {
        report(attr.start, 'style:font-size sets a size this lint cannot read; use a ramp class.');
      } else if (attr.type === 'ClassDirective') {
        const offset = attr.start + 'class:'.length;
        scope('class').push({ cls: name, offset, group: offset });
      } else if (attr.type === 'Attribute') {
        const tokens = scope(name);
        for (const part of Array.isArray(attr.value) ? attr.value : [attr.value]) {
          if (!isNode(part)) continue;
          if (part.type === 'Text') splitTokens(String(part.raw), part.start, STATIC, tokens);
          else literalTokens(part, tokens);
        }
        if (name === 'style' && tokens.some((t) => /font-size/.test(t.cls))) {
          report(
            attr.start,
            'a style attribute sets font-size, which this lint cannot read; use a ramp class.'
          );
        }
      } else {
        // Spreads, bindings, actions, transitions: only their literals.
        const tokens: Token[] = [];
        literalTokens(attr, tokens);
        for (const t of tokens) checkTokens([t]);
      }
    }
    for (const tokens of scopes.values()) checkTokens(tokens);
  }

  function checkCss(nodes: unknown[], printOnly: boolean, inTheme: boolean): void {
    for (const n of nodes) {
      if (!isNode(n)) continue;
      const block = n.block as { children: unknown[] } | null | undefined;
      if (n.type === 'Atrule') {
        const prelude = String(n.prelude);
        if (n.name === 'apply') {
          const tokens: Token[] = [];
          splitTokens(prelude, text.indexOf(prelude, n.start), n.start, tokens);
          checkTokens(tokens);
        }
        const print =
          n.name === 'media' && /^print\b/.test(prelude.trim()) && !prelude.includes(',');
        if (block) checkCss(block.children, printOnly || print, inTheme || n.name === 'theme');
      } else if (n.type === 'Rule' && block) {
        checkCss(block.children, printOnly, inTheme);
      } else if (n.type === 'Declaration') {
        checkDeclaration(n, printOnly, inTheme);
      }
    }
  }

  function checkDeclaration(n: Node, printOnly: boolean, inTheme: boolean): void {
    const property = String(n.property);
    const value = String(n.value);
    const theme = /^--text-([\w-]+)$/.exec(property)?.[1];
    if (inTheme && theme && !theme.includes('--')) {
      const px = cssPx(value);
      if (px === undefined || px !== FONT_SIZE_PX[theme]) {
        report(
          n.start,
          `${property}: ${value} does not match FONT_SIZE_PX['${theme}'] (${FONT_SIZE_PX[theme] ?? 'missing'}px) in scripts/type-ramp.ts.`
        );
      }
      return;
    }
    if (printOnly) return;
    if (property === 'font') {
      report(
        n.start,
        `font: ${value} is a shorthand this lint cannot read; set font-size on its own.`
      );
    } else if (property === 'font-size') {
      const px = cssPx(value);
      if (px === undefined) {
        report(n.start, `font-size: ${value} is a form this lint cannot read; use px or rem.`);
      } else if (!RAMP_PX.has(px)) {
        report(n.start, `font-size: ${value} sets ${px}px, which is not a step of the type ramp.`);
      }
    }
  }

  const seen = new Set<unknown>();
  function visit(node: unknown): void {
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (!isNode(node) || seen.has(node)) return;
    seen.add(node);
    if (node.type === 'StyleSheet') {
      checkCss(node.children as unknown[], false, false);
      return;
    }
    if (node.type === 'Literal' || node.type === 'TemplateLiteral') {
      const tokens: Token[] = [];
      literalTokens(node, tokens);
      for (const group of new Set(tokens.map((t) => t.group))) {
        checkTokens(tokens.filter((t) => t.group === group));
      }
      return;
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'metadata' || key === 'loc') continue;
      if (key === 'attributes' && Array.isArray(value)) checkAttributes(value as Node[]);
      else visit(value);
    }
  }
  visit(ast);

  findings.sort((a, b) => a.line - b.line);
  return { findings, scopedUses };
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

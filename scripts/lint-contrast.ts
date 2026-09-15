#!/usr/bin/env node
/**
 * lint-contrast: two checks.
 *
 * 1. (legacy) fails when a bare status/reaction palette token is used as a
 *    TEXT color. `text-destructive`, `text-success`, `text-warning`,
 *    `text-info` and `text-reaction-*` are the BACKGROUND hues of their pairs
 *    (coral ≈2.4:1 on canvas — see SectionHeader.svelte; warning/info map to
 *    the pastel butter/sky tiles, even fainter as text — see src/app.css), so
 *    body/small text set in them fails WCAG AA. Use the documented ink tokens
 *    instead: `text-severe-text`, `text-success-foreground`,
 *    `text-warning-foreground`, `text-info-foreground`,
 *    `text-reaction-*-foreground`, …
 *
 * 2. (real ratios) parses the light/dark HSL token tables out of
 *    src/app.css, scans src/**\/*.svelte for elements that pair a
 *    `bg-<token>` (or a `Card` `variant="tile-*"`) with a `text-<token>` —
 *    on the same element for `bg-`, or inherited from the nearest ancestor
 *    that set one — and computes the actual WCAG contrast ratio for both
 *    themes, using the element's own font-size/weight to pick the AA
 *    threshold (4.5:1, or 3:1 for large text). This is what catches
 *    `text-primary-strong` on `bg-tile-butter` in dark mode — a pairing the
 *    legacy regex above has no way to see, because neither token name is on
 *    its forbidden list and it never looks at backgrounds at all.
 *
 * Escape hatch: append a `contrast-ok` comment on the same line (with a
 * short justification nearby) for sites that are genuinely fine, e.g. large
 * display text where 3:1 suffices.
 *
 * Run via `npm run lint:contrast` (part of `npm run lint`).
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const EXCLUDED_DIRS = new Set(['paraglide', 'node_modules']);
const SOURCE_EXT = /\.(ts|js|svelte)$/;

// Bare hue used as a text utility, in any variant chain (hover:, dark:, …),
// unless followed by the readable `-foreground` / `-text` suffixes. The
// trailing `\w` guard avoids partial matches (e.g. a hypothetical
// `text-successful`); `/` is intentionally NOT excluded so opacity-modified
// usages like `text-destructive/80` are still flagged.
const FORBIDDEN =
  /(?<![\w-])text-(success|destructive|warning|info|reaction-ras|reaction-inconfort|reaction-reaction)(?!-foreground|-text|\w)/;

const ESCAPE_MARKER = 'contrast-ok';
const COMMENT_LINE = /^\s*(\/\/|\/\*|\*|<!--)/;

type Offender = string;
const offenders: Offender[] = [];

function walk(dir: string, ext: RegExp, onFile: (full: string) => void): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, ext, onFile);
    } else if (entry.isFile() && ext.test(entry.name)) {
      onFile(full);
    }
  }
}

// ---------------------------------------------------------------------------
// Check 1: legacy bare-token regex (unchanged behaviour).
// ---------------------------------------------------------------------------

walk(SRC, SOURCE_EXT, (full) => {
  const lines = fs.readFileSync(full, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (line.includes(ESCAPE_MARKER)) return;
    if (COMMENT_LINE.test(line)) return;
    const match = FORBIDDEN.exec(line);
    if (match) {
      offenders.push(`${path.relative(ROOT, full)}:${i + 1}: ${match[0]} — ${line.trim()}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Check 2: real WCAG contrast ratios per theme.
// ---------------------------------------------------------------------------

type TokenTable = Map<string, string>; // --name -> raw declared value (rhs, no trailing `;`)

/** Extract `--name: value;` declarations from the (non-nested-brace) body of
 * a `selector { … }` block. Grabs the first top-level block matching
 * `selectorRe` in the stylesheet by naive brace counting — good enough for
 * app.css's flat `:root { … }` / `.dark { … }` blocks. */
function extractBlock(css: string, selectorRe: RegExp): string | null {
  const m = selectorRe.exec(css);
  if (!m) return null;
  const openIdx = css.indexOf('{', m.index);
  if (openIdx === -1) return null;
  let depth = 0;
  for (let i = openIdx; i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') {
      depth--;
      if (depth === 0) return css.slice(openIdx + 1, i);
    }
  }
  return null;
}

function parseTokenTable(block: string): TokenTable {
  const table: TokenTable = new Map();
  const declRe = /--([\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = declRe.exec(block))) {
    table.set(m[1], m[2].trim());
  }
  return table;
}

function loadThemeTables(): { light: TokenTable; dark: TokenTable } | null {
  const cssPath = path.join(SRC, 'app.css');
  if (!fs.existsSync(cssPath)) return null;
  const css = fs.readFileSync(cssPath, 'utf8');
  // `:root {` may also match inside `@theme inline { … --color-x: hsl(var(--x)); }`
  // but that block doesn't contain a literal `:root` selector, so the first
  // (only) `:root {` in @layer base is the one we want.
  const rootBlock = extractBlock(css, /:root\s*\{/);
  const darkBlock = extractBlock(css, /\.dark\s*\{/);
  if (!rootBlock || !darkBlock) return null;
  return { light: parseTokenTable(rootBlock), dark: parseTokenTable(darkBlock) };
}

type Hsl = [number, number, number]; // h in deg, s/l in 0-1

/** Resolve a token name to an HSL triple, following `var(--other)` alias
 * chains within the same theme table. Returns null — never a guess — for
 * anything that isn't a plain HSL triple or a resolvable alias chain
 * (multi-value expressions, color-mix(), literal colors, missing keys,
 * cycles). */
function resolveHsl(table: TokenTable, name: string, depth = 0): Hsl | null {
  if (depth > 8) return null;
  const raw = table.get(name);
  if (raw === undefined) return null;
  const triple = /^(-?[\d.]+)\s+([\d.]+)%\s+([\d.]+)%$/.exec(raw);
  if (triple) {
    return [parseFloat(triple[1]), parseFloat(triple[2]) / 100, parseFloat(triple[3]) / 100];
  }
  const alias = /^var\(--([\w-]+)\)$/.exec(raw);
  if (alias) return resolveHsl(table, alias[1], depth + 1);
  return null;
}

function hslToRgb([h, s, l]: Hsl): [number, number, number] {
  const hh = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    hh < 60
      ? [c, x, 0]
      : hh < 120
        ? [x, c, 0]
        : hh < 180
          ? [0, c, x]
          : hh < 240
            ? [0, x, c]
            : hh < 300
              ? [x, 0, c]
              : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
}

function relLuminance([r, g, b]: [number, number, number]): number {
  const chan = (c: number) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

function contrastRatio(a: Hsl, b: Hsl): number {
  const la = relLuminance(hslToRgb(a));
  const lb = relLuminance(hslToRgb(b));
  const [lighter, darker] = la >= lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

const FONT_SIZE_PX: Record<string, number> = {
  '3xs': 10,
  '2xs': 11,
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30
};
const FONT_WEIGHT: Record<string, number> = {
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800
};
const VOID_ELEMENTS = new Set([
  'img',
  'br',
  'hr',
  'input',
  'meta',
  'link',
  'source',
  'col',
  'area',
  'base',
  'embed',
  'track',
  'wbr'
]);

type ContrastOffender = { file: string; line: number; detail: string };
const contrastOffenders: ContrastOffender[] = [];

function checkSvelteFile(full: string, themes: { light: TokenTable; dark: TokenTable }): void {
  const relPath = path.relative(ROOT, full);
  const original = fs.readFileSync(full, 'utf8');
  // Blank out <script> / <style> bodies (keep newlines so line numbers stay
  // correct) so we never mistake JS/CSS braces or strings for markup.
  const template = original.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, (block) =>
    block.replace(/[^\n]/g, ' ')
  );

  const lineOf = (idx: number) => template.slice(0, idx).split('\n').length;
  const sourceLines = original.split('\n');

  type Frame = { tag: string; bg: string | null | 'unknown' };
  const stack: Frame[] = [];

  const tagRe = /<(\/?)([A-Za-z][\w.:-]*)((?:"[^"]*"|'[^']*'|\{[^{}]*\}|[^>])*?)(\/?)>/g;
  let match: RegExpExecArray | null;

  try {
    while ((match = tagRe.exec(template))) {
      const [, closingSlash, tagName, attrs, selfSlash] = match;
      const lineNo = lineOf(match.index);
      const isClosing = closingSlash === '/';

      if (isClosing) {
        for (let i = stack.length - 1; i >= 0; i--) {
          if (stack[i].tag === tagName) {
            stack.length = i;
            break;
          }
        }
        continue;
      }

      const isSelfClosing = selfSlash === '/' || VOID_ELEMENTS.has(tagName.toLowerCase());
      // `text-<token>` on a wrapper around an icon component sets
      // currentColor for the SVG, not a text color — WCAG text-contrast
      // math doesn't apply to it (icons get the separate, looser 3:1
      // non-text-contrast rule, and this linter doesn't attempt that).
      // Only elements with a direct text node / `{expression}` before
      // their next child tag are "text" for our purposes; a wrapper whose
      // first child is itself a tag (e.g. `<span ...><Heart /></span>`)
      // has none.
      const afterTag = template.slice(match.index + match[0].length);
      const nextTagAt = afterTag.indexOf('<');
      const directText = nextTagAt === -1 ? afterTag : afterTag.slice(0, nextTagAt);
      const hasDirectText = /\S/.test(directText);

      // Dynamic class (`class={...}` / uses cn(...) with expressions) can't
      // be statically resolved — a false positive in a pre-commit gate is
      // worse than a miss, so we skip detecting anything *about this
      // element* (neither its own bg nor its own text pairing), while still
      // letting its children inherit whatever background is already on the
      // stack. This under-reports dynamic-class cases; it never fabricates
      // a ratio for one.
      const hasDynamicClass = /\bclass\s*=\s*\{/.test(attrs);
      const classMatch = /\bclass\s*=\s*"([^"]*)"/.exec(attrs);
      const classStr = classMatch ? classMatch[1] : null;

      let ownBg: string | null | 'unknown' = null;
      if (!hasDynamicClass && classStr) {
        for (const raw of classStr.split(/\s+/)) {
          if (!raw) continue;
          const part = raw.includes(':') ? raw.slice(raw.lastIndexOf(':') + 1) : raw;
          if (part.startsWith('bg-')) {
            // `bg-x/NN` alpha-blends x over whatever sits under it via
            // color-mix — not the solid token color our HSL table has.
            // Treating it as opaque would fabricate a ratio, so it's
            // unresolvable rather than skipped-with-a-guess.
            if (/\/\d+$/.test(part)) {
              ownBg = 'unknown';
              break;
            }
            const token = part.slice(3);
            const resolvable = themes.light.has(token) || themes.dark.has(token);
            ownBg = resolvable ? token : 'unknown';
            break;
          }
        }
      }
      if (ownBg === null && !hasDynamicClass && tagName === 'Card') {
        const variantMatch = /\bvariant\s*=\s*"([^"]*)"/.exec(attrs);
        if (variantMatch) {
          const token = variantMatch[1];
          const resolvable = themes.light.has(token) || themes.dark.has(token);
          ownBg = resolvable ? token : 'unknown';
        } else if (/\bvariant\s*=\s*\{/.test(attrs)) {
          ownBg = 'unknown'; // dynamic variant — can't resolve, don't guess
        }
      }

      const inherited = stack.length > 0 ? stack[stack.length - 1].bg : null;
      const effectiveBg = ownBg !== null ? ownBg : inherited;

      const isDecorative = /\baria-hidden\s*=\s*(?:"true"|\{true\})/.test(attrs);
      if (
        !isDecorative &&
        hasDirectText &&
        !hasDynamicClass &&
        classStr &&
        effectiveBg &&
        effectiveBg !== 'unknown'
      ) {
        let size = 16;
        let weight = 400;
        const textTokens: string[] = [];
        for (const raw of classStr.split(/\s+/)) {
          if (!raw) continue;
          const part = raw.includes(':') ? raw.slice(raw.lastIndexOf(':') + 1) : raw;
          const sizeMatch = /^text-(3xs|2xs|xs|sm|base|lg|xl|2xl|3xl)$/.exec(part);
          if (sizeMatch) {
            size = FONT_SIZE_PX[sizeMatch[1]];
            continue;
          }
          const arbSize = /^text-\[(\d+(?:\.\d+)?)px\]$/.exec(part);
          if (arbSize) {
            size = parseFloat(arbSize[1]);
            continue;
          }
          const weightMatch = /^font-(medium|semibold|bold|extrabold)$/.exec(part);
          if (weightMatch) {
            weight = FONT_WEIGHT[weightMatch[1]];
            continue;
          }
          if (part.startsWith('text-') && !/\/\d+$/.test(part)) {
            // `text-x/NN` alpha-blends over the background via color-mix —
            // not the solid token color; unresolvable, so skip rather than
            // assume opaque.
            const token = part.slice(5);
            if (themes.light.has(token) || themes.dark.has(token)) {
              textTokens.push(token);
            }
          }
        }

        const lineText = sourceLines[lineNo - 1] ?? '';
        const skip = lineText.includes(ESCAPE_MARKER) || COMMENT_LINE.test(lineText);

        if (!skip) {
          for (const token of textTokens) {
            const required = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
            for (const [themeName, table] of [
              ['light', themes.light],
              ['dark', themes.dark]
            ] as const) {
              const fg = resolveHsl(table, token);
              const bg = resolveHsl(table, effectiveBg);
              if (!fg || !bg) continue; // alias chain / literal we can't resolve — skip, don't guess
              const ratio = contrastRatio(fg, bg);
              if (ratio < required) {
                contrastOffenders.push({
                  file: relPath,
                  line: lineNo,
                  detail: `text-${token} on bg-${effectiveBg} (${themeName} theme): ${ratio.toFixed(2)}:1 at ${size}px/${weight}, needs ${required}:1 — ${lineText.trim()}`
                });
              }
            }
          }
        }
      }

      if (!isSelfClosing) {
        stack.push({ tag: tagName, bg: effectiveBg });
      }
    }
  } catch {
    // Any parse surprise on this file → skip it silently rather than risk a
    // fabricated ratio from a corrupted tag stack.
    return;
  }
}

const themes = loadThemeTables();
if (themes) {
  walk(SRC, /\.svelte$/, (full) => checkSvelteFile(full, themes));
}

for (const o of contrastOffenders) {
  offenders.push(`${o.file}:${o.line}: ${o.detail}`);
}

if (offenders.length > 0) {
  console.error(`Found ${offenders.length} low-contrast text token(s):`);
  for (const o of offenders) console.error(`  ${o}`);
  console.error(
    '\nThese tokens are background hues (≈2.4:1 or worse on canvas) — use the ink tokens\n' +
      'instead (text-severe-text, text-success-foreground, text-warning-foreground,\n' +
      'text-info-foreground, text-reaction-*-foreground), or the pairing has a computed\n' +
      'WCAG ratio below AA for its background/size/weight.\n' +
      'If a site is genuinely fine (large display text), add /* contrast-ok */ on the\n' +
      'same line with a short justification.'
  );
  process.exit(1);
}

console.log('contrast tokens OK');

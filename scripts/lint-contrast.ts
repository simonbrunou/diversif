#!/usr/bin/env node
/**
 * lint-contrast: fails when a bare status/reaction palette token is used as a
 * TEXT color. `text-destructive`, `text-success`, `text-warning`, `text-info`
 * and `text-reaction-*` are the BACKGROUND hues of their pairs (coral ≈2.4:1
 * on canvas — see SectionHeader.svelte; warning/info map to the pastel
 * butter/sky tiles, even fainter as text — see src/app.css), so body/small
 * text set in them fails WCAG AA. Use the documented ink tokens instead:
 * `text-severe-text`, `text-success-foreground`, `text-warning-foreground`,
 * `text-info-foreground`, `text-reaction-*-foreground`, …
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

const offenders: string[] = [];

function walk(dir: string): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile() && SOURCE_EXT.test(entry.name)) {
      const lines = fs.readFileSync(full, 'utf8').split('\n');
      lines.forEach((line, i) => {
        if (line.includes(ESCAPE_MARKER)) return;
        if (COMMENT_LINE.test(line)) return;
        const match = FORBIDDEN.exec(line);
        if (match) {
          offenders.push(`${path.relative(ROOT, full)}:${i + 1}: ${match[0]} — ${line.trim()}`);
        }
      });
    }
  }
}

walk(SRC);

if (offenders.length > 0) {
  console.error(`Found ${offenders.length} low-contrast text token(s):`);
  for (const o of offenders) console.error(`  ${o}`);
  console.error(
    '\nThese tokens are background hues (≈2.4:1 or worse on canvas) — use the ink tokens\n' +
      'instead (text-severe-text, text-success-foreground, text-warning-foreground,\n' +
      'text-info-foreground, text-reaction-*-foreground).\n' +
      'If a site is genuinely fine (large display text), add /* contrast-ok */ on the\n' +
      'same line with a short justification.'
  );
  process.exit(1);
}

console.log('contrast tokens OK');

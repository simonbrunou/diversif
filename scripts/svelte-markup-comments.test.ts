// No `//` comment inside a Svelte start tag holds a ' or a " (#463). Fallow
// 3.41 reads an unpaired one there as the start of a string: it then misses
// every prop the template uses after that comment and reports those props as
// unused, a warning that leaves the audit green. The suppressions DESIGN.md
// asks for (Layout, "Arbitrary values") sit in exactly such comments. A
// comment inside a `{...}` expression is JavaScript to Fallow and may hold
// either; so may a <script> or <style> block and an <!-- --> comment.
//
// A start-tag comment here is a markup line that starts with `//` outside
// every `{...}`. A `/*` line there is a form this test does not read, so it
// fails by name.
import { describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dir, '..');

/** Blanks each match, keeping its newlines so line numbers hold. */
function blank(source: string, pattern: RegExp): string {
  return source.replace(pattern, (block) => block.replace(/[^\n]/g, ' '));
}

function startTagCommentProblems(source: string): string[] {
  const markup = [/<script\b[\s\S]*?<\/script>/g, /<style\b[\s\S]*?<\/style>/g, /<!--[\s\S]*?-->/g]
    .reduce(blank, source)
    .split('\n');
  const out: string[] = [];
  let depth = 0;
  markup.forEach((line, i) => {
    const text = line.trimStart();
    if (depth === 0 && text.startsWith('/*'))
      out.push(`line ${i + 1}: a /* */ comment in a start tag, a form this test does not read`);
    else if (depth === 0 && text.startsWith('//') && /['"]/.test(text))
      out.push(`line ${i + 1}: a ' or " in a // comment in a start tag`);
    // A comment line is not counted: a brace in its text opens nothing.
    if (!text.startsWith('//'))
      for (const c of line) depth = Math.max(0, depth + (c === '{' ? 1 : c === '}' ? -1 : 0));
  });
  return out;
}

function svelteFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) return svelteFiles(rel);
    return entry.name.endsWith('.svelte') ? [rel] : [];
  });
}

const tag = (comment: string) => `<div\n  ${comment}\n  class="x"\n></div>`;

describe('startTagCommentProblems', () => {
  it('passes a start-tag comment without a quote', () => {
    expect(
      startTagCommentProblems(tag('// fallow-ignore-next-line x -- the `rail` width'))
    ).toEqual([]);
  });

  it("fails a ' in a start-tag comment", () => {
    expect(startTagCommentProblems(tag("// -- the device's inset"))).toEqual([
      `line 2: a ' or " in a // comment in a start tag`
    ]);
  });

  it('fails a " in a start-tag comment', () => {
    expect(startTagCommentProblems(tag('// -- a 12" sheet'))).toEqual([
      `line 2: a ' or " in a // comment in a start tag`
    ]);
  });

  it('fails a /* */ comment in a start tag by name', () => {
    expect(startTagCommentProblems(tag('/* the rail width */'))).toEqual([
      'line 2: a /* */ comment in a start tag, a form this test does not read'
    ]);
  });

  it('passes quotes in a comment inside a {...} expression, and finds the tag after it', () => {
    const src = [
      '<p',
      '  class={cn(',
      "    // the card's width",
      '    /* a block */',
      "    'x'",
      '  )}',
      '></p>',
      tag("// -- the device's inset")
    ].join('\n');
    expect(startTagCommentProblems(src)).toEqual([
      `line 9: a ' or " in a // comment in a start tag`
    ]);
  });

  it('skips script, style and HTML comments', () => {
    const src = [
      '<script lang="ts">',
      "  // the banner's retry",
      '</script>',
      "<!-- the parent's note",
      "  // still the parent's note -->",
      '<style>',
      "  /* the theme's radius */",
      '</style>'
    ].join('\n');
    expect(startTagCommentProblems(src)).toEqual([]);
  });
});

describe('Svelte start-tag comments in src/', () => {
  it('hold no quote and no /* */ form', () => {
    const problems = svelteFiles(path.join(ROOT, 'src')).flatMap((file) =>
      startTagCommentProblems(fs.readFileSync(file, 'utf8')).map(
        (p) => `${path.relative(ROOT, file)} ${p}`
      )
    );
    expect(problems).toEqual([]);
  });
});

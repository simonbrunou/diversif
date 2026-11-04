// .claude/hookify.block-e2e-start-without-slot.local.md against the commands
// it must block or pass (#645, #651). Claude Code's hookify plugin (0.1.1)
// reads the rule in Python: a hand-rolled frontmatter parser, then each
// condition ANDed, `regex_match` as re.search with re.IGNORECASE. This file
// ports those two steps for the keys the rule uses, so CI runs the rule's
// cases on every change. The pattern uses no syntax that Python and
// JavaScript read differently, and on 2026-11-04 the port and hookify's own
// RuleEngine agreed on every case below, for the rule before and after #653.
import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const rulePath = path.resolve(
  import.meta.dir,
  '../.claude/hookify.block-e2e-start-without-slot.local.md'
);

type Condition = { field: string; operator: string; pattern: string };

// hookify strips blanks, then double quotes, then single quotes from each
// value's ends (core/config_loader.py, extract_frontmatter).
const unquote = (value: string) =>
  value
    .trim()
    .replace(/^"+|"+$/g, '')
    .replace(/^'+|'+$/g, '');

function loadRule(file: string) {
  const content = readFileSync(file, 'utf8');
  if (!content.startsWith('---')) throw new Error(`${file} has no frontmatter`);
  const [, front, ...body] = content.split('---');
  const keys: Record<string, string> = {};
  const conditions: Condition[] = [];
  let current: Record<string, string> | null = null;
  for (const line of front.split('\n')) {
    const stripped = line.trim();
    if (!stripped || stripped.startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;
    if (stripped.startsWith('-')) {
      const [k, v] = splitKey(stripped.slice(1));
      current = { [k]: v };
      conditions.push(current as Condition);
    } else if (indent === 0) {
      const [k, v] = splitKey(line);
      keys[k] = v;
      current = null;
    } else if (indent > 2 && current) {
      const [k, v] = splitKey(stripped);
      current[k] = v;
    }
  }
  return { keys, conditions, message: body.join('---').trim() };
}

function splitKey(text: string): [string, string] {
  const colon = text.indexOf(':');
  return [text.slice(0, colon).trim(), unquote(text.slice(colon + 1))];
}

const rule = loadRule(rulePath);
const checks = rule.conditions.map((c) => {
  if (c.field !== 'command') throw new Error(`field ${c.field} is not ported`);
  if (c.operator === 'regex_match') {
    const regex = new RegExp(c.pattern, 'i');
    return (command: string) => regex.test(command);
  }
  if (c.operator === 'not_contains') return (command: string) => !command.includes(c.pattern);
  throw new Error(`operator ${c.operator} is not ported`);
});
const blocks = (command: string) => checks.every((check) => check(command));

// Each command that starts an E2E job.
const STARTS = [
  'fj pr -R origin create --base main --head x --body-file b.md "t"',
  'fj pr -R origin merge 640 -d',
  'fj pr --remote origin merge 640',
  'fj pr create --head x',
  'nix develop . -c fj pr -R origin merge 640 -d',
  'nix develop /w --command fj pr merge 640',
  'fj -H git.sbrn.eu pr create --head x',
  'fj --host git.sbrn.eu --style minimal pr merge 640',
  'curl -s -X POST -H "Authorization: token $T" https://git.sbrn.eu/api/v1/repos/simonbrunou/diversif/actions/jobs/13858/rerun',
  'curl -X POST https://git.sbrn.eu/api/v1/repos/simonbrunou/diversif/actions/runs/3405/rerun',
  'curl -X POST https://git.sbrn.eu/api/v1/repos/simonbrunou/diversif/pulls/642/merge',
  'curl -X POST "$API/actions/runs/3405/rerun"',
  'curl -X POST "$API/actions/jobs/13858/rerun"',
  'curl -X POST "${API}/pulls/642/merge"',
  'curl -X POST "$API"/pulls/642/merge',
  'for n in 1 2; do fj pr merge $n; done',
  'if true; then fj pr merge 640; fi',
  'echo 640 | xargs fj pr merge'
];

// Slot checks that gate whatever follows them.
const SLOTS: Record<string, string> = {
  'no argument': 'scripts/wait-e2e-slot.sh && ',
  'short SHA': 'scripts/wait-e2e-slot.sh c2403f8 && ',
  'full SHA': 'scripts/wait-e2e-slot.sh c2403f87b1e8c3d0a4f5e6b7c8d9e0f1a2b3c4d5 && ',
  'quoted rev-parse': 'scripts/wait-e2e-slot.sh "$(git rev-parse origin/x)" && ',
  'single-quoted SHA': "scripts/wait-e2e-slot.sh 'c2403f8' && ",
  'after cd and T=': 'cd /w && T=$(cat k) && scripts/wait-e2e-slot.sh c2403f8 && ',
  'rev-parse, inner quotes': 'scripts/wait-e2e-slot.sh "$(git rev-parse "origin/$B")" && ',
  'curl | jq, inner quotes':
    'scripts/wait-e2e-slot.sh "$(curl -s "$API/pulls/640" | jq -r .head.sha)" && '
};

const MERGE = 'fj pr -R origin merge 640 -d';
const SUBST = 'scripts/wait-e2e-slot.sh "$(git rev-parse "origin/$B")"';

// A slot call that gates nothing, or that the rule cannot read.
const MUST_BLOCK: Record<string, string> = {
  piped: 'scripts/wait-e2e-slot.sh | tail -1; ' + MERGE,
  'piped then &&': 'scripts/wait-e2e-slot.sh | tail -1 && ' + MERGE,
  semicolon: 'scripts/wait-e2e-slot.sh; ' + MERGE,
  'semicolon, later &&': 'scripts/wait-e2e-slot.sh; ' + MERGE + ' && echo ok',
  'SHA then semicolon': 'scripts/wait-e2e-slot.sh c2403f8; ' + MERGE,
  'SHA then ||': 'scripts/wait-e2e-slot.sh c2403f8 || true; ' + MERGE,
  '||': 'scripts/wait-e2e-slot.sh || ' + MERGE,
  '||, later &&': 'scripts/wait-e2e-slot.sh || ' + MERGE + ' && echo ok',
  'SHA ||, later &&': 'scripts/wait-e2e-slot.sh c2403f8 || ' + MERGE + ' && echo ok',
  'newline then &&': 'scripts/wait-e2e-slot.sh\ntrue && ' + MERGE,
  'SHA, newline then &&': 'scripts/wait-e2e-slot.sh c2403f8\ntrue && ' + MERGE,
  'newline before &&': 'scripts/wait-e2e-slot.sh\n&& ' + MERGE,
  'subst then semicolon, later &&': SUBST + '; ' + MERGE + ' && echo ok',
  'subst piped then &&': SUBST + ' | tail -1 && ' + MERGE,
  'subst piped, later &&': SUBST + ' | tail -1; ' + MERGE + ' && echo ok',
  'subst then ||': SUBST + ' || ' + MERGE,
  'subst ||, later &&': SUBST + ' || ' + MERGE + ' && echo ok',
  'subst, newline then &&': SUBST + '\ntrue && ' + MERGE,
  'subst, two arguments': SUBST + ' x && ' + MERGE,
  'unclosed subst': 'scripts/wait-e2e-slot.sh "$(git rev-parse "origin/$B" && ' + MERGE,
  // The message names these forms and sends them to the variable form.
  'subst, escaped quote': 'scripts/wait-e2e-slot.sh "$(git rev-parse \\"origin/$B\\")" && ' + MERGE,
  'subst, bare parentheses':
    'scripts/wait-e2e-slot.sh "$( (cd /w && git rev-parse "origin/$B") )" && ' + MERGE,
  'unquoted subst': 'scripts/wait-e2e-slot.sh $(git rev-parse origin/x) && ' + MERGE,
  'unquoted subst, inner quotes':
    'scripts/wait-e2e-slot.sh $(git rev-parse "origin/$B") && ' + MERGE,
  'backtick, unquoted': 'scripts/wait-e2e-slot.sh `git rev-parse origin/x` && ' + MERGE,
  'backtick, unquoted, double quotes':
    'scripts/wait-e2e-slot.sh `git rev-parse "origin/$B"` && ' + MERGE,
  'backtick, quoted, double quotes':
    'scripts/wait-e2e-slot.sh "`git rev-parse "origin/$B"`" && ' + MERGE,
  'redirect to a file': 'scripts/wait-e2e-slot.sh > /tmp/slot.out && ' + MERGE,
  'redirect 2>&1': 'scripts/wait-e2e-slot.sh 2>&1 && ' + MERGE,
  'variable, redirect':
    'H=$(git rev-parse origin/x) && scripts/wait-e2e-slot.sh "$H" > /tmp/slot.out && ' + MERGE
};

// A slot call chained with && on one shell line, and commands that start
// nothing.
const MUST_PASS: Record<string, string> = {
  'two lines': 'scripts/wait-e2e-slot.sh c2403f8 &&\n' + MERGE,
  tab: 'scripts/wait-e2e-slot.sh\tc2403f8\t&& ' + MERGE,
  continuation: 'scripts/wait-e2e-slot.sh \\\n&& ' + MERGE,
  'SHA, continuation': 'scripts/wait-e2e-slot.sh c2403f8 \\\n  && ' + MERGE,
  'continuation, SHA': 'scripts/wait-e2e-slot.sh \\\n  c2403f8 && ' + MERGE,
  // One shell line: the script refuses `true` with exit 2, so the merge
  // stays gated.
  'continuation, word': 'scripts/wait-e2e-slot.sh \\\ntrue && ' + MERGE,
  'continuation, subst':
    'scripts/wait-e2e-slot.sh \\\n  "$(git rev-parse "origin/$B")" && ' + MERGE,
  'subst, two levels':
    'scripts/wait-e2e-slot.sh "$(git rev-parse "origin/$(git branch --show-current)")" && ' + MERGE,
  'subst, three levels': 'scripts/wait-e2e-slot.sh "$(a "$(b "c")")" && ' + MERGE,
  'subst, single quotes inside':
    'scripts/wait-e2e-slot.sh "$(curl -s "$API/pulls/640" | jq -r \'.head.sha\')" && ' + MERGE,
  'empty subst': 'scripts/wait-e2e-slot.sh "$()" && ' + MERGE,
  'unquoted subst, no blank': 'scripts/wait-e2e-slot.sh $(cat) && ' + MERGE,
  'backtick, quoted': 'scripts/wait-e2e-slot.sh "`git rev-parse origin/x`" && ' + MERGE,
  'backtick, quoted, single quotes':
    'scripts/wait-e2e-slot.sh "`git rev-parse \'origin/x\'`" && ' + MERGE,
  'variable first': 'H=$(git rev-parse "origin/$B") && scripts/wait-e2e-slot.sh "$H" && ' + MERGE,
  "message's variable form":
    'H=$(git rev-parse origin/x) && scripts/wait-e2e-slot.sh "$H" && ' + MERGE,
  push: 'git push -q origin HEAD',
  search: 'fj pr -R origin search',
  status: 'fj pr -R origin status 642'
};

describe('block-e2e-start-without-slot', () => {
  it('loads as hookify reads it', () => {
    expect(rule.keys).toMatchObject({
      name: 'block-e2e-start-without-slot',
      enabled: 'true',
      event: 'bash',
      action: 'block'
    });
    expect(rule.conditions.map((c) => c.operator)).toEqual(['regex_match', 'not_contains']);
    expect(rule.conditions[1].pattern).toBe('# no-e2e-job');
  });

  describe.each(STARTS)('%s', (start) => {
    it('blocks bare', () => expect(blocks(start)).toBe(true));
    it('passes with the marker', () => expect(blocks(start + '  # no-e2e-job')).toBe(false));
    it.each(Object.entries(SLOTS))('passes behind the slot check: %s', (_, slot) =>
      expect(blocks(slot + start)).toBe(false)
    );
  });

  it.each(Object.entries(MUST_BLOCK))('blocks: %s', (_, command) =>
    expect(blocks(command)).toBe(true)
  );

  it.each(Object.entries(MUST_PASS))('passes: %s', (_, command) =>
    expect(blocks(command)).toBe(false)
  );

  // A nested quantifier in the argument group backtracks without end on an
  // argument that never closes: hookify ran over 120 s on such a mutant.
  // This engine gives up and returns false, so these tests fail either way.
  it.each([
    ['plain', 'a'.repeat(20_000)],
    ['quoted strings', '"x"'.repeat(7_000)],
    ['nested openings', 'a"$(b'.repeat(4_000)]
  ])('reads an unclosed 20,000-character argument fast: %s', (_, body) => {
    const start = performance.now();
    expect(blocks('scripts/wait-e2e-slot.sh "$(' + body + ' && ' + MERGE)).toBe(true);
    expect(performance.now() - start).toBeLessThan(500);
  });

  it('names the variable form in its message', () =>
    expect(rule.message).toContain(
      '`H=$(git rev-parse origin/<branch>) && scripts/wait-e2e-slot.sh "$H" && <command>`'
    ));
});

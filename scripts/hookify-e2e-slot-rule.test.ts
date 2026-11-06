// .claude/hookify.block-e2e-start-without-slot.local.md against the commands
// it must block or pass (#645, #651). Claude Code's hookify plugin (0.1.1)
// reads the rule in Python: a hand-rolled frontmatter parser, then each
// condition ANDed, `regex_match` as re.search with re.IGNORECASE. This file
// ports those two steps for the keys the rule uses, so CI runs the rule's
// cases on every change. Python and JavaScript read the pattern alike only
// in the syntax they share and on printable ASCII, tab and newline, so two
// tests keep the pattern and the cases to those. Where Claude Code installed
// hookify (CI has none), the last test runs hookify's own engine on every
// case and compares the verdicts.
import { describe, expect, it } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
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
  // Any variable can hold the API base: the #674 session used $A.
  'curl -s -X POST -H "Authorization: token $T" "$A/actions/jobs/15510/rerun"',
  'curl -X POST "${REPO_API}/actions/runs/3405/rerun"',
  'curl -X POST $BASE/pulls/642/merge',
  'for n in 1 2; do fj pr merge $n; done',
  'if true; then fj pr merge 640; fi',
  'echo 640 | xargs fj pr merge'
];

const MERGE = 'fj pr -R origin merge 640 -d';
const SUBST = 'scripts/wait-e2e-slot.sh "$(git rev-parse "origin/$B")"';

// Slot checks that gate whatever follows them.
const SLOTS: Record<string, string> = {
  'no argument': 'scripts/wait-e2e-slot.sh && ',
  'short SHA': 'scripts/wait-e2e-slot.sh c2403f8 && ',
  'full SHA': 'scripts/wait-e2e-slot.sh c2403f87b1e8c3d0a4f5e6b7c8d9e0f1a2b3c4d5 && ',
  'quoted rev-parse': 'scripts/wait-e2e-slot.sh "$(git rev-parse origin/x)" && ',
  'single-quoted SHA': "scripts/wait-e2e-slot.sh 'c2403f8' && ",
  'after cd and T=': 'cd /w && T=$(cat k) && scripts/wait-e2e-slot.sh c2403f8 && ',
  'rev-parse, inner quotes': SUBST + ' && ',
  'curl | jq, inner quotes':
    'scripts/wait-e2e-slot.sh "$(curl -s "$API/pulls/640" | jq -r .head.sha)" && '
};

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
    'H=$(git rev-parse origin/x) && scripts/wait-e2e-slot.sh "$H" > /tmp/slot.out && ' + MERGE,
  // hookify matches the pattern with re.IGNORECASE, the marker with a
  // case-sensitive substring test.
  'upper case': 'FJ PR MERGE 640',
  'upper-case marker': MERGE + '  # NO-E2E-JOB'
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
  // Another repo's job, named in the URL: no diversif E2E job starts.
  'rerun in another repo':
    'curl -X POST https://git.sbrn.eu/api/v1/repos/simonbrunou/cinder/actions/jobs/13858/rerun',
  push: 'git push -q origin HEAD',
  search: 'fj pr -R origin search',
  status: 'fj pr -R origin status 642'
};

const COMMANDS = [
  ...STARTS.flatMap((start) => [
    start,
    start + '  # no-e2e-job',
    ...Object.values(SLOTS).map((slot) => slot + start)
  ]),
  ...Object.values(MUST_BLOCK),
  ...Object.values(MUST_PASS)
];

// hookify's own engine, at the path Claude Code installed it to, run on the
// commands passed as JSON. A newer hookify than the 0.1.1 this file ports
// runs too, so a change in its parser or engine that alters a verdict on
// these cases fails here.
const INSTALLED = path.join(homedir(), '.claude/plugins/installed_plugins.json');
const HOOKIFY: string | undefined = existsSync(INSTALLED)
  ? JSON.parse(readFileSync(INSTALLED, 'utf8')).plugins?.['hookify@claude-plugins-official']?.[0]
      ?.installPath
  : undefined;
const HOOKIFY_VERDICTS = `
import json, sys
sys.path.insert(0, sys.argv[1])
from core.config_loader import load_rule_file
from core.rule_engine import RuleEngine
rule = load_rule_file(sys.argv[2])
engine = RuleEngine()
out = []
for command in json.loads(sys.argv[3]):
    event = {"hook_event_name": "PreToolUse", "tool_name": "Bash", "tool_input": {"command": command}}
    decision = engine.evaluate_rules([rule], event).get("hookSpecificOutput", {})
    out.append(decision.get("permissionDecision") == "deny")
print(json.dumps(out))
`;
const hasHookify =
  !!HOOKIFY && existsSync(path.join(HOOKIFY, 'core/rule_engine.py')) && !!Bun.which('python3');

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
  // Bun 1.4's regex engine gives up after about a second and returns false,
  // which fails the first two of these.
  it.each([
    ['plain', 'a'.repeat(20_000)],
    ['quoted strings', '"x"'.repeat(7_000)],
    ['nested openings', 'a"$(b'.repeat(4_000)]
  ])('blocks an unclosed 20,000-character argument: %s', (_, body) =>
    expect(blocks('scripts/wait-e2e-slot.sh "$(' + body + ' && ' + MERGE)).toBe(true)
  );

  it('names the variable form in its message', () =>
    expect(rule.message).toContain(
      '`H=$(git rev-parse origin/<branch>) && scripts/wait-e2e-slot.sh "$H" && <command>`'
    ));

  // \s, \b and case folding differ between the engines outside printable
  // ASCII, tab and newline: Python's \s also matches \x1c, for one.
  it('keeps the pattern and every case to printable ASCII, tab and newline', () => {
    const ascii = /^[\t\n -~]*$/;
    expect(rule.conditions[0].pattern).toMatch(ascii);
    expect(COMMANDS.filter((command) => !ascii.test(command))).toEqual([]);
  });

  // Each engine rejects or misreads some of the other's syntax: Python's
  // (?P<name>), inline flags, {,n} and a $ that also matches before a final
  // newline; JavaScript's (?<name>), \k, \p{}, \u{} and [^]. The pattern
  // keeps to escapes and groups both read the same way.
  it('uses only regex syntax Python and JavaScript share', () => {
    const pattern = rule.conditions[0].pattern;
    const escapes = pattern.match(/\\[\s\S]/g) ?? [];
    expect(escapes.filter((e) => !/^\\[sSbntr.\\$(){}[\]|*+?^/-]$/.test(e))).toEqual([]);
    const unescaped = pattern.replace(/\\[\s\S]/g, '__');
    expect(unescaped.match(/\(\?[^:!=]/g) ?? []).toEqual([]);
    expect(unescaped).not.toMatch(/\[\^?\]/);
    expect(unescaped).not.toMatch(/\{,|\$/);
  });

  it.skipIf(!hasHookify)(
    "matches the installed hookify's own verdict on every case",
    () => {
      const run = Bun.spawnSync([
        'python3',
        '-I',
        '-c',
        HOOKIFY_VERDICTS,
        HOOKIFY ?? '',
        rulePath,
        JSON.stringify(COMMANDS)
      ]);
      expect(run.stderr.toString()).toBe('');
      const verdicts: boolean[] = JSON.parse(run.stdout.toString());
      expect(COMMANDS.filter((command, i) => verdicts[i] !== blocks(command))).toEqual([]);
      expect(verdicts).toHaveLength(COMMANDS.length);
    },
    30_000
  );
});

// .claude/rule-hook/hook.py, the PreToolUse hook that checks each tool call
// against .claude/rule-hook/rules/*.md (#663). A block rule's message must
// reach the agent in permissionDecisionReason, a warn rule's in
// additionalContext. scripts/e2e-slot-rule.test.ts covers the E2E rule's own
// cases.
//
// A rule that reads a command's options needs a test case for each way to
// write the option. List them before review: the long and short forms in the
// command's usage (`fuser --help` prints `-k,--kill`), a short option inside a
// cluster (`-4k`), an option after a `\` line break, and letter case. hook.py
// compiles each regex_match pattern with re.IGNORECASE, so a `-…k` pattern
// also matches the `K` of `-SIGKILL`, a signal name: scope a part that must
// keep its case with `(?-i:…)`. On block-kill-by-name, review found these
// forms in three rounds after the first fix (#722).
import { afterAll, describe, expect, it } from 'bun:test';
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  combined,
  compilePatterns,
  type HookOutput,
  loadRuleFiles,
  preToolUse,
  REPO,
  respondAll,
  type Rule,
  RULES_DIR,
  runHook
} from './rule-hook';

const deny = (...names: string[]) => ({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: combined(...names)
  }
});

// The agent reads additionalContext, the person watching reads systemMessage.
const warn = (...names: string[]) => ({
  hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: combined(...names) },
  systemMessage: combined(...names)
});

// One call each block rule refuses.
const BLOCKS: [string, string, Record<string, unknown>][] = [
  [
    'block-applied-migration-edit',
    'Edit',
    { file_path: `${REPO}/drizzle/0001_probe.sql`, old_string: 'a', new_string: 'b' }
  ],
  ['block-e2e-start-without-slot', 'Bash', { command: 'fj pr -R origin merge 640 -d' }],
  ['block-env-file', 'Write', { file_path: `${REPO}/.env`, content: 'A=1' }],
  [
    'block-generated-paraglide',
    'Edit',
    { file_path: `${REPO}/src/lib/paraglide/messages.js`, old_string: 'a', new_string: 'b' }
  ],
  ['block-kill-by-name', 'Bash', { command: "pkill -f 'bun build/index.js'" }],
  ['block-no-verify', 'Bash', { command: 'git commit --no-verify -m x' }]
];

// A kill by name or by port reaches every worktree's process, another
// worktree's E2E server included (#722). A kill of the PID you started, a
// pgrep or fuser that kills nothing, and a command with the escape comment go
// through. A `kill` before a `pgrep` counts up to the next `;` or bare
// newline, so a pgrep check after a kill of a saved PID goes through
// without the escape comment.
const KILLS_BY_NAME = [
  "pkill -f 'bun build/index.js'",
  'pkill -f "bun build/index.js"; sleep 1',
  'nix develop -c pkill -f playwright',
  'sudo -n pkill -f vite',
  'killall bun',
  "kill $(pgrep -f 'bun build/index.js')",
  "pgrep -f 'bun build/index.js' | xargs -r kill",
  "kill $(pgrep -f 'bun build/index.js' | head -n 1)",
  'kill $(cat repro.pid || pgrep -f vite)',
  'kill -TERM $(\\\n  pgrep -f vite)',
  'fuser -k 4173/tcp',
  'fuser -v -k -n tcp 3123',
  'fuser --kill 4173/tcp',
  'fuser -4k 4173/tcp',
  'fuser -v -n tcp \\\n  -k 4173',
  "pkill -f 'bun build/index.js' #no-kill-by-name"
];
const OTHER_KILLS = [
  'kill "$(cat repro.pid)"',
  'kill "$(cat repro.pid)"; ss -ltn \'sport = :5722\'',
  'kill $!',
  "pgrep -af 'bun build/index.js'",
  'fuser -v -n tcp 4173',
  'fuser -SIGKILL -v -n tcp 4173',
  "rg -n 'pkill' docs # no-kill-by-name",
  "kill $(jobs -p); pgrep -fc 'while :; do :; done'",
  'kill "$(cat repro.pid)"\npgrep -fc vite'
];

// hook.py loads every rule for a tool it maps to no event, and a file rule's
// file_path condition then reads that tool's file_path. So each file rule but
// block-env-file names the edit tools in tool_matcher, and a Read, an Artifact
// publish or an MCP call on a migration, a generated paraglide file or a
// message file gets no verdict (#719). block-env-file names none, to deny a
// real .env to every tool.
const ENV_RULE = 'block-env-file';
const EDIT_TOOLS = ['Edit', 'Write', 'MultiEdit'];

// Each file rule that would check a call that edits nothing, with the reason.
function unscopedFileRules(rules: Rule[]): string[] {
  const found: string[] = [];
  for (const rule of rules) {
    if (rule.event !== 'file') continue;
    // An empty `tool_matcher:` parses to [], and an empty string to ''. The
    // hook reads both as no matcher.
    const matcher: unknown = rule.tool_matcher;
    if (rule.name === ENV_RULE) {
      if (matcher !== null) found.push(`${rule.name}: tool_matcher ${JSON.stringify(matcher)}`);
    } else if (typeof matcher !== 'string' || matcher === '') {
      found.push(`${rule.name}: no tool_matcher`);
    } else {
      const outside = matcher.split('|').filter((tool) => !EDIT_TOOLS.includes(tool));
      if (outside.length > 0) found.push(`${rule.name}: tool_matcher names ${outside.join(', ')}`);
    }
  }
  return found;
}

const MIGRATIONS = ['drizzle/0001_x.sql', 'drizzle/meta/_journal.json'];
const PARAGLIDE = 'src/lib/paraglide/runtime.js';
const MESSAGES = ['messages/en.json', 'messages/fr.json'];
const ENV_FILES = ['.env', '.env.local', '.env.development', '.env.production', '.env.test'];

// An edit tool's input that writes `text` to `file`, a path in the repo.
const EDITS: Record<string, (file: string, text: string) => Record<string, unknown>> = {
  Edit: (file, text) => ({ file_path: `${REPO}/${file}`, old_string: 'a', new_string: text }),
  Write: (file, text) => ({ file_path: `${REPO}/${file}`, content: text }),
  MultiEdit: (file, text) => ({
    file_path: `${REPO}/${file}`,
    edits: [{ old_string: 'a', new_string: text }]
  })
};
// Tools that hook.py maps to no event and whose input names a file in
// file_path: Claude Code's Read and Artifact, and an MCP tool. Its LSP takes
// filePath and its NotebookEdit notebook_path, which no rule reads.
const OTHER_TOOLS = ['Read', 'Artifact', 'mcp__x__y'];
const ALL_TOOLS = [...EDIT_TOOLS, ...OTHER_TOOLS];
const input = (tool: string, file: string, text = 'b') =>
  preToolUse(tool, EDITS[tool]?.(file, text) ?? { file_path: `${REPO}/${file}` });

// Each call, the answer hook.py must give it, and a test title.
const SCOPED: [string, ReturnType<typeof preToolUse>, HookOutput][] = [
  ...EDIT_TOOLS.flatMap((tool) => [
    ...MIGRATIONS.map((file) => [
      `${tool} of ${file}: denies`,
      input(tool, file),
      deny('block-applied-migration-edit')
    ]),
    [`${tool} of ${PARAGLIDE}: denies`, input(tool, PARAGLIDE), deny('block-generated-paraglide')],
    ...MESSAGES.map((file) => [
      `${tool} of ${file}: warns`,
      input(tool, file),
      warn('verify-i18n-on-message-edit')
    ]),
    // hookify reads a Write's new text from new_string, which a Write lacks.
    [
      `${tool} of messages/fr.json with an anglicism: warns`,
      input(tool, 'messages/fr.json', '"Email"'),
      tool === 'Write'
        ? warn('verify-i18n-on-message-edit')
        : warn('verify-i18n-on-message-edit', 'warn-anglicism-fr-messages')
    ]
  ]),
  ...OTHER_TOOLS.flatMap((tool) =>
    [...MIGRATIONS, PARAGLIDE, ...MESSAGES].map((file) => [
      `${tool} of ${file}: answers {}`,
      input(tool, file),
      {}
    ])
  ),
  ...ALL_TOOLS.flatMap((tool) => [
    ...ENV_FILES.map((file) => [`${tool} of ${file}: denies`, input(tool, file), deny(ENV_RULE)]),
    [`${tool} of .env.example: answers {}`, input(tool, '.env.example'), {}]
  ]),
  ['Bash `cat .env`: answers {}', preToolUse('Bash', { command: 'cat .env' }), {}]
] as [string, ReturnType<typeof preToolUse>, HookOutput][];
const SCOPED_ANSWERS = respondAll(SCOPED.map(([, call]) => call));

// Rule files, one per way a file rule can name its tools, for
// unscopedFileRules.
const FIXTURES = mkdtempSync(path.join(tmpdir(), 'rule-hook-'));
afterAll(() => rmSync(FIXTURES, { recursive: true, force: true }));
function fixture(name: string, event: string, matcher: string | null) {
  const file = path.join(FIXTURES, `${name}.md`);
  writeFileSync(
    file,
    [
      '---',
      `name: ${name}`,
      'enabled: true',
      `event: ${event}`,
      'action: block',
      ...(matcher === null ? [] : [`tool_matcher:${matcher}`]),
      'conditions:',
      '  - field: file_path',
      '    operator: regex_match',
      '    pattern: x',
      '---',
      '',
      'Message.'
    ].join('\n')
  );
  return loadRuleFiles([file])[0];
}

describe('.claude/rule-hook/hook.py', () => {
  it.each(BLOCKS)('%s: denies with its name and message as the reason', (name, tool, input) => {
    const run = runHook(preToolUse(tool, input));
    expect(run.stderr).toBe('');
    expect(run.exitCode).toBe(0);
    expect(run.output).toEqual(deny(name));
  });

  it.each(KILLS_BY_NAME)('block-kill-by-name: denies %s', (command) =>
    expect(runHook(preToolUse('Bash', { command })).output).toEqual(deny('block-kill-by-name'))
  );

  it.each(OTHER_KILLS)('block-kill-by-name: lets %s through', (command) =>
    expect(runHook(preToolUse('Bash', { command })).output).toEqual({})
  );

  it('verify-i18n-on-message-edit: lets the call go on, its message as context', () => {
    const input = { file_path: `${REPO}/messages/en.json`, old_string: 'a', new_string: 'b' };
    expect(runHook(preToolUse('Edit', input)).output).toEqual(warn('verify-i18n-on-message-edit'));
  });

  it('warn-anglicism-fr-messages: lets the call go on, both warnings as context', () => {
    const input = { file_path: `${REPO}/messages/fr.json`, old_string: 'a', new_string: '"Email"' };
    expect(runHook(preToolUse('Edit', input)).output).toEqual(
      warn('verify-i18n-on-message-edit', 'warn-anglicism-fr-messages')
    );
  });

  it('gives only the block rules when a block and a warn both match', () => {
    const input = {
      file_path: `${REPO}/src/lib/paraglide/messages/fr.json`,
      old_string: 'a',
      new_string: 'b'
    };
    expect(runHook(preToolUse('Edit', input)).output).toEqual(deny('block-generated-paraglide'));
  });

  it('answers {} when no rule matches', () =>
    expect(runHook(preToolUse('Bash', { command: 'ls -la' })).output).toEqual({}));

  // hookify loads every rule for a tool it maps to neither bash nor file, and
  // only a field the tool's input carries can match.
  it('block-env-file: denies a Read of .env, lets a Grep of it through', () => {
    expect(runHook(preToolUse('Read', { file_path: `${REPO}/.env` })).output).toEqual(
      deny(ENV_RULE)
    );
    expect(runHook(preToolUse('Grep', { pattern: 'X', path: `${REPO}/.env` })).output).toEqual({});
  });

  it.each(SCOPED.map(([title], i) => [title, i] as const))('%s', (_, i) =>
    expect(SCOPED_ANSWERS[i]).toEqual(SCOPED[i][2])
  );

  it('scopes every file rule but block-env-file to the edit tools', () =>
    expect(
      unscopedFileRules(
        loadRuleFiles(
          readdirSync(RULES_DIR)
            .filter((file) => file.endsWith('.md'))
            .map((file) => path.join(RULES_DIR, file))
        )
      )
    ).toEqual([]));

  it.each([
    ['flags a file rule with no tool_matcher', 'r', null, ['r: no tool_matcher']],
    ['flags an empty tool_matcher', 'r', '', ['r: no tool_matcher']],
    ['flags an empty quoted tool_matcher', 'r', ' ""', ['r: no tool_matcher']],
    ['flags a wildcard', 'r', ' *', ['r: tool_matcher names *']],
    [
      'flags a tool outside the edit tools',
      'r',
      ' Edit|Write|MultiEdit|Read',
      ['r: tool_matcher names Read']
    ],
    [
      'flags a blank inside the matcher',
      'r',
      ' Edit | Write',
      ['r: tool_matcher names Edit ,  Write']
    ],
    [
      'flags a tool_matcher on block-env-file',
      ENV_RULE,
      ' Read',
      [`${ENV_RULE}: tool_matcher "Read"`]
    ],
    ['passes the edit tools', 'r', ' Edit|Write|MultiEdit', []],
    ['passes some of the edit tools', 'r', ' Edit', []],
    ['passes block-env-file with no tool_matcher', ENV_RULE, null, []]
  ] as const)('unscopedFileRules: %s', (_, name, matcher, found) =>
    expect(unscopedFileRules([fixture(name, 'file', matcher)])).toEqual([...found])
  );

  it('unscopedFileRules: skips a bash rule with no tool_matcher', () =>
    expect(unscopedFileRules([fixture('r', 'bash', null)])).toEqual([]));

  // A T3 thread runs the hook before any install, and a shell can sit anywhere.
  it('finds its rules from outside the repo, with an empty environment', () => {
    const run = runHook(preToolUse('Bash', { command: 'git commit --no-verify' }), {
      cwd: '/',
      env: {}
    });
    expect(run.stderr).toBe('');
    expect(run.output).toEqual(deny('block-no-verify'));
  });

  it('lets the call through on an error and says that no rule checked it', () => {
    const run = runHook('not JSON');
    expect(run.exitCode).toBe(0);
    expect(run.output?.hookSpecificOutput?.permissionDecision).toBeUndefined();
    expect(run.output?.hookSpecificOutput?.additionalContext).toStartWith(
      "The repo's rule hook (.claude/rule-hook/hook.py) failed with JSONDecodeError"
    );
    expect(run.output?.systemMessage).toBe(run.output?.hookSpecificOutput?.additionalContext);
  });

  // The hook skips a rule file it cannot parse and a pattern it cannot
  // compile, with a line on stderr only.
  it('loads every rule file, and Python compiles each pattern', () => {
    const files = readdirSync(RULES_DIR).filter((file) => file.endsWith('.md'));
    expect(files).toHaveLength(8);
    const rules = loadRuleFiles(files.map((file) => path.join(RULES_DIR, file)));
    for (const [i, rule] of rules.entries()) {
      expect(rule).toMatchObject({ name: path.basename(files[i], '.md'), enabled: true });
      expect(['bash', 'file']).toContain(rule.event);
      expect(['block', 'warn']).toContain(rule.action);
      expect(rule.message).not.toBe('');
      expect(rule.conditions.length).toBeGreaterThan(0);
    }
    const patterns = rules.flatMap((rule) =>
      rule.conditions.filter((c) => c.operator === 'regex_match').map((c) => c.pattern)
    );
    expect(compilePatterns(patterns)).toEqual(patterns);
  });

  // hookify (still installed) reads .claude/hookify.*.local.md and puts a
  // match's message where the agent never sees it.
  it('leaves hookify no rule file to read', () =>
    expect(
      readdirSync(path.join(REPO, '.claude')).filter((f) => /^hookify\..*\.local\.md$/.test(f))
    ).toEqual([]));

  it('runs on every tool call, from the project directory', () => {
    const settings = JSON.parse(readFileSync(path.join(REPO, '.claude/settings.json'), 'utf8'));
    expect(settings.hooks.PreToolUse).toContainEqual({
      hooks: [
        {
          type: 'command',
          command: 'python3 -I "$CLAUDE_PROJECT_DIR"/.claude/rule-hook/hook.py',
          timeout: 10
        }
      ]
    });
  });
});

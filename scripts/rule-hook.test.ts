// .claude/rule-hook/hook.py, the PreToolUse hook that checks each tool call
// against .claude/rule-hook/rules/*.md (#663). A block rule's message must
// reach the agent in permissionDecisionReason, a warn rule's in
// additionalContext. scripts/e2e-slot-rule.test.ts covers the E2E rule's own
// cases.
import { describe, expect, it } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  combined,
  compilePatterns,
  loadRuleFiles,
  preToolUse,
  REPO,
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
  ['block-env-edit', 'Write', { file_path: `${REPO}/.env`, content: 'A=1' }],
  [
    'block-generated-paraglide',
    'Edit',
    { file_path: `${REPO}/src/lib/paraglide/messages.js`, old_string: 'a', new_string: 'b' }
  ],
  ['block-no-verify', 'Bash', { command: 'git commit --no-verify -m x' }]
];

describe('.claude/rule-hook/hook.py', () => {
  it.each(BLOCKS)('%s: denies with its name and message as the reason', (name, tool, input) => {
    const run = runHook(preToolUse(tool, input));
    expect(run.stderr).toBe('');
    expect(run.exitCode).toBe(0);
    expect(run.output).toEqual(deny(name));
  });

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
  it('keeps hookify 0.1.1 verdicts: denies a Read of .env, lets a Grep of it through', () => {
    expect(runHook(preToolUse('Read', { file_path: `${REPO}/.env` })).output).toEqual(
      deny('block-env-edit')
    );
    expect(runHook(preToolUse('Grep', { pattern: 'X', path: `${REPO}/.env` })).output).toEqual({});
  });

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
    expect(files).toHaveLength(7);
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

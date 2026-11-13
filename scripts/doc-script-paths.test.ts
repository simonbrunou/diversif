// Every repo script an agent doc names exists. The rule-hook rules and the
// i18n-add-key skill named scripts/lint-i18n.mjs as the i18n gate after it
// became lint-i18n.ts, and before any parity check existed (#723).
import { describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.join(import.meta.dir, '..');

// The docs agents read: AGENTS.md, README.md, docs/agents/, .claude/ (rules,
// skills, agents). docs/superpowers/ holds dated plans that name files as
// they were then, and graphify-out/ is generated. .claude/worktrees/ is
// git-ignored: Claude Code's worktree mode puts other checkouts there, on
// other branches.
function docs(root = ROOT): string[] {
  const out = ['AGENTS.md', 'README.md'];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (rel !== path.join('.claude', 'worktrees')) walk(rel);
      } else if (entry.name.endsWith('.md')) out.push(rel);
    }
  };
  walk('docs/agents');
  walk('.claude');
  return out;
}

// A path to a scripts/<name>.<ext> file, with its whole extension, and the
// rest of its word before scripts/ (the prefix). A space, a backtick, a quote
// or an opening parenthesis ends the word.
const SCRIPT_PATH = /([^\s`'"(]*)scripts\/[\w./-]+\.(?:ts|mjs|cjs|js|sh|py|json)(?!\w)/g;

// The prefixes of a path that is not this repo's: the build output
// (`bun build/scripts/export-user.js`) and a skill in the home directory
// (`~/.agents/skills/forgejo-issues/scripts/forgejo.py`).
const OTHER_PREFIX = /^(?:build\/|~\/\.agents\/skills\/[\w-]+\/)$/;

// A path in another repo, which the doc names right before it.
const OTHER_REPO = /homelab-stacks `$/;

type Found = { path: string; line: number };

/**
 * The scripts/ paths in a doc's text, with their line. `repo` holds the paths
 * that name this repo's files, `unknown` those with a prefix this test does
 * not read, which may name this repo's files too (`./scripts/x.sh`).
 */
function scriptPaths(text: string): { repo: Found[]; unknown: Found[] } {
  const repo: Found[] = [];
  const unknown: Found[] = [];
  text.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(SCRIPT_PATH)) {
      const found = { path: m[0], line: i + 1 };
      if (m[1] !== '') {
        if (!OTHER_PREFIX.test(m[1])) unknown.push(found);
      } else if (!OTHER_REPO.test(line.slice(0, m.index))) repo.push(found);
    }
  });
  return { repo, unknown };
}

describe('scriptPaths', () => {
  it.each([
    ['a .ts file', 'run `scripts/lint-i18n.ts`', 'scripts/lint-i18n.ts'],
    ['a .mjs file', 'run `scripts/lint-i18n.mjs`', 'scripts/lint-i18n.mjs'],
    ['a .cjs file', 'run `scripts/x.cjs`', 'scripts/x.cjs'],
    ['a .js file', 'run `scripts/x.js`', 'scripts/x.js'],
    ['a .sh file', '`scripts/wait-e2e-slot.sh && git push`', 'scripts/wait-e2e-slot.sh'],
    [
      'a .py file',
      'run `scripts/normalize-fr-apostrophes.py`',
      'scripts/normalize-fr-apostrophes.py'
    ],
    ['a .json file', 'in `scripts/bundle-budget.json`,', 'scripts/bundle-budget.json'],
    ['a file in a subfolder', 'run `scripts/sub/x.ts`', 'scripts/sub/x.ts'],
    ['a file with a dot in its name', 'run `scripts/x.test.ts`', 'scripts/x.test.ts'],
    ['a path after a space', 'run scripts/x.sh first', 'scripts/x.sh'],
    ['a path in double quotes', 'run "scripts/x.sh"', 'scripts/x.sh'],
    ['a path in single quotes', "run 'scripts/x.sh'", 'scripts/x.sh'],
    ['a path in parentheses', 'a script (scripts/x.sh)', 'scripts/x.sh'],
    ['a path at the end of a sentence', 'see scripts/x.ts.', 'scripts/x.ts']
  ])('reads %s', (_name, text, found) => {
    expect(scriptPaths(text)).toEqual({ repo: [{ path: found, line: 1 }], unknown: [] });
  });

  it('counts lines from 1', () => {
    expect(scriptPaths('a\n\n`scripts/x.ts`').repo).toEqual([{ path: 'scripts/x.ts', line: 3 }]);
  });

  it('reads a path after the name of another repo that ends before it', () => {
    const text = 'homelab-stacks `scripts/a.sh`, then `scripts/b.sh`';
    expect(scriptPaths(text)).toEqual({ repo: [{ path: 'scripts/b.sh', line: 1 }], unknown: [] });
  });

  it.each([
    ['a path inside build/', 'bun build/scripts/export-user.js'],
    ['a path in a home skill', 'python3 -I ~/.agents/skills/forgejo-issues/scripts/forgejo.py get'],
    ['a path in another repo', 'homelab-stacks `scripts/coolify-deploy-status.sh`'],
    ['the scripts/ folder', 'every test under `scripts/`'],
    ['a file of another type', 'see `scripts/README.md`']
  ])('skips %s', (_name, text) => {
    expect(scriptPaths(text)).toEqual({ repo: [], unknown: [] });
  });

  it.each([
    ['./', 'run `./scripts/x.sh`', './scripts/x.sh'],
    ['a variable', 'run "$ROOT"/scripts/x.sh', '/scripts/x.sh'],
    ['a longer word', 'run `myscripts/x.ts`', 'myscripts/x.ts'],
    ['another folder before build/', 'run `x/build/scripts/a.js`', 'x/build/scripts/a.js'],
    ['another folder after build/', 'run `build/x/scripts/a.js`', 'build/x/scripts/a.js']
  ])('reports a path after %s as unknown', (_name, text, found) => {
    expect(scriptPaths(text)).toEqual({ repo: [], unknown: [{ path: found, line: 1 }] });
  });
});

/** Each scripts/ path in the agent docs under root that is missing or unread. */
function problems(root = ROOT): string[] {
  return docs(root).flatMap((doc) => {
    const { repo, unknown } = scriptPaths(fs.readFileSync(path.join(root, doc), 'utf8'));
    return [
      ...repo
        .filter((p) => !fs.existsSync(path.join(root, p.path)))
        .map((p) => `${doc}:${p.line} ${p.path} does not exist`),
      ...unknown.map(
        (p) => `${doc}:${p.line} ${p.path}: a prefix scriptPaths does not read, teach it the form`
      )
    ];
  });
}

/** Runs check on a temporary folder that holds files (path: text). */
function withFiles(files: Record<string, string>, check: (root: string) => void) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'doc-script-paths-'));
  try {
    for (const [file, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      fs.writeFileSync(path.join(root, file), text);
    }
    check(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

describe('docs', () => {
  it('lists the agent docs, not plans, other checkouts or other files', () => {
    const files = [
      'AGENTS.md',
      'README.md',
      'docs/agents/testing.md',
      'docs/superpowers/plan.md',
      '.claude/agents/a.md',
      '.claude/rule-hook/rules/r.md',
      '.claude/skills/s/SKILL.md',
      '.claude/settings.json',
      '.claude/worktrees/w/AGENTS.md',
      'src/x.md'
    ];
    withFiles(Object.fromEntries(files.map((file) => [file, ''])), (root) => {
      expect(docs(root).sort()).toEqual([
        '.claude/agents/a.md',
        '.claude/rule-hook/rules/r.md',
        '.claude/skills/s/SKILL.md',
        'AGENTS.md',
        'README.md',
        'docs/agents/testing.md'
      ]);
    });
  });
});

describe('problems', () => {
  it('reports a missing script and an unknown form, with their doc and line', () => {
    const files = {
      'AGENTS.md': 'Run `scripts/a.ts`.\nRun `scripts/gone.mjs`.\nRun `./scripts/a.ts`.',
      'README.md': '',
      'docs/agents/x.md': '',
      '.claude/x.md': '',
      'scripts/a.ts': ''
    };
    withFiles(files, (root) => {
      expect(problems(root)).toEqual([
        'AGENTS.md:2 scripts/gone.mjs does not exist',
        'AGENTS.md:3 ./scripts/a.ts: a prefix scriptPaths does not read, teach it the form'
      ]);
    });
  });
});

describe('agent docs', () => {
  it('name only scripts that exist, in forms this test reads', () => {
    expect(problems()).toEqual([]);
  });
});

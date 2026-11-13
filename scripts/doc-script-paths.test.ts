// Every repo script an agent doc names exists. The rule-hook rules and the
// i18n-add-key skill named scripts/lint-i18n.mjs as the i18n gate after it
// became lint-i18n.ts, and before any parity check existed (#723).
import { describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.join(import.meta.dir, '..');

// The docs agents read: the files AGENTS.md points to for setup, then every
// Markdown file under docs/agents/, .claude/ (rules, skills, agents) and
// .agents/ (skills). docs/superpowers/ holds dated plans that name files as
// they were then, and graphify-out/ is generated. .claude/worktrees/ is
// git-ignored: Claude Code's worktree mode puts other checkouts there, on
// other branches.
const DOC_FILES = ['AGENTS.md', 'README.md', 'docs/claude-setup.md'];
const DOC_FOLDERS = ['docs/agents', '.claude', '.agents'];
const OTHER_CHECKOUTS = path.join('.claude', 'worktrees');

function docs(root = ROOT): string[] {
  const out = [...DOC_FILES];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (rel !== OTHER_CHECKOUTS) walk(rel);
      } else if (entry.name.endsWith('.md')) out.push(rel);
    }
  };
  for (const dir of DOC_FOLDERS) walk(dir);
  return out;
}

// A path that starts at scripts/, whatever its file type, the rest of its
// word before scripts/ (the prefix) and the character after the path. A
// space, a backtick, a quote or an opening parenthesis ends the word. The
// path ends at the first character that a file name here does not use, and
// dots that end a sentence are cut.
const SCRIPT_PATH = /([^\s`'"(]*)scripts\/[\w./-]*(?=(.?))/g;

// What may follow a whole path: the end of the line, a space, a backtick, a
// quote, a closing parenthesis, a comma, a colon or a semicolon. Any other
// character cut the name short (`scripts/<name>.ts`, `scripts/$X.sh`, a
// letter outside ASCII), except the `*` of a glob (`"scripts/*.ts"` in the
// fallow skill's config examples), which names no one file.
const PATH_END = /^[\s`'"),:;]?$/;

// The prefixes of a path that is not this repo's: the build output
// (`bun build/scripts/export-user.js`) and a skill in the home directory
// (`~/.agents/skills/forgejo-issues/scripts/forgejo.py`).
const OTHER_PREFIX = /^(?:build\/|~\/\.agents\/skills\/[\w-]+\/)$/;

// A path in another repo, which the doc names right before it.
const OTHER_REPO = /homelab-stacks `$/;

type Found = { path: string; line: number };

/**
 * The scripts/ paths in a doc's text, with their line. `repo` holds the paths
 * that name this repo's files or folders, `unknown` those in a form this test
 * does not read, which may name this repo's files too: a prefix it does not
 * know (`./scripts/x.sh`), or a name cut short (`scripts/<`).
 */
function scriptPaths(text: string): { repo: Found[]; unknown: Found[] } {
  const repo: Found[] = [];
  const unknown: Found[] = [];
  text.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(SCRIPT_PATH)) {
      const found = { path: m[0].replace(/\.+$/, ''), line: i + 1 };
      if (m[1] !== '') {
        if (!OTHER_PREFIX.test(m[1])) unknown.push(found);
      } else if (m[2] === '*') continue;
      else if (!PATH_END.test(m[2])) unknown.push({ path: m[0] + m[2], line: i + 1 });
      else if (!OTHER_REPO.test(line.slice(0, m.index))) repo.push(found);
    }
  });
  return { repo, unknown };
}

describe('scriptPaths', () => {
  it.each([
    ['a .ts file', 'run `scripts/lint-i18n.ts`', 'scripts/lint-i18n.ts'],
    ['a .mjs file', 'run `scripts/lint-i18n.mjs`', 'scripts/lint-i18n.mjs'],
    ['a .sh file', '`scripts/wait-e2e-slot.sh && git push`', 'scripts/wait-e2e-slot.sh'],
    ['a .json file', 'in `scripts/bundle-budget.json`,', 'scripts/bundle-budget.json'],
    ['a file of another type', 'see `scripts/README.md`', 'scripts/README.md'],
    ['a file with no extension', 'run `scripts/gone`', 'scripts/gone'],
    ['the scripts/ folder', 'every test under `scripts/`', 'scripts/'],
    ['a file in a subfolder', 'run `scripts/sub/x.ts`', 'scripts/sub/x.ts'],
    ['a file with a dot in its name', 'run `scripts/x.test.ts`', 'scripts/x.test.ts'],
    ['a path after a space', 'run scripts/x.sh first', 'scripts/x.sh'],
    ['a path at the end of the line', 'run scripts/x.sh', 'scripts/x.sh'],
    ['a path before a comma', 'run scripts/x.sh, then', 'scripts/x.sh'],
    ['a path before a semicolon', 'run scripts/x.sh; then', 'scripts/x.sh'],
    ['a path in double quotes', 'run "scripts/x.sh"', 'scripts/x.sh'],
    ['a path in single quotes', "run 'scripts/x.sh'", 'scripts/x.sh'],
    ['a path in parentheses', 'a script (scripts/x.sh)', 'scripts/x.sh'],
    ['a path at the end of a sentence', 'see scripts/x.ts.', 'scripts/x.ts'],
    ['a path with a line number', 'see `scripts/x.ts:12`', 'scripts/x.ts']
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
    ['a glob', '"entry": ["src/index.ts", "scripts/*.ts"],']
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

  it.each([
    ['a placeholder', 'run `scripts/<name>.ts`', 'scripts/<'],
    ['a list in braces', 'run `scripts/{a,b}.ts`', 'scripts/{'],
    ['a variable', 'run `scripts/$X.sh`', 'scripts/$'],
    ['a letter outside ASCII', 'run `scripts/régénérer.ts`', 'scripts/ré']
  ])('reports a name cut short by %s as unknown', (_name, text, found) => {
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
        (p) => `${doc}:${p.line} ${p.path}: a form scriptPaths does not read, teach it the form`
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

// The files and folders docs() reads, each with one Markdown file in it.
const DOC_TREE = {
  'AGENTS.md': '',
  'README.md': '',
  'docs/claude-setup.md': '',
  'docs/agents/x.md': '',
  '.claude/x.md': '',
  '.agents/x.md': ''
};

describe('docs', () => {
  it('lists the agent docs, not plans, other checkouts or other files', () => {
    const files = [
      'AGENTS.md',
      'README.md',
      'docs/claude-setup.md',
      'docs/agents/testing.md',
      'docs/other.md',
      'docs/superpowers/plan.md',
      '.agents/skills/s/SKILL.md',
      '.claude/agents/a.md',
      '.claude/rule-hook/rules/r.md',
      '.claude/skills/s/SKILL.md',
      '.claude/skills/worktrees/SKILL.md',
      '.claude/settings.json',
      '.claude/worktrees/w/AGENTS.md',
      'src/x.md'
    ];
    withFiles(Object.fromEntries(files.map((file) => [file, ''])), (root) => {
      expect(docs(root).sort()).toEqual([
        '.agents/skills/s/SKILL.md',
        '.claude/agents/a.md',
        '.claude/rule-hook/rules/r.md',
        '.claude/skills/s/SKILL.md',
        '.claude/skills/worktrees/SKILL.md',
        'AGENTS.md',
        'README.md',
        'docs/agents/testing.md',
        'docs/claude-setup.md'
      ]);
    });
  });
});

describe('problems', () => {
  it.each(Object.keys(DOC_TREE))(
    'reports a missing script and an unknown form in %s, with the line',
    (doc) => {
      const files = {
        ...DOC_TREE,
        [doc]: 'Run `scripts/a.ts`.\nRun `scripts/gone.mjs`.\nRun `./scripts/a.ts`.',
        'scripts/a.ts': ''
      };
      withFiles(files, (root) => {
        expect(problems(root)).toEqual([
          `${doc}:2 scripts/gone.mjs does not exist`,
          `${doc}:3 ./scripts/a.ts: a form scriptPaths does not read, teach it the form`
        ]);
      });
    }
  );
});

describe('agent docs', () => {
  it('name only scripts that exist, in forms this test reads', () => {
    expect(problems()).toEqual([]);
  });
});

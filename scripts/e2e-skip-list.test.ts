// scripts/e2e-needed.sh lets a PR that changes only agent tooling skip E2E
// and the three build jobs (#718). That holds while no file the E2E job or
// the build reads names an agent-tooling path, which this file checks on the
// repo itself and, red case by red case, on throwaway fixture trees.
//
// It reads:
//   - GUARDED_FILES and every file under GUARDED_DIRS, as text: a hit is a
//     needle (NEEDLES) in the raw text, or in the text with each \xHH,
//     \uHHHH and \u{H…} escape decoded, the escapes JavaScript, JSON, TOML
//     and shell $'…' strings share;
//   - every file under .forgejo/workflows/ through Bun's YAML parser, so a
//     comment does not count (ci.yml's unit job names
//     scripts/e2e-slot-rule.test.ts in one), while a key or value spelled
//     with an escape, an alias or a block scalar does.
// A missing guarded file or directory, a workflow that is not .yml or
// .yaml, a workflow the parser rejects and a Bun with no YAML parser fail
// the check rather than pass it.
//
// It cannot see a read that names no listed path: a glob or a directory
// read (`ls scripts/*hook*`, a whole-tree COPY in the Dockerfile), a name
// built at run time (string concatenation, String.fromCharCode, a shell
// octal escape), or a scan, as Tailwind's source detection reads every file
// .gitignore keeps. Tailwind is the one such read today, and the header of
// scripts/e2e-needed.sh says what it can change.
import { describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

type Parse = (text: string) => unknown;

const ROOT = path.resolve(import.meta.dir, '..');
const SCRIPT = path.join(ROOT, 'scripts', 'e2e-needed.sh');

// The agent-tooling arm of the script's `case`, pattern by pattern. A test
// below fails when the script's arm differs.
const AGENT_TOOLING = [
  '.claude/*',
  'scripts/rule-hook.ts',
  'scripts/rule-hook.test.ts',
  'scripts/e2e-slot-rule.test.ts'
];

// What counts as naming a listed path: the directory name for `.claude/*`,
// and for a file its name up to the first dot, which an import without
// extension (`./rule-hook`) and a path.join of its parts both hold.
function needle(pattern: string): string {
  if (pattern.endsWith('/*')) return pattern.slice(0, -2);
  return path.basename(pattern).split('.')[0];
}
const NEEDLES = [...new Set(AGENT_TOOLING.map(needle))];

// Files the build, the image or the E2E job reads by name.
const GUARDED_FILES = [
  'package.json',
  'bunfig.toml',
  'playwright.config.ts',
  'vite.config.ts',
  'tsconfig.json',
  'paraglide.config.ts',
  'project.inlang/settings.json',
  'railpack.json',
  'Dockerfile'
];
// Directories whose every file the build, the image or the E2E job may read.
const GUARDED_DIRS = ['src', 'e2e', 'static', 'messages', 'drizzle'];
const WORKFLOWS = '.forgejo/workflows';

function decodeEscapes(text: string): string {
  return text
    .replace(/\\x([0-9a-fA-F]{2})/g, (_m, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_m, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_m, h: string) => String.fromCharCode(parseInt(h, 16)));
}

function filesUnder(root: string, dir: string): string[] {
  const entries = readdirSync(path.join(root, dir), { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile())
    .map((e) => path.relative(root, path.join(e.parentPath, e.name)))
    .sort();
}

// Every string a parsed YAML document holds, keys included.
function yamlStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value !== null && typeof value === 'object')
    return Object.entries(value).flatMap(([k, v]) => [k, ...yamlStrings(v)]);
  return [];
}

function hits(file: string, texts: string[]): string[] {
  return NEEDLES.filter((n) => texts.some((t) => t.includes(n))).map((n) => `${file}: names ${n}`);
}

// Each guarded file that names an agent-tooling path, as `<file>: names
// <needle>`. Throws when it cannot read what it guards.
function namedAgentTooling(
  root: string,
  parseYaml: Parse | null = (Bun as { YAML?: { parse?: Parse } }).YAML?.parse ?? null
): string[] {
  if (!parseYaml) throw new Error(`Bun ${Bun.version} has no YAML parser`);
  const text = (file: string) => {
    try {
      return readFileSync(path.join(root, file), 'utf8');
    } catch {
      throw new Error(`${file}: cannot read it; update GUARDED_FILES or GUARDED_DIRS`);
    }
  };
  const dirFiles = (dir: string) => {
    try {
      return filesUnder(root, dir);
    } catch {
      throw new Error(`${dir}/: cannot list it; update GUARDED_FILES or GUARDED_DIRS`);
    }
  };
  const found: string[] = [];
  for (const file of [...GUARDED_FILES, ...GUARDED_DIRS.flatMap(dirFiles)]) {
    const raw = text(file);
    found.push(...hits(file, [raw, decodeEscapes(raw)]));
  }
  for (const file of dirFiles(WORKFLOWS)) {
    if (!/\.ya?ml$/.test(file)) throw new Error(`${file}: not .yml or .yaml, so not read`);
    let parsed: unknown;
    try {
      parsed = parseYaml(text(file));
    } catch (e) {
      throw new Error(`${file}: not readable as YAML (${String(e).split('\n')[0]})`, {
        cause: e
      });
    }
    found.push(...hits(file, yamlStrings(parsed)));
  }
  return found;
}

// A tree holding every guarded file and directory, none of them naming a
// listed path, with `files` written over it.
function fixture(files: Record<string, string> = {}): string {
  const root = mkdtempSync(path.join(tmpdir(), 'e2e-skip-list-test-'));
  const base: Record<string, string> = {
    ...Object.fromEntries(GUARDED_FILES.map((f) => [f, 'plain\n'])),
    ...Object.fromEntries(GUARDED_DIRS.map((d) => [`${d}/a/file.txt`, 'plain\n'])),
    [`${WORKFLOWS}/ci.yml`]: 'on: push\njobs:\n  a:\n    steps:\n      - run: bun run build\n'
  };
  for (const [file, content] of Object.entries({ ...base, ...files })) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), content);
  }
  return root;
}

function check(files: Record<string, string>) {
  const root = fixture(files);
  try {
    return namedAgentTooling(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe('the skip list of scripts/e2e-needed.sh', () => {
  it('has the Markdown and docs/ arm, then the AGENT_TOOLING arm, and no other', () => {
    const arms = [...readFileSync(SCRIPT, 'utf8').matchAll(/^ {4}(\S.*)\) ;;$/gm)].map((m) => m[1]);
    expect(arms).toEqual(['docs/* | *.md', AGENT_TOOLING.join(' | ')]);
  });

  it('reads one needle per listed name', () => {
    expect(NEEDLES).toEqual(['.claude', 'rule-hook', 'e2e-slot-rule']);
  });
});

describe('no file the E2E job or the build reads names agent tooling', () => {
  it('holds on this repo', () => {
    expect(namedAgentTooling(ROOT)).toEqual([]);
  });

  // The floor #718's brief names; the it.each cases below read the lists
  // themselves, so they cannot tell when an entry goes.
  it('guards at least the files and directories #718 names', () => {
    expect(GUARDED_FILES).toEqual(
      expect.arrayContaining([
        'package.json',
        'bunfig.toml',
        'playwright.config.ts',
        'vite.config.ts',
        'tsconfig.json',
        'paraglide.config.ts',
        'Dockerfile'
      ])
    );
    expect(GUARDED_DIRS).toEqual(expect.arrayContaining(['src', 'e2e']));
    expect(WORKFLOWS).toBe('.forgejo/workflows');
  });

  it('passes a fixture that names nothing', () => {
    expect(check({})).toEqual([]);
  });

  it('passes a workflow comment that names a listed script', () => {
    const ci = '# runs scripts/e2e-slot-rule.test.ts\non: push\n';
    expect(check({ [`${WORKFLOWS}/ci.yml`]: ci })).toEqual([]);
  });

  it.each(GUARDED_FILES)('fails when %s names a listed script', (file) => {
    expect(check({ [file]: 'run scripts/rule-hook.ts\n' })).toEqual([`${file}: names rule-hook`]);
  });

  it.each(GUARDED_DIRS)('fails when a file deep under %s/ names .claude/', (dir) => {
    const file = `${dir}/x/y/z.ts`;
    expect(check({ [file]: "readFileSync('.claude/settings.json')\n" })).toEqual([
      `${file}: names .claude`
    ]);
  });

  it.each(AGENT_TOOLING)('fails when src/ names %s', (listed) => {
    expect(check({ 'src/x.ts': `import '../${listed}';\n` })).toEqual([
      `src/x.ts: names ${needle(listed)}`
    ]);
  });

  it.each([
    ['\\x2d', "'scripts/rule\\x2dhook.ts'"],
    ['\\u002d', '"scripts/rule\\u002dhook.ts"'],
    ['\\u{2d}', '`scripts/rule\\u{2d}hook.ts`']
  ])('fails when src/ spells a listed script with a %s escape', (_name, literal) => {
    expect(check({ 'src/x.ts': `read(${literal});\n` })).toEqual(['src/x.ts: names rule-hook']);
  });

  it('fails when package.json spells .claude with a JSON escape', () => {
    const pkg = '{ "scripts": { "x": "cat \\u002eclaude/settings.json" } }\n';
    expect(check({ 'package.json': pkg })).toEqual(['package.json: names .claude']);
  });

  it.each([
    ['a plain run value', 'jobs:\n  a:\n    steps:\n      - run: bun scripts/rule-hook.ts\n'],
    [
      'an escape in a double-quoted string',
      'jobs:\n  a:\n    steps:\n      - run: "bun scripts/rule\\x2dhook.ts"\n'
    ],
    [
      'a block scalar',
      'jobs:\n  a:\n    steps:\n      - run: |\n          echo hi\n          bun scripts/rule-hook.ts\n'
    ],
    ['an alias', 'x: &s bun scripts/rule-hook.ts\njobs:\n  a:\n    steps:\n      - run: *s\n'],
    ['a key', 'env:\n  scripts/rule-hook.ts: 1\n']
  ])('fails when a workflow names a listed script through %s', (_name, yaml) => {
    expect(check({ [`${WORKFLOWS}/ci.yml`]: `on: push\n${yaml}` })).toEqual([
      `${WORKFLOWS}/ci.yml: names rule-hook`
    ]);
  });

  it('reads a .yaml workflow next to ci.yml', () => {
    expect(check({ [`${WORKFLOWS}/other.yaml`]: 'run: cat .claude/x\n' })).toEqual([
      `${WORKFLOWS}/other.yaml: names .claude`
    ]);
  });

  it.each([...GUARDED_FILES, ...GUARDED_DIRS.map((d) => `${d}/`), `${WORKFLOWS}/`])(
    'throws when %s is missing',
    (gone) => {
      const root = fixture();
      try {
        rmSync(path.join(root, gone), { recursive: true });
        expect(() => namedAgentTooling(root)).toThrow(
          `${gone}: cannot ${gone.endsWith('/') ? 'list' : 'read'} it`
        );
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    }
  );

  it('throws on a workflow file that is not .yml or .yaml', () => {
    expect(() => check({ [`${WORKFLOWS}/notes.txt`]: 'plain\n' })).toThrow(
      `${WORKFLOWS}/notes.txt: not .yml or .yaml, so not read`
    );
  });

  it('throws on a workflow the parser rejects', () => {
    expect(() => check({ [`${WORKFLOWS}/ci.yml`]: 'a: [1,\n' })).toThrow(
      `${WORKFLOWS}/ci.yml: not readable as YAML`
    );
  });

  it('throws when Bun has no YAML parser', () => {
    const root = fixture();
    try {
      expect(() => namedAgentTooling(root, null)).toThrow('has no YAML parser');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

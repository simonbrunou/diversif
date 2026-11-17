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
// It also fails on three reads that need no name:
//   - a glob in a guarded file or a workflow that matches a listed path;
//   - code outside src/'s unit tests that reads files or runs a command
//     through node:fs, Bun.file, Bun.Glob, import.meta.glob, a readdir or
//     glob call, an import from 'bun', node:child_process or an exec or
//     spawn call (FS_READ), but for the lines KNOWN_READS lists;
//   - a Dockerfile COPY or ADD of a directory that holds a listed path, but
//     for the builder stage's `COPY . .`.
// A missing guarded file or directory, a workflow that is not .yml or
// .yaml, a workflow the parser rejects, a workflow holding a binary tag, a
// %-escape inside a tag or a %TAG directive (Bun's parser returns a binary
// value as base64 text, and the runner's Go parser decodes %-escaped tags),
// a COPY in JSON or heredoc form and a Bun with no YAML parser fail the
// check rather than pass it.
//
// It cannot see a name built at run time: string concatenation,
// String.fromCharCode, a shell octal escape, a variable holding a path, a
// path relative to a `cd`, as in a workflow's `run:` script. It does not
// follow imports, so an E2E spec that imports a helper under src/test/,
// which may read files, goes unseen; none does today. Nor can it see
// a read of a whole directory named without a glob (`bun test scripts/`,
// `cp -r scripts`): package.json's test:watch, a dev command, names
// ./scripts that way. Nor can it see a scan: Tailwind's source detection
// reads every file .gitignore keeps, the one such read today, and the
// header of scripts/e2e-needed.sh says what it can change.
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
// A tag naming binary (!!binary, !<tag:yaml.org,2002:binary>, !x!binary)
// or a %TAG directive, which can give any handle that meaning.
const BINARY_TAG = /![^\s]*(binary|%)|^%TAG/m;

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

// Paths the listed patterns cover, for the glob and directory checks.
const SAMPLES = [
  '.claude/settings.json',
  '.claude/rule-hook/hook.py',
  ...AGENT_TOOLING.filter((p) => !p.endsWith('/*'))
];

// A glob in a guarded config file or a workflow that matches a listed path
// (`ls scripts/*hook*`). App and E2E code pass globs to calls, which
// FS_READ below catches instead: their text holds `**` for bold Markdown and
// `*/*` in comments, which would match too.
const GLOB_TOKEN = /[\w.@/{},-]*[*?][\w.@/{},*?-]*/g;
function globHits(file: string, texts: string[]): string[] {
  const out = new Set<string>();
  for (const t of texts)
    for (const [token] of t.matchAll(GLOB_TOKEN)) {
      const glob = new Bun.Glob(token.replace(/^(\.|\/app)\//, ''));
      const sample = SAMPLES.find((s) => glob.match(s));
      if (sample) out.add(`${file}: glob ${token} matches ${sample}`);
    }
  return [...out];
}

// The forms through which code reads a file it need not name. The tests
// under src/ and the helpers under src/test/ run in the unit job only, which
// runs on every PR; a test under e2e/ runs in the E2E job, so it counts.
const CODE = /\.([cm]?[jt]s|[jt]sx|svelte)$/;
// Anything imported from 'bun' (its $ shell, spawn, file) counts, and so
// does each call of an exec or spawn function, so that a new command next to
// a known import still fails.
const FS_READ =
  /node:fs|['"]fs(\/promises)?['"]|Bun\.(Glob|file|spawn|\$)|from\s*['"]bun['"]|(require|import)\s*\(\s*['"`]bun['"`]|readdir|\bglob(Sync)?\(|child_process|(?<![.\w])(exec|execFile|spawn)(Sync)?\(/;
// Lines that match FS_READ on purpose, by file, each with what it runs.
const KNOWN_READS: Record<string, string[]> = {
  // resolveSentryRelease runs `git rev-parse HEAD`, which reads no listed path.
  'vite.config.ts': [
    "import { execFileSync } from 'node:child_process';",
    "return execFileSync('git', ['rev-parse', 'HEAD'], {"
  ]
};
function readHits(file: string, raw: string): string[] {
  const unitOnly =
    file.startsWith('src/') && (file.endsWith('.test.ts') || file.startsWith('src/test/'));
  if (!CODE.test(file) || unitOnly) return [];
  for (const line of raw.split('\n')) {
    // A type-only import reads nothing; the rest of its line still counts.
    const m = line
      .replace(/^\s*import\s+type\s*\{[^}]*\}\s*from\s*['"][^'"]*['"];?/, '')
      .match(FS_READ);
    if (m && !KNOWN_READS[file]?.includes(line.trim()))
      return [`${file}: reads files through ${m[0]}, which may reach a listed path`];
  }
  return [];
}

// A COPY or ADD of a directory that holds a listed path. The builder
// stage's `COPY . .` is the one today: its files reach the image only
// through `bun run build`, which the header of scripts/e2e-needed.sh
// covers. A COPY in JSON or heredoc form throws: read it by hand.
function copyHits(raw: string): string[] {
  const out: string[] = [];
  let stage = '';
  for (const line of raw.replace(/\\\n/g, ' ').split('\n')) {
    const from = line.match(/^\s*FROM\s.*\sAS\s+(\S+)/i);
    if (/^\s*FROM\s/i.test(line)) stage = from ? from[1] : '';
    const m = line.match(/^\s*(COPY|ADD)\s+(.*)$/i);
    if (!m) continue;
    if (/^\[|<</.test(m[2])) throw new Error(`Dockerfile: ${m[1]} ${m[2]}: form not read`);
    if (stage === 'builder' && /^\s*COPY \. \.\s*$/.test(line)) continue;
    // A flag (--from=builder) names no directory, so it never matches.
    const sources = m[2].split(/\s+/).filter(Boolean).slice(0, -1);
    for (const src of sources.filter(holdsListedPath))
      out.push(`Dockerfile: ${m[1]} ${src} copies a listed path`);
  }
  return out;
}

// Whether a COPY source, in the build context or the builder's /app, is a
// directory that holds a listed path.
function holdsListedPath(src: string): boolean {
  const dir =
    src
      .replace(/^\/app(\/|$)/, '')
      .replace(/^\.\//, '')
      .replace(/\/+$/, '') || '.';
  return dir === '.' || SAMPLES.some((s) => s.startsWith(`${dir}/`));
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
    const texts = [raw, decodeEscapes(raw)];
    found.push(...hits(file, texts), ...readHits(file, raw));
    if (GUARDED_FILES.includes(file)) found.push(...globHits(file, texts));
    if (file === 'Dockerfile') found.push(...copyHits(raw));
  }
  for (const file of dirFiles(WORKFLOWS)) {
    if (!/\.ya?ml$/.test(file)) throw new Error(`${file}: not .yml or .yaml, so not read`);
    const raw = text(file);
    // Bun's parser hands a binary value back as its base64 text.
    if (BINARY_TAG.test(raw))
      throw new Error(`${file}: a binary tag or a %TAG directive hides a value from the parser`);
    let parsed: unknown;
    try {
      parsed = parseYaml(raw);
    } catch (e) {
      throw new Error(`${file}: not readable as YAML (${String(e).split('\n')[0]})`, {
        cause: e
      });
    }
    const strings = yamlStrings(parsed);
    found.push(...hits(file, strings), ...globHits(file, strings));
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

  it.each([
    ['Dockerfile', 'RUN ls scripts/*-hook.ts\n', 'scripts/*-hook.ts', 'scripts/rule-hook.ts'],
    [
      'Dockerfile',
      'COPY --from=builder /app/scripts/*.ts ./scripts/\n',
      '/app/scripts/*.ts',
      'scripts/rule-hook.ts'
    ],
    ['package.json', '{ "x": "cat .c*/**" }\n', '.c*/**', '.claude/settings.json'],
    [
      'vite.config.ts',
      "exclude: ['./scripts/*.test.ts']\n",
      './scripts/*.test.ts',
      'scripts/rule-hook.test.ts'
    ]
  ])('fails when %s holds a glob that matches a listed path', (file, content, glob, sample) => {
    expect(check({ [file]: content })).toEqual([`${file}: glob ${glob} matches ${sample}`]);
  });

  it('fails when a workflow holds a glob that matches a listed path', () => {
    const ci = 'on: push\njobs:\n  a:\n    steps:\n      - run: bun test scripts/e2e-*\n';
    expect(check({ [`${WORKFLOWS}/ci.yml`]: ci })).toEqual([
      `${WORKFLOWS}/ci.yml: glob scripts/e2e-* matches scripts/e2e-slot-rule.test.ts`
    ]);
  });

  it('passes a glob that matches no listed path', () => {
    expect(check({ 'vite.config.ts': "['./build/**/*.map', 'src/**/*.ts']\n" })).toEqual([]);
  });

  it.each([
    "import { readFileSync } from 'node:fs';",
    "import fs from 'fs';",
    "import { readFile } from 'fs/promises';",
    "const pages = import.meta.glob('./*.svelte');",
    'const g = new Bun.Glob(pattern);',
    'const f = Bun.file(name);',
    'const names = readdirSync(dir);',
    'const names = globSync(pattern);',
    'await Bun.$`ls`;',
    "import { $ } from 'bun'; await $`ls`;",
    "Bun.spawn(['ls']);",
    "import { execSync } from 'node:child_process';",
    "import { spawn } from 'bun';",
    "import * as bun from 'bun';",
    "const { file } = require('bun');",
    "const out = execFileSync('ls', ['x']);",
    "spawnSync('ls');",
    "const b = await import('bun');",
    'const b = await import (`bun`);',
    "import type { X } from 'bun'; Bun.spawn(['ls']);",
    "import type from 'bun';"
  ])('fails when E2E code reads files through %s', (line) => {
    const hit = check({ 'e2e/x.spec.ts': `${line}\n` });
    expect(hit).toHaveLength(1);
    expect(hit[0]).toMatch(
      /^e2e\/x\.spec\.ts: reads files through .+, which may reach a listed path$/
    );
  });

  it.each(['src/lib/x.test.ts', 'src/test/helper.ts', 'static/icon.png'])(
    'lets %s read files: the unit job runs it, or it is not code',
    (file) => {
      expect(check({ [file]: "import { readdirSync } from 'node:fs';\n" })).toEqual([]);
    }
  );

  it.each(['e2e/x.test.ts', 'e2e/helper.mts', 'src/lib/x.cts', 'src/lib/X.tsx'])(
    'fails when %s reads files: the unit job does not run it alone',
    (file) => {
      expect(check({ [file]: "import { readdirSync } from 'node:fs';\n" })).toEqual([
        `${file}: reads files through readdir, which may reach a listed path`
      ]);
    }
  );

  it('lets vite.config.ts run `git rev-parse HEAD`, and no other read', () => {
    const known =
      "import { execFileSync } from 'node:child_process';\n" +
      "    return execFileSync('git', ['rev-parse', 'HEAD'], {\n";
    expect(check({ 'vite.config.ts': known })).toEqual([]);
    expect(check({ 'vite.config.ts': `${known}const f = Bun.file(x);\n` })).toEqual([
      'vite.config.ts: reads files through Bun.file, which may reach a listed path'
    ]);
    expect(check({ 'vite.config.ts': `${known}execFileSync('git', ['grep', 'x']);\n` })).toEqual([
      'vite.config.ts: reads files through execFileSync(, which may reach a listed path'
    ]);
    expect(check({ 'playwright.config.ts': known })).toEqual([
      'playwright.config.ts: reads files through child_process, which may reach a listed path'
    ]);
  });

  it('passes a type-only import from bun', () => {
    expect(check({ 'src/lib/server/x.ts': "import type { Server } from 'bun';\n" })).toEqual([]);
  });

  it('passes a $ before a backquote outside an import from bun', () => {
    expect(check({ 'e2e/x.spec.ts': 'new RegExp(`/child/${id}$`);\n' })).toEqual([]);
  });

  it.each([
    ['a listed directory', 'FROM x AS builder\nCOPY scripts ./scripts\n', 'COPY scripts'],
    ['a listed directory with a slash', 'FROM x\nCOPY scripts/ ./scripts/\n', 'COPY scripts/'],
    ['a listed directory under ./', 'FROM x\nCOPY ./scripts ./s\n', 'COPY ./scripts'],
    ['the builder tree, no slash', 'FROM y\nCOPY --from=builder /app ./\n', 'COPY /app'],
    [
      'the whole tree in the final stage',
      'FROM x AS builder\nCOPY . .\nFROM y\nCOPY . .\n',
      'COPY .'
    ],
    ['the builder tree', 'FROM y\nCOPY --from=builder \\\n  /app/ ./\n', 'COPY /app/'],
    ['the whole tree with ADD', 'FROM x AS other\nADD ./ /app\n', 'ADD ./']
  ])('fails when the Dockerfile copies %s', (_name, dockerfile, copy) => {
    expect(check({ Dockerfile: dockerfile })).toEqual([`Dockerfile: ${copy} copies a listed path`]);
  });

  it("passes the builder stage's COPY . . and a copy of named files", () => {
    const dockerfile =
      'FROM x AS builder\nCOPY . .\nFROM y\nCOPY --from=builder /app/build ./build\n' +
      'COPY --from=builder /app/scripts/cleanup.ts ./scripts/\n';
    expect(check({ Dockerfile: dockerfile })).toEqual([]);
  });

  it.each(['COPY ["a", "b"]', 'COPY <<EOF /x'])('throws on a Dockerfile %s', (line) => {
    expect(() => check({ Dockerfile: `FROM x\n${line}\n` })).toThrow('form not read');
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

  it.each([
    ['!!binary', `run: !!binary ${btoa('bun scripts/rule-hook.ts')}\n`],
    ['a verbatim binary tag', `run: !<tag:yaml.org,2002:binary> ${btoa('x')}\n`],
    ['a %TAG directive', '%TAG !y! tag:yaml.org,2002:\n---\nrun: !y!str x\n'],
    ['a %-escaped binary tag', `run: !!bin%61ry ${btoa('bun scripts/rule-hook.ts')}\n`],
    ['a %-escaped verbatim tag', `run: !<tag:yaml.org,2002:%62inary> ${btoa('x')}\n`]
  ])('throws on a workflow holding %s', (_name, yaml) => {
    expect(() => check({ [`${WORKFLOWS}/ci.yml`]: yaml })).toThrow(
      `${WORKFLOWS}/ci.yml: a binary tag or a %TAG directive hides a value from the parser`
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

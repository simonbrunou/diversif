// scripts/e2e-needed.sh against a throwaway git repo. Each test gets a repo
// whose main holds src/app.ts, README.md and docs/guide.md, and a branch,
// feature, cut from it and checked out, where the test commits its change.
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const scriptPath = path.resolve(import.meta.dir, 'e2e-needed.sh');
// A few git calls per test; a loaded CI runner stalls a process for seconds
// (#572), so the tests get 30 s instead of the 5 s default.
const TIMEOUT = 30_000;

// Keeps the host's git config (signing, hooks, default branch) out of the
// repo.
const gitEnv = {
  PATH: process.env.PATH ?? '',
  HOME: tmpdir(),
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'Test',
  GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'Test',
  GIT_COMMITTER_EMAIL: 'test@example.invalid'
};

let repo: string;

function git(...args: string[]): string {
  const r = Bun.spawnSync({ cmd: ['git', ...args], cwd: repo, env: gitEnv });
  if (r.exitCode !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr.toString()}`);
  return r.stdout.toString().trim();
}

// Writes each file (creating its directory) and commits them together.
function commit(files: Record<string, string>): string {
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
    writeFileSync(path.join(repo, file), content);
    git('add', file);
  }
  git('commit', '-q', '-m', Object.keys(files).join(', '));
  return git('rev-parse', 'HEAD');
}

function e2eNeeded(...args: string[]) {
  const r = Bun.spawnSync({ cmd: ['bash', scriptPath, ...args], cwd: repo, env: gitEnv });
  return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() };
}

beforeEach(() => {
  repo = mkdtempSync(path.join(tmpdir(), 'e2e-needed-test-'));
  git('init', '-q', '-b', 'main');
  commit({ 'src/app.ts': 'one\n', 'README.md': 'one\n', 'docs/guide.md': 'one\n' });
  git('checkout', '-q', '-b', 'feature');
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe('e2e-needed.sh', () => {
  it.each([
    ['a Markdown file at the root', { 'README.md': 'two\n' }],
    ['a Markdown file in a subdirectory', { 'src/notes.md': 'new\n' }],
    ['a file under docs/ that is not Markdown', { 'docs/diagram.svg': '<svg/>\n' }],
    ['Markdown files and docs/ together', { 'README.md': 'two\n', 'docs/guide.md': 'two\n' }]
  ])(
    'skips E2E for a change to %s',
    (_name, files) => {
      commit(files);
      expect(e2eNeeded('main')).toEqual({ code: 0, out: 'false\n', err: '' });
    },
    TIMEOUT
  );

  it.each([
    ['a source file', { 'src/app.ts': 'two\n' }],
    ['a source file next to docs', { 'src/app.ts': 'two\n', 'docs/guide.md': 'two\n' }],
    ['a file whose name only contains .md', { 'src/app.md.ts': 'new\n' }],
    ['a docs directory below the root', { 'src/docs/page.ts': 'new\n' }]
  ])(
    'runs E2E for a change to %s',
    (_name, files) => {
      commit(files);
      expect(e2eNeeded('main')).toEqual({ code: 0, out: 'true\n', err: '' });
    },
    TIMEOUT
  );

  it(
    'runs E2E for a source file moved under docs/',
    () => {
      git('mv', 'src/app.ts', 'docs/app.md');
      git('commit', '-q', '-m', 'move');
      expect(e2eNeeded('main')).toEqual({ code: 0, out: 'true\n', err: '' });
    },
    TIMEOUT
  );

  it(
    'runs E2E for a deleted source file',
    () => {
      git('rm', '-q', 'src/app.ts');
      git('commit', '-q', '-m', 'delete');
      expect(e2eNeeded('main')).toEqual({ code: 0, out: 'true\n', err: '' });
    },
    TIMEOUT
  );

  it(
    "skips E2E for a docs-only branch after main gained a source change: only the branch's commits count",
    () => {
      commit({ 'docs/guide.md': 'two\n' });
      git('checkout', '-q', 'main');
      commit({ 'src/app.ts': 'two\n' });
      git('checkout', '-q', 'feature');
      expect(e2eNeeded('main')).toEqual({ code: 0, out: 'false\n', err: '' });
    },
    TIMEOUT
  );

  it(
    'counts every commit of the branch: a docs commit after a source commit runs E2E',
    () => {
      commit({ 'src/app.ts': 'two\n' });
      commit({ 'docs/guide.md': 'two\n' });
      expect(e2eNeeded('main')).toEqual({ code: 0, out: 'true\n', err: '' });
    },
    TIMEOUT
  );

  it.each([
    ['an unknown branch', 'origin/nowhere'],
    ['an all-zero commit', '0'.repeat(40)]
  ])(
    'runs E2E, and says why, when git cannot diff from %s',
    (_name, base) => {
      commit({ 'docs/guide.md': 'two\n' });
      expect(e2eNeeded(base)).toEqual({
        code: 0,
        out: 'true\n',
        err: `e2e-needed: git cannot diff ${base}...HEAD, so E2E runs\n`
      });
    },
    TIMEOUT
  );

  // git reads "...HEAD" as HEAD...HEAD, an empty diff.
  it.each([
    ['no base', []],
    ['an empty base', ['']]
  ])(
    'runs E2E for %s',
    (_name, args) => {
      commit({ 'docs/guide.md': 'two\n' });
      expect(e2eNeeded(...args)).toEqual({ code: 0, out: 'true\n', err: '' });
    },
    TIMEOUT
  );

  it(
    'runs E2E when the branch changes nothing',
    () => {
      expect(e2eNeeded('main')).toEqual({ code: 0, out: 'true\n', err: '' });
    },
    TIMEOUT
  );
});

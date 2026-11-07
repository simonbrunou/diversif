// scripts/check-base-conflict.sh against throwaway git repos. Each test gets
// a bare "origin" whose main holds a.txt, and a clone of it, "work", where
// the pushed commits are made. A second clone, "other", stands for another
// session: it pushes to origin after work last fetched, so work's
// origin/main goes stale, as a worktree's does.
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const scriptPath = path.resolve(import.meta.dir, 'check-base-conflict.sh');
const ZERO = '0'.repeat(40);
// Each test makes a dozen git calls; a loaded CI runner stalls a process for
// seconds (#572), so the tests get 30 s instead of the 5 s default.
const TIMEOUT = 30_000;

// Keeps the host's git config (signing, hooks, default branch) out of the
// repos.
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

let root: string;
let origin: string;
let work: string;
let other: string;

function git(cwd: string, ...args: string[]): string {
  const r = Bun.spawnSync({ cmd: ['git', ...args], cwd, env: gitEnv });
  if (r.exitCode !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr.toString()}`);
  return r.stdout.toString().trim();
}

// Commits one file in a clone and returns the commit.
function commit(repo: string, file: string, content: string): string {
  writeFileSync(path.join(repo, file), content);
  git(repo, 'add', file);
  git(repo, 'commit', '-q', '-m', `${file}: ${content.trim()}`);
  return git(repo, 'rev-parse', 'HEAD');
}

function check(args: string[], opts: { stdin?: string; base?: string } = {}) {
  const r = Bun.spawnSync({
    cmd: ['bash', scriptPath, ...args],
    cwd: work,
    env: { ...gitEnv, ...(opts.base ? { FALLOW_AUDIT_BASE: opts.base } : {}) },
    stdin: opts.stdin === undefined ? 'ignore' : Buffer.from(opts.stdin)
  });
  return { code: r.exitCode, out: r.stdout.toString(), err: r.stderr.toString() };
}

beforeEach(() => {
  root = mkdtempSync(path.join(tmpdir(), 'check-base-conflict-test-'));
  origin = path.join(root, 'origin.git');
  git(root, 'init', '-q', '--bare', '-b', 'main', origin);
  const seed = path.join(root, 'seed');
  git(root, 'clone', '-q', origin, seed);
  git(seed, 'checkout', '-q', '-b', 'main');
  commit(seed, 'a.txt', 'one\n');
  git(seed, 'push', '-q', 'origin', 'main');
  work = path.join(root, 'work');
  other = path.join(root, 'other');
  git(root, 'clone', '-q', origin, work);
  git(root, 'clone', '-q', origin, other);
  git(work, 'checkout', '-q', '-b', 'feature');
});

afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('check-base-conflict.sh', () => {
  it(
    'passes a commit that merges cleanly into origin/main',
    () => {
      const sha = commit(work, 'b.txt', 'new file\n');
      const r = check([sha]);
      expect(r).toMatchObject({ code: 0, err: '' });
      expect(r.out).toContain('merges cleanly into origin/main');
    },
    TIMEOUT
  );

  it(
    'refuses a commit that conflicts with a main merged after the last fetch',
    () => {
      // The #665 case: another PR changed the same line and merged after
      // this clone last fetched.
      commit(other, 'a.txt', 'two from main\n');
      git(other, 'push', '-q', 'origin', 'HEAD:main');
      const sha = commit(work, 'a.txt', 'two from the branch\n');
      // The local ref still merges cleanly: only a fetch shows the conflict.
      expect(git(work, 'merge-tree', '--write-tree', 'origin/main', sha)).not.toContain('CONFLICT');
      const r = check([sha]);
      expect(r.code).toBe(1);
      expect(r.err).toContain('CONFLICT (content): Merge conflict in a.txt');
      expect(r.err).toContain('Merge origin/main into the branch');
    },
    TIMEOUT
  );

  it(
    'reads the pushed branches from the pre-push lines on stdin',
    () => {
      commit(other, 'a.txt', 'two from main\n');
      git(other, 'push', '-q', 'origin', 'HEAD:main');
      const conflicting = commit(work, 'a.txt', 'two from the branch\n');
      git(work, 'checkout', '-q', '-b', 'clean', 'origin/main');
      const clean = commit(work, 'c.txt', 'clean\n');
      const line = (ref: string, sha: string) =>
        `refs/heads/${ref} ${sha} refs/heads/${ref} ${ZERO}`;

      const both = check([], {
        stdin: `${line('clean', clean)}\n${line('feature', conflicting)}\n`
      });
      expect(both.code).toBe(1);
      expect(both.out).toContain(`${clean.slice(0, 7)} merges cleanly`);
      expect(both.err).toContain('Merge conflict in a.txt');

      expect(check([], { stdin: `${line('clean', clean)}\n` }).code).toBe(0);
    },
    TIMEOUT
  );

  it(
    'checks a branch pushed as HEAD or as a raw sha',
    () => {
      // `git push origin HEAD` and `git push origin <sha>:refs/heads/x` put
      // HEAD or the sha where the local ref goes.
      commit(other, 'a.txt', 'two from main\n');
      git(other, 'push', '-q', 'origin', 'HEAD:main');
      const sha = commit(work, 'a.txt', 'two from the branch\n');
      for (const localRef of ['HEAD', sha]) {
        const r = check([], { stdin: `${localRef} ${sha} refs/heads/feature ${ZERO}\n` });
        expect({ localRef, code: r.code }).toEqual({ localRef, code: 1 });
        expect(r.err).toContain('Merge conflict in a.txt');
      }
    },
    TIMEOUT
  );

  it(
    'skips a deleted branch and a tag',
    () => {
      const sha = commit(work, 'a.txt', 'two from the branch\n');
      commit(other, 'a.txt', 'two from main\n');
      git(other, 'push', '-q', 'origin', 'HEAD:main');
      // Git ends every line with a newline, the last one included.
      const r = check([], {
        stdin: `(delete) ${ZERO} refs/heads/old ${sha}\nrefs/tags/v1 ${sha} refs/tags/v1 ${ZERO}\n`
      });
      expect(r).toMatchObject({ code: 0, err: '' });
      expect(r.out).toContain('no branch to check');
    },
    TIMEOUT
  );

  it(
    'checks a stacked branch against the parent FALLOW_AUDIT_BASE names',
    () => {
      // The parent changed a.txt; the stacked branch builds on that change,
      // so it merges into the parent and would conflict with main.
      git(work, 'checkout', '-q', '-b', 'parent', 'origin/main');
      commit(work, 'a.txt', 'two from the parent\n');
      git(work, 'push', '-q', 'origin', 'parent');
      commit(other, 'a.txt', 'two from main\n');
      git(other, 'push', '-q', 'origin', 'HEAD:main');
      const sha = commit(work, 'a.txt', 'three on the parent\n');

      expect(check([sha], { base: 'origin/parent' })).toMatchObject({ code: 0, err: '' });
      expect(check([sha]).code).toBe(1);
    },
    TIMEOUT
  );

  it(
    'checks the local ref and says so when the fetch fails',
    () => {
      // The local ref already holds the conflicting main; only it can show
      // the conflict once the remote is gone.
      commit(other, 'a.txt', 'two from main\n');
      git(other, 'push', '-q', 'origin', 'HEAD:main');
      git(work, 'fetch', '-q', 'origin');
      const sha = commit(work, 'a.txt', 'two from the branch\n');
      git(work, 'remote', 'set-url', 'origin', path.join(root, 'gone.git'));
      const r = check([sha]);
      expect(r.code).toBe(1);
      expect(r.err).toContain('could not fetch origin/main; checking the local ref');
      expect(r.err).toContain('Merge conflict in a.txt');
    },
    TIMEOUT
  );

  it(
    'exits 2 on a commit git cannot find or a base with no remote',
    () => {
      expect(check(['deadbeef']).code).toBe(2);
      const sha = commit(work, 'b.txt', 'new file\n');
      const r = check([sha], { base: 'main' });
      expect(r.code).toBe(2);
      expect(r.err).toContain("base 'main' is not <remote>/<branch>");
    },
    TIMEOUT
  );

  it(
    'exits 2 on a base branch the remote does not have',
    () => {
      const sha = commit(work, 'b.txt', 'new file\n');
      const r = check([sha], { base: 'origin/nope' });
      expect(r.code).toBe(2);
      expect(r.err).toContain('no commit at origin/nope');
    },
    TIMEOUT
  );

  it(
    'exits 2 when git merge-tree fails, on a commit with no common history',
    () => {
      git(work, 'checkout', '-q', '--orphan', 'lone');
      const sha = commit(work, 'z.txt', 'unrelated\n');
      const r = check([sha]);
      expect(r.code).toBe(2);
      expect(r.err).toContain('git merge-tree failed');
    },
    TIMEOUT
  );
});

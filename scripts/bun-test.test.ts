// scripts/bun-test.ts, the per-file test runner, on one fixture test file per
// test, written to a temp dir outside src/, eslint-rules/ and scripts/, where
// the runner's default run would pick it up. A failed file's dump must reach
// the log in full, however late the log's reader drains the runner's stderr
// (#683): in main run 510 the dump of a 1601-case file stopped after the
// first 160 KiB and never named its one fail. So the failure cases read
// stderr through a pipe whose reader starts only once the runner has exited,
// or after READER_DELAY_TENTHS tenths of a second if it is still running: a
// runner that hands the rest of its dump to the event loop and exits loses
// it, and one that writes synchronously waits for the reader.
import { afterAll, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const runner = path.join(import.meta.dir, 'bun-test.ts');
const base = mkdtempSync(path.join(tmpdir(), 'bun-test-runner-'));
let caseNumber = 0;

// Each test runs the runner, which runs bun test on the fixture, and waits
// for the reader's delay: under CI's load that can pass the runner's 5 s
// default (#687, #690). The removal gets the same room (#691).
const TIMEOUT = 30_000;
const READER_DELAY_TENTHS = 20;

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
}, TIMEOUT);

// Bun prints (pass) lines only when none of these is set, as in CI
// (docs/agents/testing.md). The fixture's dump needs them: they are what the
// runner's first block leaves out. The runner starts `bun` from PATH, so the
// Bun running this file goes first.
const env: Record<string, string | undefined> = {
  ...process.env,
  PATH: `${path.dirname(process.execPath)}:${process.env.PATH ?? ''}`
};
delete env.CLAUDECODE;
delete env.AGENT;
delete env.REPL_ID;

const FILE = 'fixture/case.test.ts';
const PASSES = 2000;
// About 214 KB of (pass) lines, more than three times the 64 KiB a Linux pipe holds.
const passingCases = `import { afterAll, expect, it } from 'bun:test';
for (let i = 1; i <= ${PASSES}; i++) {
  it(\`case \${String(i).padStart(4, '0')} of the fixture, with a name long enough that its (pass) lines fill a pipe many times over\`, () => {});
}
`;

/** A directory holding `fixture/case.test.ts` with `source`, for the runner to run from. */
function fixture(source: string): string {
  caseNumber += 1;
  const dir = path.join(base, String(caseNumber));
  mkdirSync(path.join(dir, 'fixture'), { recursive: true });
  writeFileSync(path.join(dir, FILE), source);
  return dir;
}

type Pipe = 'blocking' | 'non-blocking';

interface Run {
  exitCode: number;
  stdout: string;
  /** What the late reader got from the runner's stderr. */
  stderr: string;
  /** O_NONBLOCK on the stderr pipe as the runner inherits it. */
  nonBlocking: boolean;
}

/**
 * Runs the runner on `dir`'s fixture with its stderr read late. `non-blocking`
 * first runs a bun process that writes to process.stderr on the same pipe,
 * which leaves the pipe non-blocking for the processes after it, as
 * `bun run paraglide` does for the runner in `bun run test`.
 */
function runWithLateReader(dir: string, pipe: Pipe): Run {
  const script = `
{
  ${pipe === 'non-blocking' ? `"$BUN" -e 'process.stderr.write("")' 2>&1 >/dev/null` : ':'}
  cat /proc/self/fdinfo/9 9>&1 >pipe-flags
  "$BUN" "$RUNNER" fixture 2>&1 >runner-stdout
  echo "$?" >runner-exit
} | {
  i=0
  while [ ! -e runner-exit ] && [ "$i" -lt ${READER_DELAY_TENTHS} ]; do
    sleep 0.1
    i=$((i + 1))
  done
  cat
}
`;
  const proc = Bun.spawnSync({
    cmd: ['bash', '-c', script],
    cwd: dir,
    env: { ...env, BUN: process.execPath, RUNNER: runner },
    stdout: 'pipe',
    stderr: 'pipe'
  });
  expect(proc.stderr.toString()).toBe('');
  const flags = readFileSync(path.join(dir, 'pipe-flags'), 'utf8').match(/^flags:\s*(\d+)$/m);
  return {
    exitCode: Number(readFileSync(path.join(dir, 'runner-exit'), 'utf8')),
    stdout: readFileSync(path.join(dir, 'runner-stdout'), 'utf8'),
    stderr: proc.stdout.toString(),
    nonBlocking: (Number.parseInt(flags?.[1] ?? 'NaN', 8) & 0o4000) !== 0
  };
}

const FULL = `== ${FILE}: full output ==\n`;
const WITHOUT_PASS = `== ${FILE}: output without its (pass) lines ==\n`;

/** The dump's two blocks: the lines other than (pass) lines, then the full output. */
function blocks(stderr: string): { first: string; full: string } {
  expect(stderr.startsWith(WITHOUT_PASS)).toBe(true);
  const at = stderr.indexOf(FULL);
  expect(at).toBeGreaterThan(0);
  return { first: stderr.slice(WITHOUT_PASS.length, at), full: stderr.slice(at + FULL.length) };
}

const passLines = (text: string): number =>
  text.split('\n').filter((l) => l.startsWith('(pass) ')).length;

/**
 * The whole dump reached the reader: every (pass) line, once, and bun's
 * summary, whose last line is the last thing the runner writes.
 */
function expectWholeDump(stderr: string): void {
  expect(passLines(stderr)).toBe(PASSES);
  expect(stderr).toMatch(
    new RegExp(
      `\\n ${PASSES} pass\\n 1 fail\\n(?: \\d+ expect\\(\\) calls\\n)?Ran ${PASSES + 1} tests across 1 file\\. \\[[^\\]]+\\]\\n$`
    )
  );
}

const TIMED_OUT_HOOK =
  /^\(fail\) \(unnamed\) .*\n {2}\^ a beforeEach\/afterEach hook timed out for this test\.$/m;

describe('a failed file', () => {
  it.each<Pipe>(['blocking', 'non-blocking'])(
    'reaches a late reader in full through a %s pipe, the lines that name the fail first',
    (pipe) => {
      const dir = fixture(
        `${passingCases}it('the one failing case', () => { expect(1).toBe(2); });\n`
      );
      const run = runWithLateReader(dir, pipe);

      expect(run.nonBlocking).toBe(pipe === 'non-blocking');
      expect(run.exitCode).toBe(1);
      expect(run.stdout).toMatch(new RegExp(`^\\[1/1\\] FAIL +${PASSES}p 1f +${FILE}$`, 'm'));
      expectWholeDump(run.stderr);
      const { first, full } = blocks(run.stderr);
      expect(passLines(first)).toBe(0);
      expect(first).toContain('(fail) the one failing case');
      expect(first).toContain('error: expect(received).toBe(expected)');
      expect(first).toMatch(/^ 1 fail$/m);
      expect(passLines(full)).toBe(PASSES);
      expect(full).toContain('(fail) the one failing case');
    },
    TIMEOUT
  );

  // Main run 510's shape: every case passes and a hook that runs past its
  // timeout counts as one more fail, named only by the line under it.
  it(
    'names a timed-out afterAll by its reason line in the first block',
    () => {
      const dir = fixture(`${passingCases}afterAll(async () => { await Bun.sleep(1000); }, 50);\n`);
      const run = runWithLateReader(dir, 'non-blocking');

      expect(run.exitCode).toBe(1);
      expect(run.stdout).toMatch(new RegExp(`^\\[1/1\\] FAIL +${PASSES}p 1f +${FILE}$`, 'm'));
      expect(run.stderr).toMatch(TIMED_OUT_HOOK);
      expectWholeDump(run.stderr);
      const { first, full } = blocks(run.stderr);
      expect(first).toMatch(TIMED_OUT_HOOK);
      expect(first).toMatch(new RegExp(`^ ${PASSES} pass\\n 1 fail$`, 'm'));
      expect(passLines(full)).toBe(PASSES);
    },
    TIMEOUT
  );
});

describe('a broken runner', () => {
  // The child exits before bun prints a summary. In the second case it first
  // prints a zero count of its own, which the runner parses.
  it.each([
    { counts: 'no counts', print: '', reason: "runner: couldn't parse bun test output" },
    {
      counts: 'zero counts',
      print: "console.log(' 0 pass');\n",
      reason: 'runner: bun exited 3 with no parsed counts'
    }
  ])(
    "prints its !! line and the child's whole output to a late reader, once, on $counts",
    ({ print, reason }) => {
      const dir = fixture(
        `${print}console.log('${'x'.repeat(99)}\\n'.repeat(1000));\nconsole.log('END OF THE CHILD OUTPUT');\nprocess.exit(3);\n`
      );
      const run = runWithLateReader(dir, 'non-blocking');

      // The run's only file counted no test, so the self-check fails too.
      expect(run.exitCode).toBe(2);
      expect(run.stdout).toMatch(new RegExp(`^\\[1/1\\] FAIL +${FILE}$`, 'm'));
      expect(run.stderr.startsWith(`!! ${FILE}: ${reason}\n`)).toBe(true);
      expect(run.stderr).toContain(`${'x'.repeat(99)}\n`.repeat(1000));
      expect(run.stderr).toContain('END OF THE CHILD OUTPUT');
      expect(run.stderr).toContain('!! Runner self-check failed');
      // With no (pass) line to leave out, the two blocks would be the same.
      expect(run.stderr).toContain(`${reason}\n${FULL}`);
      expect(run.stderr.split('END OF THE CHILD OUTPUT').length).toBe(2);
    },
    TIMEOUT
  );
});

describe('a passing file', () => {
  it(
    'prints only its progress line',
    () => {
      const dir = fixture(passingCases);
      const proc = Bun.spawnSync({
        cmd: [process.execPath, runner, 'fixture'],
        cwd: dir,
        env,
        stdout: 'pipe',
        stderr: 'pipe'
      });

      expect(proc.exitCode).toBe(0);
      expect(proc.stderr.toString()).toBe('');
      const lines = proc.stdout.toString().split('\n');
      expect(lines.filter((l) => l.includes(FILE))).toEqual([
        expect.stringMatching(new RegExp(`^\\[1/1\\] pass +${PASSES}p +${FILE}$`))
      ]);
      expect(proc.stdout.toString()).not.toContain('(pass)');
      expect(lines).toContainEqual(
        expect.stringMatching(new RegExp(`^1 files \\| ${PASSES} pass \\| 0 fail \\| 0 skip \\| `))
      );
    },
    TIMEOUT
  );
});

// Under CI a skipped test fails its file (#732). CI counts when non-empty.
describe('a file with a skipped test', () => {
  const skipping = `import { it } from 'bun:test';
it('runs', () => {});
it.skip('skips', () => {});
`;
  const run = (ci: string | undefined) => {
    const dir = fixture(skipping);
    const proc = Bun.spawnSync({
      cmd: [process.execPath, runner, 'fixture'],
      cwd: dir,
      env: { ...env, CI: ci },
      stdout: 'pipe',
      stderr: 'pipe'
    });
    return {
      exitCode: proc.exitCode,
      stdout: proc.stdout.toString(),
      stderr: proc.stderr.toString()
    };
  };

  it(
    'fails under CI and names the skip',
    () => {
      const { exitCode, stdout, stderr } = run('true');
      expect(exitCode).toBe(1);
      expect(stdout).toMatch(new RegExp(`^\\[1/1\\] FAIL 1p 1s +${FILE}$`, 'm'));
      expect(
        stderr.startsWith(`!! ${FILE}: 1 skipped test(s) under CI, where every test must run\n`)
      ).toBe(true);
      expect(stderr).toContain('(skip) skips');
    },
    TIMEOUT
  );

  it.each([
    ['unset', undefined],
    ['empty', '']
  ])(
    'passes with CI %s',
    (_, ci) => {
      const { exitCode, stdout, stderr } = run(ci);
      expect(exitCode).toBe(0);
      expect(stdout).toMatch(new RegExp(`^\\[1/1\\] pass 1p 1s +${FILE}$`, 'm'));
      expect(stderr).toBe('');
    },
    TIMEOUT
  );
});

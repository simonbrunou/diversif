// scripts/check-push-repeats-pr.ts (#714) against a small git repo written
// per test. The base repo holds this checkout's copy of each file ALLOWED
// names, so every listed difference has its hit, and a fixture workflow with
// the shapes the script must pass: `push` to `main` and a bare
// `pull_request`, `${{ github.run_id }}` in a name (and beside it, in one
// case, `${{ github.run_attempt }}`), `if: always()` on a
// cleanup step, and a runner variable name in Markdown. Each other case edits
// one file into one difference and asserts exit 1 and the line that names
// it, so removing any rule from the script turns a case red. The runner
// variable names are built from parts here, as in the script, so neither
// file holds one and the script reads both.
import { afterAll, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ALLOWED } from './check-push-repeats-pr';

const repo = path.resolve(import.meta.dir, '..');
const scriptPath = path.join(import.meta.dir, 'check-push-repeats-pr.ts');
// A case makes three git calls and starts Bun; a loaded CI runner stalls a
// process for seconds (#572), so the cases get 30 s instead of 5 s.
const TIMEOUT = 30_000;
const [GH, GT, FJ, FG] = ['GITHUB', 'GITEA', 'FORGEJO', 'FORGE'].map((name) => `${name}_`);
const LIB = ['@actions', 'github'].join('/');
const EV = ['event', 'Name'].join('');
const CI = '.forgejo/workflows/ci.yml';
const RENOVATE = '.forgejo/workflows/renovate-config.yml';
const FIXTURE = '.forgejo/workflows/fixture.yml';

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

const root = mkdtempSync(path.join(tmpdir(), 'check-push-repeats-pr-test-'));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const baseFixture = [
  'name: Fixture',
  'on:',
  '  push:',
  '    branches: [main]',
  '  pull_request:',
  'jobs:',
  '  test:',
  '    runs-on: ubuntu-latest',
  '    env:',
  '      IMAGE: app:ci-${{ github.run_id }}',
  '    steps:',
  '      - uses: actions/checkout@v7',
  '      - run: bun run test',
  '      - name: Clean up',
  '        if: always()',
  '        run: docker rm -f app'
].join('\n');
const read = (file: string) => readFileSync(path.join(repo, file), 'utf8');
const allowedFiles = Object.fromEntries(
  [...new Set(ALLOWED.map((a) => a.file))].map((f) => [f, read(f)])
);
const base: Record<string, string> = {
  ...allowedFiles,
  [FIXTURE]: baseFixture,
  'README.md': `CI reads ${GH}TOKEN; Markdown is not run.\n`,
  'scripts/build.sh': 'echo build\n'
};

function git(cwd: string, ...args: string[]): string {
  const r = Bun.spawnSync({ cmd: ['git', ...args], cwd, env: gitEnv });
  if (r.exitCode !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr.toString()}`);
  return r.stdout.toString().trim();
}

function run(cwd: string, args: string[]) {
  const r = Bun.spawnSync({ cmd: [process.execPath, scriptPath, ...args], cwd, env: gitEnv });
  return { code: r.exitCode, out: r.stdout.toString() + r.stderr.toString() };
}

let count = 0;
// Commits `files` over the base repo (a null value deletes a base file) and
// runs the script on that commit from `subdir` of the repo.
function check(files: Record<string, string | null> = {}, { subdir = '' } = {}) {
  const dir = path.join(root, String(count++));
  for (const [file, content] of Object.entries({ ...base, ...files })) {
    if (content === null) continue;
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), content);
  }
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-qm', 'c');
  // The pushed SHA twice: a merge commit with the same tree.
  const sha = git(dir, 'rev-parse', 'HEAD');
  return run(path.join(dir, subdir), [sha, sha]);
}

// Replaces `from` in `text`, failing the test when `from` is not there, so a
// case never runs on the unedited base by mistake.
function edit(text: string, from: string | RegExp, to: string): string {
  const out = text.replace(from, to);
  if (out === text) throw new Error(`edit: ${String(from)} not found`);
  return out;
}

const fixtureWith = (...extraSteps: string[]) => `${baseFixture}\n${extraSteps.join('\n')}\n`;

function expectPass(files: Record<string, string | null> = {}, options = {}) {
  const { code, out } = check(files, options);
  expect(out).toMatch(/the push run repeats the PR run/);
  expect(code).toBe(0);
}

function expectDifference(files: Record<string, string | null>, pattern: RegExp, options = {}) {
  const { code, out } = check(files, options);
  expect(out).toMatch(pattern);
  expect(out).toMatch(/wait on main's run/);
  expect(code).toBe(1);
}

describe('check-push-repeats-pr passes', () => {
  it(
    "the base repo: this checkout's listed differences, push to main, a bare pull_request, run_id, if: always()",
    () => {
      const { code, out } = check();
      expect(out).toContain(
        `apart from the ${ALLOWED.length} listed difference(s) (3 workflow file(s), 3 YAML file(s) read)`
      );
      expect(code).toBe(0);
    },
    TIMEOUT
  );
  it(
    'triggers written as a list',
    () => {
      expectPass({
        [FIXTURE]: edit(
          baseFixture,
          /on:\n {2}push:\n {4}branches: \[main\]\n {2}pull_request:/,
          'on: [push, pull_request]'
        )
      });
    },
    TIMEOUT
  );
  it(
    'push with no filter, and workflow_dispatch and schedule beside it',
    () => {
      const fixture = edit(
        baseFixture,
        '  push:\n    branches: [main]\n',
        "  push:\n  workflow_dispatch:\n  schedule:\n    - cron: '0 3 * * *'\n"
      );
      expectPass({ [FIXTURE]: fixture });
    },
    TIMEOUT
  );
  it(
    'an action from data.forgejo.org',
    () => {
      expectPass({
        [FIXTURE]: fixtureWith('      - uses: https://data.forgejo.org/actions/setup-node@v7')
      });
    },
    TIMEOUT
  );
  it(
    "the job's attempt beside the run id in a name",
    () => {
      expectPass({
        [FIXTURE]: edit(
          baseFixture,
          'ci-${{ github.run_id }}',
          'ci-${{ github.run_id }}-${{ github.run_attempt }}'
        )
      });
    },
    TIMEOUT
  );
  it(
    "the runner's temp directory",
    () => {
      expectPass({
        [FIXTURE]: fixtureWith(
          '      - run: bun run e2e',
          '        env:',
          '          DB: ${{ runner.temp }}/e2e.db'
        )
      });
    },
    TIMEOUT
  );
  it(
    'a runner variable name in graphify-out',
    () => {
      expectPass({ 'graphify-out/graph.json': `{"label": "${GH}REF"}\n` });
    },
    TIMEOUT
  );
  it(
    'run from a subfolder of the repo',
    () => {
      expectPass({}, { subdir: 'scripts' });
    },
    TIMEOUT
  );
});

describe('check-push-repeats-pr finds a difference', () => {
  it.each<[string, Record<string, string | null>, RegExp]>([
    [
      'a workflow that runs only on push',
      { '.forgejo/workflows/deploy.yml': 'on: push\njobs: {}\n' },
      /deploy\.yml \.on: no pull_request trigger/
    ],
    [
      'a push-only workflow in a subfolder of .forgejo/workflows',
      { '.forgejo/workflows/sub/deploy.yaml': 'on: push\njobs: {}\n' },
      /sub\/deploy\.yaml \.on: no pull_request trigger/
    ],
    [
      'a workflow that runs only on pull_request',
      { '.forgejo/workflows/lint.yml': 'on:\n  pull_request:\njobs: {}\n' },
      /lint\.yml \.on: no push trigger/
    ],
    [
      'a trigger other than push, pull_request, schedule and workflow_dispatch',
      {
        [FIXTURE]: edit(
          baseFixture,
          '  pull_request:',
          '  pull_request:\n  workflow_run:\n    workflows: [Build]'
        )
      },
      /fixture\.yml \.on\.workflow_run: trigger workflow_run/
    ],
    [
      'a pull_request filter',
      { [FIXTURE]: edit(baseFixture, '  pull_request:', "  pull_request:\n    paths: ['src/**']") },
      /fixture\.yml \.on\.pull_request: pull_request has a filter/
    ],
    [
      'a push filter beyond branches: [main]',
      {
        [FIXTURE]: edit(
          baseFixture,
          '    branches: [main]',
          "    branches: [main]\n    paths-ignore: ['**.md']"
        )
      },
      /fixture\.yml \.on\.push: push has a filter beyond branches: \[main\]/
    ],
    [
      'push on main and another branch',
      { [FIXTURE]: edit(baseFixture, 'branches: [main]', 'branches: [main, dev]') },
      /fixture\.yml \.on\.push: push has a filter beyond branches: \[main\]/
    ],
    [
      'push on another branch only',
      { [FIXTURE]: edit(baseFixture, 'branches: [main]', 'branches: dev') },
      /fixture\.yml \.on\.push: push has a filter beyond branches: \[main\]/
    ],
    [
      'a workflow with no on:',
      { '.forgejo/workflows/empty.yml': 'jobs: {}\n' },
      /empty\.yml \.on: no on: triggers/
    ],
    [
      'a workflow that is not YAML',
      { '.forgejo/workflows/broken.yml': 'on: [push\n' },
      /broken\.yml: not readable as YAML/
    ],
    [
      'no workflow at all',
      { [CI]: null, [RENOVATE]: null, [FIXTURE]: null },
      /\.forgejo\/workflows\/: no workflow file/
    ],
    [
      'a workflow under .github/workflows',
      { '.github/workflows/deploy.yml': 'on: push\njobs: {}\n' },
      /\.github\/workflows\/deploy\.yml: a workflow this script does not read/
    ],
    [
      'an if: on github.event_name',
      {
        [FIXTURE]: fixtureWith('      - run: echo push', "        if: github.event_name == 'push'")
      },
      /fixture\.yml \.jobs\.test\.steps\[3\]\.if: if is not always\(\): github\.event_name == 'push'/
    ],
    [
      'an if: that reads no event',
      {
        [FIXTURE]: fixtureWith(
          '      - run: bun install',
          "        if: steps.cache.outputs.cache-hit != 'true'"
        )
      },
      /steps\[3\]\.if: if is not always\(\)/
    ],
    [
      'an if: that starts with always() and goes on',
      {
        [FIXTURE]: fixtureWith(
          '      - run: echo main',
          "        if: always() && steps.co.outputs.ref == 'refs/heads/main'"
        )
      },
      /steps\[3\]\.if: if is not always\(\)/
    ],
    [
      'an if key written in quotes',
      {
        [FIXTURE]: fixtureWith(
          '      - run: echo push',
          `        "if": steps.co.outputs.ref == 'refs/heads/main'`
        )
      },
      /steps\[3\]\.if: if is not always\(\)/
    ],
    [
      'an if key with a space before its colon',
      {
        [FIXTURE]: fixtureWith(
          '      - run: echo push',
          "        if : steps.co.outputs.ref == 'refs/heads/main'"
        )
      },
      /steps\[3\]\.if: if is not always\(\)/
    ],
    [
      'a job-level if:',
      {
        [FIXTURE]: edit(
          baseFixture,
          '    runs-on:',
          "    if: github.ref == 'refs/heads/main'\n    runs-on:"
        )
      },
      /fixture\.yml \.jobs\.test\.if: if is not always\(\)/
    ],
    [
      'github.ref beside github.run_id',
      {
        [FIXTURE]: edit(
          baseFixture,
          'ci-${{ github.run_id }}',
          'ci-${{ github.run_id }}-${{ github.ref }}'
        )
      },
      /fixture\.yml \.jobs\.test\.env\.IMAGE: an expression other than run_id, run_attempt and runner\.temp: \$\{\{ github\.ref \}\}/
    ],
    [
      "the index form github['event_name']",
      { [FIXTURE]: fixtureWith("      - run: echo ${{ github['event_name'] }}") },
      /fixture\.yml \.jobs\.test\.steps\[3\]\.run: an expression other/
    ],
    [
      'an expression on a step output that follows the event',
      {
        [FIXTURE]: fixtureWith(
          '      - run: bun run e2e',
          "        continue-on-error: ${{ steps.co.outputs.ref != 'refs/heads/main' }}"
        )
      },
      /steps\[3\]\.continue-on-error: an expression other/
    ],
    [
      'the forgejo and forge aliases',
      {
        [FIXTURE]: fixtureWith(
          '      - run: echo ${{ forgejo.event_name }}',
          '      - run: echo ${{ forge.ref }}'
        )
      },
      /steps\[3\]\.run: an expression other[\s\S]*steps\[4\]\.run: an expression other/
    ],
    [
      'an expression split over lines',
      {
        [FIXTURE]: fixtureWith(
          '      - run: >-',
          '          echo ${{',
          '          github.event_name }}'
        )
      },
      /steps\[3\]\.run: an expression other/
    ],
    [
      'an expression in a key',
      {
        [FIXTURE]: fixtureWith(
          '      - run: echo',
          '        env:',
          "          ${{ github.ref == 'x' && 'A' || 'B' }}: 1"
        )
      },
      /steps\[3\]\.env\.\$\{\{.*: an expression other/
    ],
    [
      'a runner variable in a step of a workflow',
      { [FIXTURE]: fixtureWith(`      - run: echo "$${GH}REF"`) },
      /fixture\.yml \.jobs\.test\.steps\[3\]\.run: the value names a runner variable/
    ],
    [
      'a runner variable as an env key of a workflow',
      { [FIXTURE]: fixtureWith('      - run: echo', '        env:', `          ${FJ}X: 1`) },
      /steps\[3\]\.env\.\w+: the key names a runner variable/
    ],
    [
      'an if: in a local action under .forgejo',
      {
        '.forgejo/actions/setup/action.yml':
          "runs:\n  using: composite\n  steps:\n    - run: echo x\n      if: env.X == '1'\n"
      },
      /\.forgejo\/actions\/setup\/action\.yml \.runs\.steps\[0\]\.if: if is not always\(\)/
    ],
    [
      'an expression in an action.yaml outside .forgejo',
      {
        'actions/setup/action.yaml':
          'runs:\n  using: composite\n  steps:\n    - run: echo ${{ github.event_name }}\n'
      },
      /actions\/setup\/action\.yaml \.runs\.steps\[0\]\.run: an expression other/
    ],
    [
      'an if: in an action.yml outside .forgejo',
      {
        'actions/build/action.yml':
          "runs:\n  using: composite\n  steps:\n    - run: echo x\n      if: env.X == '1'\n"
      },
      /actions\/build\/action\.yml \.runs\.steps\[0\]\.if: if is not always\(\)/
    ],
    [
      'a script that reads the ref from the runner',
      { 'scripts/build.sh': `echo build\necho "$${GH}REF"\n` },
      /scripts\/build\.sh:2: names a runner variable/
    ],
    [
      'a test that reads the event from the runner',
      { 'src/e2e.test.ts': `if (process.env.${GH}EVENT_NAME === 'push') run();\n` },
      /src\/e2e\.test\.ts:1: names a runner variable/
    ],
    [
      'a module that reads the forgejo and forge variable names',
      {
        'src/env.ts': `export const ref = process.env.${FJ}REF;\nexport const e = process.env.${FG}EVENT_NAME;\n`
      },
      /src\/env\.ts:1: names a runner variable[\s\S]*src\/env\.ts:2: names a runner variable/
    ],
    [
      'a module that reads a gitea variable name',
      { 'src/runner.ts': `export const onRunner = process.env.${GT}ACTIONS === 'true';\n` },
      /src\/runner\.ts:1: names a runner variable/
    ],
    [
      'a binary file that holds a runner variable name',
      { 'bin/tool': `\0\x01${GH}REF\0` },
      /bin\/tool: a binary file that names a runner variable/
    ],
    [
      "a script under .forgejo that loads the actions toolkit's github module",
      { '.forgejo/scripts/gate.js': `const { context } = require('${LIB}');\n` },
      /\.forgejo\/scripts\/gate\.js:1: names a runner variable or reads the event/
    ],
    [
      "a module that reads the toolkit context's event property",
      { 'src/gate.ts': `export const onPush = (context) => context.${EV} === 'push';\n` },
      /src\/gate\.ts:1: names a runner variable or reads the event/
    ],
    [
      'a step that uses actions/github-script',
      {
        [FIXTURE]: fixtureWith(
          '      - uses: actions/github-script@v7',
          '        with:',
          "          script: core.info('hi')"
        )
      },
      /steps\[3\]\.uses: uses runs code that gets the event: actions\/github-script@v7/
    ],
    [
      'a job that calls a reusable workflow',
      {
        [FIXTURE]: `${baseFixture}\n  deploy:\n    uses: owner/repo/.forgejo/workflows/deploy.yml@main\n`
      },
      /fixture\.yml \.jobs\.deploy\.uses: job deploy calls a reusable workflow: owner\/repo\/\.forgejo\/workflows\/deploy\.yml@main/
    ]
  ])(
    '%s',
    (_name, files, pattern) => {
      expectDifference(files, pattern);
    },
    TIMEOUT
  );

  it(
    'a push-only workflow, run from a subfolder of the repo',
    () => {
      expectDifference(
        { '.forgejo/workflows/deploy.yml': 'on: push\njobs: {}\n' },
        /deploy\.yml \.on: no pull_request trigger/,
        { subdir: 'scripts' }
      );
    },
    TIMEOUT
  );
});

describe('check-push-repeats-pr allows only what ALLOWED lists, as it lists it', () => {
  const ci = base[CI];
  it.each<[string, Record<string, string | null>, RegExp]>([
    [
      'a listed if: with another value',
      {
        [CI]: edit(
          ci,
          "if: needs.changes.outputs.e2e != 'false'",
          "if: needs.changes.outputs.e2e == 'true'"
        )
      },
      /ci\.yml \.jobs\.e2e\.if: if is not always\(\)[\s\S]*ci\.yml \.jobs\.e2e\.if: listed in ALLOWED but not found/
    ],
    [
      'a change to the pinned paths step',
      { [CI]: edit(ci, '  e2e=true\n', '  e2e=false\n') },
      /ci\.yml \.jobs\.changes\.steps\[id=paths\]\.run: the value names a runner variable[\s\S]*ci\.yml \.jobs\.changes\.steps\[id=paths\]\.run: listed in ALLOWED but not found/
    ],
    [
      'a listed expression copied to another workflow',
      {
        [FIXTURE]: fixtureWith(
          '      - run: echo "$EVENT"',
          '        env:',
          '          EVENT: ${{ github.event_name }}'
        )
      },
      /fixture\.yml \.jobs\.test\.steps\[3\]\.env\.EVENT: an expression other/
    ],
    [
      'a listed line copied to another file',
      { 'scripts/release.ts': `if (process.env.${GH}SHA) return process.env.${GH}SHA;\n` },
      /scripts\/release\.ts:1: names a runner variable/
    ],
    [
      'a workflow that ALLOWED names, gone',
      { [RENOVATE]: null },
      /renovate-config\.yml \.on\.push: listed in ALLOWED but not found[\s\S]*renovate-config\.yml \.on\.pull_request: listed in ALLOWED but not found/
    ],
    [
      'a listed line, reworded',
      { Dockerfile: edit(base.Dockerfile, `/ ${GH}SHA /`, `/ ${GH}SHA (GitHub Actions) /`) },
      /Dockerfile:\d+: names a runner variable[\s\S]*Dockerfile ".*": listed in ALLOWED but not found/
    ],
    [
      'a change to scripts/e2e-needed.sh, which ALLOWED pins',
      { 'scripts/e2e-needed.sh': `${base['scripts/e2e-needed.sh']}# skip .claude/ too\n` },
      /scripts\/e2e-needed\.sh: blob [0-9a-f]{40}, not the one ALLOWED pins/
    ],
    [
      'scripts/e2e-needed.sh, gone',
      { 'scripts/e2e-needed.sh': null },
      /scripts\/e2e-needed\.sh: blob missing, not the one ALLOWED pins/
    ],
    [
      "a second step with a listed step's name",
      {
        [CI]: edit(
          ci,
          'FALLOW_AUDIT_BASE: origin/${{ github.base_ref }}\n',
          'FALLOW_AUDIT_BASE: origin/${{ github.base_ref }}\n      - name: Fallow audit\n        run: echo again\n'
        )
      },
      /steps\[5\]\.env\.FALLOW_AUDIT_BASE: an expression other[\s\S]*steps\[name=Fallow audit\]\.env\.FALLOW_AUDIT_BASE: listed in ALLOWED but not found/
    ]
  ])(
    '%s',
    (_name, files, pattern) => {
      expectDifference(files, pattern);
    },
    TIMEOUT
  );

  it(
    "a Renovate bump of a listed step's action",
    () => {
      const bumped = ci.replace(
        /actions\/checkout@[0-9a-f]{40}/g,
        `actions/checkout@${'a'.repeat(40)}`
      );
      expect(bumped).not.toBe(ci);
      expectPass({ [CI]: bumped });
    },
    TIMEOUT
  );
  it(
    'a step added between two listed steps',
    () => {
      expectPass({
        [CI]: edit(
          ci,
          '      - id: paths\n',
          '      - name: Show the base\n        run: git log -1\n      - id: paths\n'
        )
      });
    },
    TIMEOUT
  );
  it(
    'a difference in the working tree that the checked commit lacks',
    () => {
      const dir = path.join(root, 'worktree');
      for (const [file, content] of Object.entries(base)) {
        mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
        writeFileSync(path.join(dir, file), content);
      }
      git(dir, 'init', '-q', '-b', 'main');
      git(dir, 'add', '-A');
      git(dir, 'commit', '-qm', 'c');
      writeFileSync(path.join(dir, '.forgejo/workflows/deploy.yml'), 'on: push\njobs: {}\n');
      const sha = git(dir, 'rev-parse', 'HEAD');
      const { code, out } = run(dir, [sha, sha]);
      expect(out).toMatch(/the push run repeats the PR run/);
      expect(code).toBe(0);
    },
    TIMEOUT
  );
});

describe('check-push-repeats-pr compares the trees first', () => {
  it(
    'stops on a merge commit whose tree is not the pushed SHA tree',
    () => {
      const dir = path.join(root, 'trees');
      for (const [file, content] of Object.entries(base)) {
        mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
        writeFileSync(path.join(dir, file), content);
      }
      git(dir, 'init', '-q', '-b', 'main');
      git(dir, 'add', '-A');
      git(dir, 'commit', '-qm', 'pushed');
      const pushed = git(dir, 'rev-parse', 'HEAD');
      // What another PR merged into main brings into the merge commit.
      writeFileSync(path.join(dir, 'other.txt'), 'from another PR\n');
      git(dir, 'add', 'other.txt');
      git(dir, 'commit', '-qm', 'merge');
      const { code, out } = run(dir, [pushed, git(dir, 'rev-parse', 'HEAD')]);
      expect(out).toMatch(/the merge holds files no CI run tested together; wait on main's run/);
      expect(code).toBe(1);
    },
    TIMEOUT
  );
});

describe("this repo's HEAD", () => {
  it(
    'has no difference beyond ALLOWED; a new one needs an entry that says why the skip still holds',
    () => {
      const { code, out } = run(repo, ['HEAD', 'HEAD']);
      expect(out).toMatch(/the push run repeats the PR run/);
      expect(code).toBe(0);
    },
    TIMEOUT
  );
});

it('the script and this test hold none of the names they search for, so the script reads both', () => {
  const names = new RegExp([GH, GT, FJ, FG, LIB, EV].join('|'));
  for (const file of [scriptPath, import.meta.path]) {
    expect(readFileSync(file, 'utf8')).not.toMatch(names);
  }
});

describe('check-push-repeats-pr exits 2', () => {
  it(
    'on a SHA the repo lacks',
    () => {
      const dir = path.join(root, 'nosha');
      mkdirSync(dir);
      git(dir, 'init', '-q', '-b', 'main');
      const missing = '0123456789abcdef0123456789abcdef01234567';
      const { code, out } = run(dir, [missing, missing]);
      expect(out).toMatch(/no pushed SHA 0123456789abcdef0123456789abcdef01234567 here/);
      expect(code).toBe(2);
    },
    TIMEOUT
  );
  it(
    'on a merge SHA the repo lacks, as when a fetch has not brought it yet',
    () => {
      const { code, out } = run(repo, ['HEAD', '0123456789abcdef0123456789abcdef01234567']);
      expect(out).toMatch(/no merge SHA 0123456789abcdef0123456789abcdef01234567 here/);
      expect(code).toBe(2);
    },
    TIMEOUT
  );
  it.each([
    ['without a SHA', []],
    ['without the merge SHA, as when merge_commit_sha is empty', ['HEAD']],
    ['with a third argument', ['HEAD', 'HEAD', 'HEAD']]
  ])(
    '%s',
    (_name, args) => {
      const { code, out } = run(repo, args);
      expect(out).toMatch(/usage: bun scripts\/check-push-repeats-pr\.ts <pushed SHA> <merge SHA>/);
      expect(code).toBe(2);
    },
    TIMEOUT
  );
  it(
    'outside a git repo',
    () => {
      const dir = mkdtempSync(path.join(tmpdir(), 'check-push-repeats-pr-nogit-'));
      try {
        const { code, out } = run(dir, ['HEAD', 'HEAD']);
        expect(out).toMatch(/git rev-parse --show-toplevel failed/);
        expect(code).toBe(2);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    },
    TIMEOUT
  );
});

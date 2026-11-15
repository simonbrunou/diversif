// #525: the Fallow audit sees only a PR's changed files, so an unused file
// elsewhere in the tree failed no CI job. ci.yml's `knip` job, which runs on
// a push to main and on a PR, now runs `fallow dead-code` on the whole tree.
// The first tests read that step from the workflow. They fail when the
// workflow's triggers or the job's keys differ from today's, when the step
// has a key besides its name and run or another command, or when it runs
// before paraglide or svelte-kit sync. The rest run the step's own `run:`
// text under bash in a throwaway project, with the repo's pinned fallow
// binary, one test per outcome: a clean tree, an error-severity finding, a
// finding whose rule is set to warn, and a file left out by ignorePatterns.
import { afterAll, describe, expect, it } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parse } from 'yaml';

const repo = path.resolve(import.meta.dir, '..');
const CI = '.forgejo/workflows/ci.yml';
const JOB = 'knip';
const STEP = 'Fallow dead-code (whole repo)';
const ECHO = 'fallow dead-code: no error-severity finding';
const RUN = `node_modules/.bin/fallow dead-code --format compact && echo "${ECHO}"`;

type Step = Record<string, unknown>;
type Job = { steps: Step[] } & Record<string, unknown>;
const workflow = parse(readFileSync(path.join(repo, CI), 'utf8')) as {
  on: Record<string, unknown>;
  jobs: Record<string, Job>;
};
const job = workflow.jobs[JOB];
const steps = job.steps;
const index = steps.findIndex((s) => s.name === STEP);
const step = steps[index];

describe(`the ${STEP} step in ${CI}`, () => {
  it('sits in a job that runs on a push and on a PR', () => {
    // Any filter (another branch, paths, paths-ignore) fails here.
    expect(workflow.on).toEqual({ push: { branches: ['main'] }, pull_request: null });
    expect(Object.keys(job).sort()).toEqual(['name', 'runs-on', 'steps']);
  });

  it('has a name and a run, and no other key', () => {
    expect(index).toBeGreaterThan(-1);
    expect(Object.keys(step).sort()).toEqual(['name', 'run']);
    expect(step.run).toBe(RUN);
  });

  it('runs after paraglide and svelte-kit sync, which fallow needs to resolve imports', () => {
    const at = (run: string) => steps.findIndex((s) => s.run === run);
    expect(at('bun run paraglide')).toBeGreaterThan(-1);
    expect(at('bun --bun node_modules/@sveltejs/kit/src/cli.js sync')).toBeGreaterThan(-1);
    expect(index).toBeGreaterThan(at('bun run paraglide'));
    expect(index).toBeGreaterThan(at('bun --bun node_modules/@sveltejs/kit/src/cli.js sync'));
  });
});

const dirs: string[] = [];
afterAll(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
});

// A project whose package.json enters at src/index.ts, with the repo's fallow
// at node_modules/.bin/fallow as the job has it.
function project(files: Record<string, string>) {
  const dir = mkdtempSync(path.join(tmpdir(), 'fallow-dead-code-step-'));
  dirs.push(dir);
  mkdirSync(path.join(dir, 'node_modules/.bin'), { recursive: true });
  symlinkSync(
    path.join(repo, 'node_modules/.bin/fallow'),
    path.join(dir, 'node_modules/.bin/fallow')
  );
  const all: Record<string, string> = {
    'package.json': JSON.stringify({
      name: 'fx',
      private: true,
      type: 'module',
      main: 'src/index.ts'
    }),
    'src/index.ts': 'export const a = 1;\n',
    ...files
  };
  for (const [file, text] of Object.entries(all)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), text);
  }
  const r = Bun.spawnSync(['bash', '-c', RUN], { cwd: dir, stdout: 'pipe', stderr: 'pipe' });
  return { code: r.exitCode, out: r.stdout.toString() + r.stderr.toString() };
}

const ORPHAN = { 'src/orphan.ts': 'export const b = 2;\n' };

describe(`the ${STEP} step's command`, () => {
  it('passes on a tree with no finding and prints its line', () => {
    const r = project({});
    expect(r.code).toBe(0);
    expect(r.out.trimEnd().split('\n').at(-1)).toBe(ECHO);
  });

  it('fails on an unused file, an error-severity finding, without its line', () => {
    const r = project(ORPHAN);
    expect(r.code).toBe(1);
    expect(r.out).toContain('unused-file:src/orphan.ts');
    expect(r.out).not.toContain(ECHO);
  });

  it('passes on a finding whose rule is set to warn, and prints it', () => {
    const r = project({ ...ORPHAN, '.fallowrc.json': '{"rules":{"unused-files":"warn"}}' });
    expect(r.code).toBe(0);
    expect(r.out).toContain('unused-file:src/orphan.ts');
    expect(r.out).toContain(ECHO);
  });

  it('passes on an unused file that ignorePatterns leaves out', () => {
    const r = project({ ...ORPHAN, '.fallowrc.json': '{"ignorePatterns":["src/orphan.ts"]}' });
    expect(r.code).toBe(0);
    expect(r.out).not.toContain('unused-file');
    expect(r.out).toContain(ECHO);
  });
});

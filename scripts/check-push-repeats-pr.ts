#!/usr/bin/env bun
// Tells the merging agent whether the CI run that a merge starts on `main`
// repeats the PR run's jobs and steps (AGENTS.md, « Merge authority », « After
// every merge »). Ported from simonbrunou.bzh's scripts/check-push-repeats-pr.js
// (#162). Run it after the merge and `git fetch origin`, with the SHA the PR's
// CI passed and the merge commit:
//
//   nix develop -c bun scripts/check-push-repeats-pr.ts <pushed SHA> <merge SHA>
//
// It first compares the two commits' trees: when they differ, the merge
// commit holds files no CI run tested together, and it stops there. Then it
// reads the files at the pushed SHA through git, not the working tree, and
// finds each difference between a `push` run and a `pull_request` run it can
// see:
//
// - a workflow anywhere under .forgejo/workflows/ that lacks a `push` or a
//   `pull_request` trigger, filters `pull_request`, filters `push` beyond
//   `branches: [main]`, or has a trigger other than those two, `schedule`
//   and `workflow_dispatch`; a file under .github/workflows/ or
//   .gitea/workflows/, which this script does not read;
// - a job that calls a reusable workflow (`jobs.<id>.uses`), whose steps it
//   cannot read;
// - in a workflow, in any other YAML file under .forgejo/, or in an
//   action.yml or action.yaml anywhere: an `if` key whose value is not
//   `always()`, a `${{ }}` expression other than `${{ github.run_id }}` and
//   `${{ runner.temp }}`, a step that uses actions/github-script, whose code
//   gets the event, and a value or key that names a runner variable (below);
// - in any other file outside Markdown and graphify-out/, a line holding a
//   name made of GITHUB, GITEA, FORGEJO or FORGE and an underscore, which a
//   script could read the event through, or the names of the actions
//   toolkit's github module and its event property. Neither this script nor
//   its test holds one, so both are read.
//
// It reads YAML files as data, so it finds an `if` however the YAML spells
// the key ("if":, if :) and keys each hit by its path in the file. A list
// item there is named by its `id`, else its `name`, else its index:
// `.jobs.changes.steps[id=paths].run`. Items that share an id or a name get
// their index. A line hit elsewhere is keyed by its
// file and its trimmed text.
//
// ALLOWED below names each difference diversif's workflows keep on purpose.
// Its `kind` says which way the runs differ: `pr-only` when the push run does
// a part of what the PR run did, `inert` when the difference changes neither
// what runs nor its result, `push-extra` when the push run does something the
// PR run skipped. Its `why` says why the skip still holds; a push-extra entry
// needs the longest one. A hit is allowed only when its file, path or line,
// and value match an entry exactly. An entry may also pin a file whose content
// a reason rests on, by its blob hash. An entry that matches nothing is
// itself a difference: the list must say what the workflows hold. The test
// runs this script on the repo's own HEAD, so a change that adds a
// difference, or edits a listed one, fails CI's unit job until ALLOWED says
// why the skip still holds, or loses the entry.
//
// Exit 0 means the merge adds nothing the PR run did not test, not that
// main's run will be green: a new advisory, a flaky test or an overloaded
// runner can still turn it red. It cannot see code that branches on commit
// metadata (the merge commit's subject, SHA and parents differ from the
// pushed SHA's), an action from outside the repo that reads the event
// (actions/checkout does, to pick what it checks out: the pushed SHA on a PR,
// the merge commit on a push), or a route to the event the list above leaves
// out. Such code passes.
//
// Exit 0: equal trees and no difference beyond ALLOWED, so the push run
// repeats the PR run. Exit 1: it printed a difference, so wait on main's run.
// Exit 2: wrong call, git failed, a SHA is unknown or this Bun has no YAML
// parser; wait too. scripts/check-push-repeats-pr.test.ts holds one case per
// difference.

// Built from parts so this file holds none of the names it searches for.
const RUNNER = ['GITHUB', 'GITEA', 'FORGEJO', 'FORGE'].map((name) => `${name}_`);
const GH = RUNNER[0];
const EVENT_READS = [['@actions', 'github'].join('/'), ['event', 'Name'].join('')];
const RUNNER_NAME = new RegExp([...RUNNER, ...EVENT_READS].join('|'));
const ALLOWED_TRIGGERS = new Set(['push', 'pull_request', 'schedule', 'workflow_dispatch']);
// The same value on both events: this run's id and the runner's temp
// directory.
const SAME_ON_BOTH = new Set(['github.run_id', 'runner.temp']);
const EXPRESSION = /\$\{\{([\s\S]*?)\}\}/g;
const CI = '.forgejo/workflows/ci.yml';
const RENOVATE = '.forgejo/workflows/renovate-config.yml';
const RENOVATE_PATHS = ['renovate.json', '.forgejo/workflows/renovate-config.yml'];
const RELEASE_WHY =
  'names the build after the commit the run checks out, as `git rev-parse HEAD` does when ' +
  'the variable is unset: the pushed SHA in the PR run, the merge commit in the push run. ' +
  'Commit metadata, which this script cannot see anyway (header).';
const RELEASE_COMMENT_WHY = 'a comment that lists where vite.config.ts reads the release name';

type Kind = 'pr-only' | 'inert' | 'push-extra';
type Allowed = { file: string; kind: Kind; why: string } & (
  { path: string; value: string } | { line: string } | { blob: string }
);

// diversif's differences kept on purpose (#714).
export const ALLOWED: Allowed[] = [
  {
    file: CI,
    path: '.concurrency.group',
    value: '${{ github.workflow }}-${{ github.ref }}',
    kind: 'inert',
    why: 'picks which run a newer push cancels, not what a run does'
  },
  {
    file: CI,
    path: '.jobs.fallow-audit.if',
    value: "github.event_name == 'pull_request'",
    kind: 'pr-only',
    why: 'Fallow audits the diff from the base branch, so it runs only on a PR'
  },
  {
    file: CI,
    path: '.jobs.fallow-audit.steps[name=Fallow audit].env.FALLOW_AUDIT_BASE',
    value: 'origin/${{ github.base_ref }}',
    kind: 'pr-only',
    why: 'inside the PR-only fallow-audit job'
  },
  {
    file: CI,
    path: '.jobs.changes.steps[0].if',
    value: "github.event_name == 'pull_request'",
    kind: 'pr-only',
    why: 'the checkout scripts/e2e-needed.sh needs; the push branch of the paths step reads no file'
  },
  {
    file: CI,
    path: '.jobs.changes.steps[id=paths].env.EVENT',
    value: '${{ github.event_name }}',
    kind: 'push-extra',
    why: 'read by the paths step; see its run text'
  },
  {
    file: CI,
    path: '.jobs.changes.steps[id=paths].env.BASE_REF',
    value: '${{ github.base_ref }}',
    kind: 'pr-only',
    why: 'read by the paths step on a PR only'
  },
  {
    file: CI,
    path: '.jobs.changes.steps[id=paths].run',
    value: [
      'if [ "$EVENT" = pull_request ]; then',
      '  e2e="$(scripts/e2e-needed.sh "origin/$BASE_REF")"',
      `  echo "E2E needed: $e2e (the branch's changes since origin/$BASE_REF)"`,
      'else',
      '  e2e=true',
      '  echo "E2E needed: true (a push to main)"',
      'fi',
      `echo "e2e=$e2e" >>"$${GH}OUTPUT"`,
      ''
    ].join('\n'),
    kind: 'push-extra',
    why:
      'decides whether E2E runs: on a PR, false when the branch changes only Markdown and docs/ ' +
      'against its merge base with main (scripts/e2e-needed.sh); on a push, always true. With ' +
      'equal trees, each file the PR did not change against its merge base keeps the version ' +
      'of the main commit it merges onto: the merge takes that version, and the trees match. ' +
      "So after a PR run that skipped E2E, main's E2E job tests that commit's app files again. " +
      "That commit's own run tests them, or, when this merge cancelled it, its merger follows " +
      'main to this run (AGENTS.md). Pinned whole: it branches on the event'
  },
  {
    file: 'scripts/e2e-needed.sh',
    blob: '1ad8fe744676928e2344212a97977c4739898926',
    kind: 'push-extra',
    why:
      'the paths step above lets a PR skip E2E on its answer. A change to which paths it skips ' +
      'changes what a PR run leaves to main: check that E2E still reads none of them, then ' +
      'update this hash (`git rev-parse HEAD:scripts/e2e-needed.sh`)'
  },
  {
    file: CI,
    path: '.jobs.changes.outputs.e2e',
    value: '${{ steps.paths.outputs.e2e }}',
    kind: 'push-extra',
    why: "the paths step's answer, handed to the e2e job"
  },
  {
    file: CI,
    path: '.jobs.e2e.if',
    value: "needs.changes.outputs.e2e != 'false'",
    kind: 'push-extra',
    why: 'skips E2E on a PR that changes only Markdown and docs/; see the paths step'
  },
  {
    file: RENOVATE,
    path: '.on.push',
    value: JSON.stringify({ branches: ['main'], paths: RENOVATE_PATHS }),
    kind: 'pr-only',
    why:
      'the same paths as pull_request. The push run diffs the merge commit against the main ' +
      'commit it merged onto. The merge takes from that commit each file the PR did not change ' +
      'against its merge base, so with equal trees every file in that diff is one the PR ' +
      'changed, and the PR run starts the validator whenever the push run does. One exception: ' +
      'Forgejo can diff a PR from an older merge base (the workflow header), and a PR that put ' +
      'a filtered file back to that older base content then skips the validator'
  },
  {
    file: RENOVATE,
    path: '.on.pull_request',
    value: JSON.stringify({ paths: RENOVATE_PATHS }),
    kind: 'pr-only',
    why: 'the same paths as push; see .on.push'
  },
  {
    file: 'vite.config.ts',
    line: `if (process.env.${GH}SHA) return process.env.${GH}SHA;`,
    kind: 'inert',
    why: RELEASE_WHY
  },
  {
    file: 'vite.config.ts',
    line: `*  3. ${GH}SHA — GitHub Actions`,
    kind: 'inert',
    why: RELEASE_COMMENT_WHY
  },
  {
    file: '.dockerignore',
    line: `# only when SENTRY_RELEASE / SOURCE_COMMIT / ${GH}SHA / GIT_COMMIT_SHA are`,
    kind: 'inert',
    why: RELEASE_COMMENT_WHY
  },
  {
    file: '.env.example',
    line: `# SOURCE_COMMIT (Coolify default), then ${GH}SHA, then GIT_COMMIT_SHA, then`,
    kind: 'inert',
    why: RELEASE_COMMENT_WHY
  },
  {
    file: 'Dockerfile',
    line: `# SENTRY_RELEASE / SOURCE_COMMIT / ${GH}SHA / GIT_COMMIT_SHA / git HEAD`,
    kind: 'inert',
    why: RELEASE_COMMENT_WHY
  }
];

type Hit = { file: string; where: string; value: string; reason: string };

function fail(message: string): never {
  console.error(`check-push-repeats-pr: ${message}`);
  process.exit(2);
}

let cwd = process.cwd();
function git(args: string[], okCodes = [0]): string {
  const r = Bun.spawnSync({ cmd: ['git', ...args], cwd, stdout: 'pipe', stderr: 'pipe' });
  const out = r.stdout.toString();
  if (okCodes.includes(r.exitCode)) return out;
  fail(`git ${args.join(' ')} failed: ${r.stderr.toString().trim() || `exit ${r.exitCode}`}`);
}

function resolve(sha: string, what: string): string {
  const commit = git(['rev-parse', '--verify', '--quiet', `${sha}^{commit}`], [0, 1]).trim();
  if (!commit) fail(`no ${what} ${sha} here; run git fetch origin first`);
  return commit;
}

const isEmpty = (value: unknown) =>
  value == null || (typeof value === 'object' && Object.keys(value).length === 0);

function pushIsMainOnly(value: unknown): boolean {
  if (isEmpty(value)) return true;
  if (typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value as object);
  const branches = [(value as { branches?: unknown }).branches].flat();
  return (
    keys.length === 1 && keys[0] === 'branches' && branches.length === 1 && branches[0] === 'main'
  );
}

function checkTriggers(file: string, doc: unknown, hits: Hit[]) {
  const on = (doc as { on?: unknown } | null)?.on;
  let triggers: Record<string, unknown>;
  if (typeof on === 'string') triggers = { [on]: null };
  else if (Array.isArray(on)) triggers = Object.fromEntries(on.map((t) => [String(t), null]));
  else if (on && typeof on === 'object') triggers = on as Record<string, unknown>;
  else return hits.push({ file, where: '.on', value: '', reason: 'no on: triggers' });
  for (const name of ['push', 'pull_request']) {
    if (!(name in triggers))
      hits.push({ file, where: '.on', value: '', reason: `no ${name} trigger` });
  }
  for (const name of Object.keys(triggers)) {
    if (!ALLOWED_TRIGGERS.has(name)) {
      hits.push({ file, where: `.on.${name}`, value: '', reason: `trigger ${name}` });
    }
  }
  if ('pull_request' in triggers && !isEmpty(triggers.pull_request)) {
    const value = JSON.stringify(triggers.pull_request);
    hits.push({
      file,
      where: '.on.pull_request',
      value,
      reason: `pull_request has a filter: ${value}`
    });
  }
  if ('push' in triggers && !pushIsMainOnly(triggers.push)) {
    const value = JSON.stringify(triggers.push);
    hits.push({
      file,
      where: '.on.push',
      value,
      reason: `push has a filter beyond branches: [main]: ${value}`
    });
  }
}

function checkJobs(file: string, doc: unknown, hits: Hit[]) {
  const jobs = (doc as { jobs?: unknown } | null)?.jobs;
  if (!jobs || typeof jobs !== 'object') return;
  for (const [id, job] of Object.entries(jobs)) {
    if (job && typeof job === 'object' && 'uses' in job) {
      const value = String((job as { uses: unknown }).uses);
      hits.push({
        file,
        where: `.jobs.${id}.uses`,
        value,
        reason: `job ${id} calls a reusable workflow: ${value}`
      });
    }
  }
}

function itemName(item: unknown, i: number): string {
  if (item && typeof item === 'object' && !Array.isArray(item)) {
    const { id, name } = item as { id?: unknown; name?: unknown };
    if (typeof id === 'string') return `[id=${id}]`;
    if (typeof name === 'string') return `[name=${name}]`;
  }
  return `[${i}]`;
}

// What a string at `where` holds that a push run can read differently.
function checkText(file: string, where: string, text: string, hits: Hit[], what = 'value') {
  const exprs = [...text.matchAll(EXPRESSION)].filter((m) => !SAME_ON_BOTH.has(m[1].trim()));
  for (const m of exprs) {
    hits.push({
      file,
      where,
      value: text,
      reason: `an expression other than run_id and runner.temp: ${m[0]}`
    });
  }
  if (RUNNER_NAME.test(text)) {
    hits.push({
      file,
      where,
      value: text,
      reason: `the ${what} names a runner variable or reads the event`
    });
  }
}

// Every `if` and `uses` key and every string at any depth, keys included.
function walk(file: string, node: unknown, where: string, hits: Hit[]) {
  if (Array.isArray(node)) {
    const names = node.map((item, i) => itemName(item, i));
    node.forEach((item, i) => {
      // Two items with one id or name fall back to their index, so an entry
      // keyed by that name stops matching rather than matching either.
      const name = names.filter((n) => n === names[i]).length > 1 ? `[${i}]` : names[i];
      walk(file, item, `${where}${name}`, hits);
    });
    return;
  }
  if (typeof node === 'string') return checkText(file, where, node, hits);
  if (!node || typeof node !== 'object') return;
  for (const [key, value] of Object.entries(node)) {
    const at = `${where}.${key}`;
    checkText(file, at, key, hits, 'key');
    if (key === 'if' && String(value).trim() !== 'always()') {
      hits.push({
        file,
        where: at,
        value: String(value),
        reason: `if is not always(): ${String(value).trim()}`
      });
    }
    if (key === 'uses' && String(value).includes('github-script')) {
      hits.push({
        file,
        where: at,
        value: String(value),
        reason: `uses runs code that gets the event: ${value}`
      });
    }
    walk(file, value, at, hits);
  }
}

type Parse = (text: string) => unknown;

// Exits 1 when the merge commit holds another tree than the pushed SHA.
function compareTrees(commit: string, mergeCommit: string) {
  const [tree, mergeTree] = [commit, mergeCommit].map((c) =>
    git(['rev-parse', `${c}^{tree}`]).trim()
  );
  if (tree === mergeTree) return;
  console.log(
    `merge commit ${mergeCommit.slice(0, 8)} holds tree ${mergeTree}, the pushed SHA tree ${tree}`
  );
  console.log(
    `check-push-repeats-pr: ${commit.slice(0, 8)}: the merge holds files no CI run tested together; wait on main's run`
  );
  process.exit(1);
}

function parseHits(commit: string, file: string, parseYaml: Parse, workflow: boolean, hits: Hit[]) {
  let doc: unknown;
  try {
    doc = parseYaml(git(['show', `${commit}:${file}`]));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    hits.push({
      file,
      where: '',
      value: '',
      reason: `not readable as YAML (${message.split('\n')[0]})`
    });
    return;
  }
  walk(file, doc, '', hits);
  if (workflow) {
    checkTriggers(file, doc, hits);
    checkJobs(file, doc, hits);
  }
}

function grepHits(commit: string, scanned: string[], hits: Hit[]) {
  const excluded = [':!*.md', ':!graphify-out', ...scanned.map((f) => `:(literal,exclude)${f}`)];
  const grep = git(['grep', '-nE', RUNNER_NAME.source, commit, '--', '.', ...excluded], [0, 1]);
  for (const out of grep.split('\n').filter(Boolean)) {
    const binary = /^Binary file (.+) matches$/.exec(out);
    if (binary) {
      const file = binary[1].replace(`${commit}:`, '');
      hits.push({
        file,
        where: '',
        value: '',
        reason: 'a binary file that names a runner variable'
      });
      continue;
    }
    const m = /^[0-9a-f]+:(.+?):(\d+):(.*)$/.exec(out);
    if (!m) fail(`cannot read git grep line: ${out}`);
    const [, file, line, text] = m;
    hits.push({
      file,
      where: `:${line}`,
      value: text.trim(),
      reason: 'names a runner variable or reads the event'
    });
  }
}

const matches = (a: Allowed, hit: Hit) =>
  a.file === hit.file &&
  (('path' in a && a.path === hit.where && a.value === hit.value) ||
    ('line' in a && hit.where.startsWith(':') && a.line === hit.value));

function where(hit: Hit): string {
  if (hit.where.startsWith(':')) return hit.where;
  return hit.where ? ` ${hit.where}` : '';
}

// Each hit ALLOWED does not list, each pinned blob that changed, and each
// entry that matched nothing.
function differencesFrom(commit: string, hits: Hit[]): string[] {
  const used = new Set<Allowed>();
  const differences: string[] = [];
  for (const hit of hits) {
    const entry = ALLOWED.find((a) => matches(a, hit));
    if (entry) used.add(entry);
    else differences.push(`${hit.file}${where(hit)}: ${hit.reason}`);
  }
  for (const entry of ALLOWED) {
    if (!('blob' in entry)) continue;
    const blob = git(
      ['rev-parse', '--verify', '--quiet', `${commit}:${entry.file}`],
      [0, 1]
    ).trim();
    if (blob !== entry.blob)
      differences.push(`${entry.file}: blob ${blob || 'missing'}, not the one ALLOWED pins`);
    used.add(entry);
  }
  for (const entry of ALLOWED.filter((a) => !used.has(a))) {
    const at = 'path' in entry ? entry.path : JSON.stringify((entry as { line: string }).line);
    differences.push(`${entry.file} ${at}: listed in ALLOWED but not found as listed`);
  }
  return differences;
}

function main() {
  const [pushed, merge] = process.argv.slice(2);
  if (!pushed || !merge || process.argv.length > 4) {
    fail('usage: bun scripts/check-push-repeats-pr.ts <pushed SHA> <merge SHA>');
  }
  const parseYaml = (Bun as { YAML?: { parse?: Parse } }).YAML?.parse;
  if (typeof parseYaml !== 'function')
    fail(`Bun ${Bun.version} has no YAML parser; run it through nix develop`);

  cwd = git(['rev-parse', '--show-toplevel']).trim();
  const commit = resolve(pushed, 'pushed SHA');
  compareTrees(commit, resolve(merge, 'merge SHA'));

  const files = git(['ls-tree', '-r', '--name-only', '-z', commit]).split('\0').filter(Boolean);
  const isYaml = (f: string) => /\.ya?ml$/.test(f);
  const workflows = files.filter((f) => f.startsWith('.forgejo/workflows/') && isYaml(f));
  const scanned = files.filter(
    (f) => (f.startsWith('.forgejo/') && isYaml(f)) || /(^|\/)action\.ya?ml$/.test(f)
  );
  const hits: Hit[] = [];
  if (!workflows.length)
    hits.push({ file: '.forgejo/workflows/', where: '', value: '', reason: 'no workflow file' });
  for (const f of files.filter((f) => /^\.(github|gitea)\/workflows\//.test(f))) {
    hits.push({ file: f, where: '', value: '', reason: 'a workflow this script does not read' });
  }
  for (const file of scanned) parseHits(commit, file, parseYaml, workflows.includes(file), hits);
  grepHits(commit, scanned, hits);

  const differences = differencesFrom(commit, hits);
  const short = commit.slice(0, 8);
  if (differences.length) {
    for (const d of differences) console.log(d);
    console.log(
      'check-push-repeats-pr: to keep a difference on purpose, give it an ALLOWED entry in ' +
        'scripts/check-push-repeats-pr.ts with its kind (pr-only, inert or push-extra) and why ' +
        'the skip still holds, or fix the entry it no longer matches'
    );
    console.log(
      `check-push-repeats-pr: ${short}: ${differences.length} difference(s); wait on main's run`
    );
    process.exit(1);
  }
  console.log(
    `check-push-repeats-pr: ${short}: the push run repeats the PR run apart from the ${ALLOWED.length} ` +
      `listed difference(s) (${workflows.length} workflow file(s), ${scanned.length} YAML file(s) read)`
  );
}

if (import.meta.main) main();

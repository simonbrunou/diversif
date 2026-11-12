// scripts/wait-e2e-slot.sh against a fake forge (#615). Each waiter is a git
// repo of its own that holds a copy of the script and a ci.yml naming the
// E2E job, so the script reads that repo's top level as the waiter's
// identity. A fake HOME holds the token, and E2E_SLOT_CLAIM points the claim
// and its queue at a directory each test empties. E2E_WAIT=0 makes each call
// a single poll: exit 3 when it reads busy, exit 0 when it takes the slot.
// The tests write stale stamps back-dated instead of waiting them out.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const scriptPath = path.resolve(import.meta.dir, 'wait-e2e-slot.sh');
const neededPath = path.resolve(import.meta.dir, 'e2e-needed.sh');
const JOB = 'End-to-end tests (Playwright)';
// The script's stale bound for a waiter's last poll.
const WAITER_TTL = 120;
// A test makes up to seven calls, each about 50 ms of bash, git, curl and
// jq. A loaded CI runner stalls a process for seconds (#572), so the tests
// get 30 s instead of the 5 s default.
const TIMEOUT = 30_000;
// The commit of the busy run, which a waiter can name as its own.
const RUN_SHA = 'ab'.repeat(20);

// Per test: whether another run's E2E job is running, whether the forge
// answers every request with a 401, and what to run when it answers for the
// run list.
let busy = false;
let refuse = false;
let onRunList: (() => void) | null = null;
// Per test: the runs the forge lists after run 7, each with its jobs.
let others: { run: Record<string, unknown>; jobs: unknown[] }[] = [];
// Per test: the forge's answer to `pulls/main/<branch>`, the docs-only
// check's PR lookup (a status, or 'drop' to close the connection with no
// reply), and each such request as the forge got it, headers included.
let pullStatus: number | 'drop' = 404;
let pullRequests: string[] = [];

// The answer to one request path, query string left out: the run list (the
// script's first probe asks for it too), a run's jobs, or a PR lookup. null
// closes the connection with no reply.
function answer(requestPath: string, request: string): { status: number; body: string } | null {
  if (refuse) return { status: 401, body: '' };
  if (requestPath.includes('/pulls/')) {
    pullRequests.push(request);
    if (pullStatus === 'drop') return null;
    const pull = pullStatus === 200 ? JSON.stringify({ number: 742, state: 'closed' }) : '';
    return { status: pullStatus, body: pull };
  }
  if (requestPath.endsWith('/actions/runs')) {
    onRunList?.();
    const runs: Record<string, unknown>[] = busy
      ? [
          {
            id: 7,
            index_in_repo: 41,
            title: 'another PR',
            commit_sha: RUN_SHA,
            workflow_id: 'ci.yml'
          }
        ]
      : [];
    runs.push(...others.map((other) => other.run));
    return { status: 200, body: JSON.stringify({ workflow_runs: runs }) };
  }
  if (requestPath.endsWith('/actions/runs/7/jobs')) {
    return { status: 200, body: JSON.stringify([{ name: JOB, status: 'running' }]) };
  }
  const other = others.find(({ run }) => requestPath.endsWith(`/actions/runs/${run.id}/jobs`));
  if (other) return { status: 200, body: JSON.stringify(other.jobs) };
  return { status: 404, body: '' };
}

// A run that waits beside run 7, with the fields a test gives it.
function waitingRun(fields: Record<string, unknown>) {
  return {
    id: 8,
    index_in_repo: 42,
    title: 'a waiting run',
    commit_sha: 'cd'.repeat(20),
    status: 'waiting',
    ...fields
  };
}
// The one job of renovate-config.yml, which waits for a runner slot (#698).
const VALIDATOR = { name: 'renovate-config-validator --strict', status: 'waiting' };

// Raw HTTP over Bun.listen: the test preload replaces the global Response
// with happy-dom's, which Bun.serve refuses.
const server = Bun.listen<{ request: string }>({
  hostname: '127.0.0.1',
  port: 0,
  socket: {
    open(socket) {
      socket.data = { request: '' };
    },
    data(socket, chunk) {
      socket.data.request += chunk.toString();
      if (!socket.data.request.includes('\r\n\r\n')) return;
      const reply = answer(socket.data.request.split(' ')[1].split('?')[0], socket.data.request);
      if (!reply) {
        socket.end();
        return;
      }
      const { status, body } = reply;
      socket.end(
        [
          `HTTP/1.1 ${status} X`,
          'Content-Type: application/json',
          `Content-Length: ${Buffer.byteLength(body)}`,
          'Connection: close',
          '',
          body
        ].join('\r\n')
      );
    }
  }
});
const api = `http://127.0.0.1:${server.port}/api/v1/repos/simonbrunou/diversif`;

interface Waiter {
  script: string;
  // The repo's top level, as git prints it: the script's identity for it.
  id: string;
}

let root: string;
let home: string;
let claimDir: string;
let claim: string;
let queueFile: string;
let a: Waiter;
let b: Waiter;

// A git repo holding a copy of the script and a ci.yml that names the job.
function waiter(name: string): Waiter {
  const repo = path.join(root, name);
  mkdirSync(path.join(repo, 'scripts'), { recursive: true });
  mkdirSync(path.join(repo, '.forgejo', 'workflows'), { recursive: true });
  const script = path.join(repo, 'scripts', 'wait-e2e-slot.sh');
  copyFileSync(scriptPath, script);
  writeFileSync(
    path.join(repo, '.forgejo', 'workflows', 'ci.yml'),
    `jobs:\n  e2e:\n    name: ${JOB}\n`
  );
  expect(Bun.spawnSync({ cmd: ['git', 'init', '-q', repo] }).exitCode).toBe(0);
  const top = Bun.spawnSync({ cmd: ['git', '-C', repo, 'rev-parse', '--show-toplevel'] });
  return { script, id: top.stdout.toString().trim() };
}

beforeAll(() => {
  root = mkdtempSync(path.join(tmpdir(), 'wait-e2e-slot-test-'));
  home = path.join(root, 'home');
  const keys = path.join(home, '.local', 'share', 'forgejo-cli');
  mkdirSync(keys, { recursive: true });
  writeFileSync(
    path.join(keys, 'keys.json'),
    JSON.stringify({ hosts: { 'git.sbrn.eu': { token: 'fake' } } })
  );
  claimDir = path.join(root, 'claim');
  claim = path.join(claimDir, 'slot.claim');
  queueFile = `${claim}.queue`;
  a = waiter('a');
  b = waiter('b');
});

afterAll(() => {
  server.stop(true);
  rmSync(root, { recursive: true, force: true });
});

beforeEach(() => {
  busy = false;
  refuse = false;
  onRunList = null;
  others = [];
  pullStatus = 404;
  pullRequests = [];
  rmSync(claimDir, { recursive: true, force: true });
  mkdirSync(claimDir);
});

// Async spawn: the fake forge answers on this process's event loop, which
// Bun.spawnSync would block. args holds the waiter's own SHA, if any.
async function call(w: Waiter, args: string[] = []) {
  const proc = Bun.spawn({
    cmd: ['bash', w.script, ...args],
    env: {
      ...process.env,
      HOME: home,
      E2E_SLOT_API: api,
      E2E_SLOT_CLAIM: claim,
      E2E_WAIT: '0',
      // The clock times it prints, which ahead() compares.
      TZ: 'UTC',
      // A proxy from the shell would answer for the fake forge.
      no_proxy: '*',
      NO_PROXY: '*'
    },
    stdout: 'pipe',
    stderr: 'pipe'
  });
  const [stdout, stderr, code] = await Promise.all([
    Bun.readableStreamToText(proc.stdout),
    Bun.readableStreamToText(proc.stderr),
    proc.exited
  ]);
  // Only an exit 2 writes to stderr: anything else there is a bash error.
  if (code !== 2) expect(stderr).toBe('');
  return { code, stdout, stderr };
}

const now = () => Math.floor(Date.now() / 1000);

// The queue's lines, in file order.
function queue() {
  let text = '';
  try {
    text = readFileSync(queueFile, 'utf8');
  } catch {
    // No queue yet.
  }
  return text
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [joined, seen, ...who] = line.split(' ');
      return { joined: Number(joined), seen: Number(seen), who: who.join(' ') };
    });
}

function holder(): string {
  return readFileSync(claim, 'utf8').trim().split(' ').slice(1).join(' ');
}

// The line that prints a waiter ahead, with the UTC clock time it joined
// when the test knows it: call runs the script with TZ=UTC.
const ahead = (w: Waiter, joined?: number) =>
  new RegExp(
    `^ahead in the queue: ${RegExp.escape(w.id)}, waiting since ${
      joined === undefined
        ? '\\d\\d:\\d\\d:\\d\\d'
        : new Date(joined * 1000).toISOString().slice(11, 19)
    }$`,
    'm'
  );

// A branch name with every character class the docs-only check accepts:
// lower and upper case letters, digits, '.', '_', '/' and '-'.
const BRANCH = 'docs/Retro-681_v2.x';
const DOCS_ONLY_LINE =
  /^wait-e2e-slot: clear at \d\d:\d\d:\d\d: the branch changes only Markdown files and docs\/ and has no PR yet, so its PR's E2E job will run no Playwright test$/m;

function git(repo: string, ...args: string[]): string {
  const run = Bun.spawnSync({
    cmd: ['git', '-C', repo, '-c', 'user.name=t', '-c', 'user.email=t@t.invalid']
      .concat(['-c', 'commit.gpgsign=false'])
      .concat(args)
  });
  expect(run.stderr.toString()).toBe('');
  expect(run.exitCode).toBe(0);
  return run.stdout.toString().trim();
}

// A waiter on a branch whose one commit adds `file`, with its origin/main
// and origin/<branch> refs, as after a push of the branch, and a copy of
// scripts/e2e-needed.sh, which the docs-only check runs. Each call makes a
// repo of its own.
let docsRepos = 0;
function docsWaiter({ branch = BRANCH, file = 'docs/notes.md' } = {}): Waiter & { repo: string } {
  const w = waiter(`docs-${++docsRepos}`);
  const repo = path.dirname(path.dirname(w.script));
  const needed = path.join(repo, 'scripts', 'e2e-needed.sh');
  copyFileSync(neededPath, needed);
  chmodSync(needed, 0o755);
  git(repo, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'base');
  git(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(repo, 'checkout', '-q', '-b', branch);
  mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  writeFileSync(path.join(repo, file), 'a change\n');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'change');
  git(repo, 'update-ref', `refs/remotes/origin/${branch}`, 'HEAD');
  return { ...w, repo };
}

describe('scripts/wait-e2e-slot.sh', () => {
  it(
    'lets a lone caller take a clear slot on its first poll, and keeps it out of the queue',
    async () => {
      const run = await call(a);
      expect(run.stderr).toBe('');
      expect(run.stdout).toMatch(/^wait-e2e-slot: clear at \d\d:\d\d:\d\d$/m);
      expect(run.code).toBe(0);
      expect(holder()).toBe(a.id);
      expect(queue()).toEqual([]);
    },
    TIMEOUT
  );

  it(
    "reads another worktree's fresh claim as busy, and queues the caller",
    async () => {
      writeFileSync(claim, `${now()} ${b.id}\n`);
      const run = await call(a);
      expect(run.stdout).toMatch(new RegExp(`^claimed by ${RegExp.escape(b.id)} \\d+ s ago$`, 'm'));
      expect(run.code).toBe(3);
      expect(queue().map((line) => line.who)).toEqual([a.id]);
    },
    TIMEOUT
  );

  it(
    'serves the waiters in the order they joined',
    async () => {
      busy = true;
      expect((await call(a)).code).toBe(3);
      const second = await call(b);
      expect(second.stdout).toContain('run 7 #41 another PR: E2E running');
      expect(second.stdout).toMatch(ahead(a));
      expect(second.code).toBe(3);
      expect(queue().map((line) => line.who)).toEqual([a.id, b.id]);

      // The slot clears: B polls first, and A still goes first.
      busy = false;
      const behind = await call(b);
      expect(behind.stdout).toMatch(ahead(a));
      expect(behind.stdout).not.toContain('clear at');
      expect(behind.code).toBe(3);
      const head = await call(a);
      expect(head.stdout).not.toContain('ahead in the queue');
      expect(head.code).toBe(0);
      expect(holder()).toBe(a.id);
      expect(queue().map((line) => line.who)).toEqual([b.id]);

      // B is first now, and waits for A's claim.
      const claimed = await call(b);
      expect(claimed.stdout).toContain(`claimed by ${a.id}`);
      expect(claimed.code).toBe(3);
      rmSync(claim);
      expect((await call(b)).code).toBe(0);
      expect(holder()).toBe(b.id);
      expect(queue()).toEqual([]);
    },
    TIMEOUT
  );

  it(
    'keeps the join time of a call that ended on exit 3 for the next call',
    async () => {
      busy = true;
      expect((await call(a)).code).toBe(3);
      // Back-date A's join, still live, so a kept join time differs from a new one.
      const joined = now() - 60;
      writeFileSync(queueFile, `${joined} ${now()} ${a.id}\n`);
      expect((await call(b)).code).toBe(3);
      const before = now();
      expect((await call(a)).code).toBe(3);
      const [first, second] = queue();
      expect(first.who).toBe(a.id);
      expect(first.joined).toBe(joined);
      expect(first.seen).toBeGreaterThanOrEqual(before);
      expect(second.who).toBe(b.id);

      busy = false;
      expect((await call(b)).stdout).toMatch(ahead(a, joined));
      expect((await call(a)).code).toBe(0);
    },
    TIMEOUT
  );

  it(
    'orders the waiters by the time they joined, before their place in the file',
    async () => {
      const t = now();
      writeFileSync(queueFile, `${t - 30} ${t} ${a.id}\n${t - 90} ${t} ${b.id}\n`);
      const later = await call(a);
      expect(later.stdout).toMatch(ahead(b, t - 90));
      expect(later.code).toBe(3);
      expect((await call(b)).code).toBe(0);
    },
    TIMEOUT
  );

  it(
    'keeps a later waiter behind when only its own check reads clear',
    async () => {
      busy = true;
      expect((await call(a)).code).toBe(3);
      // The busy run is B's own, which its check leaves out.
      const behind = await call(b, [RUN_SHA.slice(0, 7)]);
      expect(behind.stdout).not.toContain('run 7');
      expect(behind.stdout).toMatch(ahead(a));
      expect(behind.code).toBe(3);
    },
    TIMEOUT
  );

  it(
    'puts the holder of a fresh claim before every waiter when it calls again',
    async () => {
      expect((await call(a)).code).toBe(0);
      expect((await call(b)).code).toBe(3);
      // A's chained command failed before it started an E2E job.
      const again = await call(a);
      expect(again.stdout).not.toContain('ahead in the queue');
      expect(again.code).toBe(0);
      expect(holder()).toBe(a.id);
      expect(queue().map((line) => line.who)).toEqual([b.id]);
      expect((await call(b)).stdout).toContain(`claimed by ${a.id}`);
    },
    TIMEOUT
  );

  it.each([
    ['stale', -300],
    ['from the future', 60]
  ])(
    'queues the holder of a claim %s behind the waiters',
    async (_, offset) => {
      const t = now();
      writeFileSync(claim, `${t + offset} ${a.id}\n`);
      writeFileSync(queueFile, `${t} ${t} ${b.id}\n`);
      const run = await call(a);
      expect(run.stdout).toMatch(ahead(b));
      expect(run.code).toBe(3);
    },
    TIMEOUT
  );

  it(
    'drops a waiter that stopped polling, or whose stamp lies in the future',
    async () => {
      const t = now();
      // A live waiter still blocks: 90 s leaves room for a slow runner.
      writeFileSync(queueFile, `${t - 300} ${t - 90} ${b.id}\n`);
      const blocked = await call(a);
      expect(blocked.stdout).toMatch(ahead(b));
      expect(blocked.code).toBe(3);

      writeFileSync(
        queueFile,
        `${t - 300} ${t - WAITER_TTL} ${b.id}\n${t - 200} ${t + 60} /elsewhere/future\n`
      );
      const run = await call(a);
      expect(run.stdout).not.toContain('ahead in the queue');
      expect(run.code).toBe(0);
      expect(queue()).toEqual([]);
    },
    TIMEOUT
  );

  it(
    'refreshes its line before the forge check as well as after it',
    async () => {
      const t = now();
      writeFileSync(queueFile, `${t - 300} ${t - 60} ${a.id}\n`);
      const stamps: number[] = [];
      onRunList = () => stamps.push(queue().find((line) => line.who === a.id)?.seen ?? 0);
      busy = true;
      expect((await call(a)).code).toBe(3);
      // The first probe sees the old stamp, the forge check a refreshed one.
      expect(stamps).toHaveLength(2);
      expect(stamps[0]).toBe(t - 60);
      expect(stamps[1]).toBeGreaterThanOrEqual(t);
      expect(queue()[0].joined).toBe(t - 300);
    },
    TIMEOUT
  );

  it(
    'drops the caller from the queue on exit 2',
    async () => {
      busy = true;
      expect((await call(a)).code).toBe(3);
      expect((await call(b)).code).toBe(3);
      refuse = true;
      const refused = await call(a);
      expect(refused.stderr).toContain('the forge answered 401');
      expect(refused.code).toBe(2);
      expect(queue().map((line) => line.who)).toEqual([b.id]);

      refuse = false;
      busy = false;
      expect((await call(b)).code).toBe(0);
    },
    TIMEOUT
  );

  it(
    'reads a waiting run of another workflow as clear, and prints no line for it',
    async () => {
      others = [{ run: waitingRun({ workflow_id: 'renovate-config.yml' }), jobs: [VALIDATOR] }];
      const run = await call(a);
      expect(run.stdout).toMatch(/^wait-e2e-slot: clear at \d\d:\d\d:\d\d$/m);
      expect(run.stdout).not.toMatch(/^run /m);
      expect(run.code).toBe(0);
    },
    TIMEOUT
  );

  it(
    'reads a waiting ci.yml run that lists no E2E job yet as busy',
    async () => {
      others = [{ run: waitingRun({ workflow_id: 'ci.yml' }), jobs: [] }];
      const run = await call(a);
      expect(run.stdout).toMatch(/^run 8 #42 a waiting run: E2E missing$/m);
      expect(run.code).toBe(3);
    },
    TIMEOUT
  );

  it.each([
    ['no workflow_id', {}],
    ['a null workflow_id', { workflow_id: null }],
    ['a workflow_id that is not a string', { workflow_id: 3 }],
    ['an empty workflow_id', { workflow_id: '' }]
  ])(
    'reads a waiting run with %s and no E2E job as busy',
    async (_, fields) => {
      others = [{ run: waitingRun(fields), jobs: [VALIDATOR] }];
      const run = await call(a);
      expect(run.stdout).toMatch(/^run 8 #42 a waiting run: E2E missing$/m);
      expect(run.code).toBe(3);
    },
    TIMEOUT
  );

  it(
    'prints only the ci.yml run when a run of another workflow waits beside it',
    async () => {
      busy = true;
      others = [{ run: waitingRun({ workflow_id: 'renovate-config.yml' }), jobs: [VALIDATOR] }];
      const run = await call(a);
      expect(run.stdout).toMatch(/^run 7 #41 another PR: E2E running$/m);
      expect(run.stdout).not.toContain('run 8');
      expect(run.code).toBe(3);
    },
    TIMEOUT
  );
});

// A branch that changes only Markdown files and docs/, is pushed and never
// had a PR into main clears at once (#681 retro): opening its PR starts a
// run whose E2E job is skipped. Each other case waits as before, here behind
// run 7.
describe('scripts/wait-e2e-slot.sh before the first PR of a docs-only branch', () => {
  it(
    'clears at once while another E2E job runs, claims nothing and leaves the queue',
    async () => {
      busy = true;
      const w = docsWaiter();
      const t = now();
      writeFileSync(queueFile, `${t - 60} ${t} ${b.id}\n${t - 30} ${t} ${w.id}\n`);
      const run = await call(w);
      expect(run.stdout).toMatch(DOCS_ONLY_LINE);
      expect(run.stdout).not.toContain('run 7');
      expect(run.code).toBe(0);
      expect(existsSync(claim)).toBe(false);
      expect(queue().map((line) => line.who)).toEqual([b.id]);
      expect(pullRequests).toHaveLength(1);
      expect(pullRequests[0]).toStartWith(
        `GET /api/v1/repos/simonbrunou/diversif/pulls/main/${BRANCH} HTTP/1.1\r\n`
      );
      expect(pullRequests[0]).toContain('\r\nAuthorization: token fake\r\n');
    },
    TIMEOUT
  );

  it.each([
    ['a PR, closed', 200],
    ['a 401', 401],
    ['a 500', 500],
    ['no reply', 'drop' as const]
  ])(
    'waits when the PR lookup answers %s',
    async (_, status) => {
      busy = true;
      pullStatus = status;
      const w = docsWaiter();
      const run = await call(w);
      expect(pullRequests).toHaveLength(1);
      expect(run.stdout).not.toMatch(DOCS_ONLY_LINE);
      expect(run.stdout).toContain('run 7 #41 another PR: E2E running');
      expect(run.code).toBe(3);
    },
    TIMEOUT
  );

  it(
    'waits when an <own sha> argument names the branch head',
    async () => {
      busy = true;
      const w = docsWaiter();
      const run = await call(w, [git(w.repo, 'rev-parse', 'HEAD')]);
      expect(run.stdout).not.toMatch(DOCS_ONLY_LINE);
      expect(run.code).toBe(3);
    },
    TIMEOUT
  );

  it(
    'waits on a docs commit not pushed yet',
    async () => {
      busy = true;
      const w = docsWaiter();
      writeFileSync(path.join(w.repo, 'docs', 'more.md'), 'more\n');
      git(w.repo, 'add', '.');
      git(w.repo, 'commit', '-q', '-m', 'not pushed');
      const run = await call(w);
      expect(run.stdout).not.toMatch(DOCS_ONLY_LINE);
      expect(run.code).toBe(3);
    },
    TIMEOUT
  );

  it(
    'waits for a branch that changes a file outside docs/ and *.md',
    async () => {
      busy = true;
      const run = await call(docsWaiter({ file: 'src/probe.ts' }));
      expect(run.stdout).not.toMatch(DOCS_ONLY_LINE);
      expect(run.code).toBe(3);
    },
    TIMEOUT
  );

  it(
    'waits when the checkout has no scripts/e2e-needed.sh',
    async () => {
      busy = true;
      const w = docsWaiter();
      rmSync(path.join(w.repo, 'scripts', 'e2e-needed.sh'));
      const run = await call(w);
      expect(run.stdout).not.toMatch(DOCS_ONLY_LINE);
      expect(run.code).toBe(3);
    },
    TIMEOUT
  );

  it(
    'waits for a branch name with a character outside [A-Za-z0-9._/-]',
    async () => {
      busy = true;
      const run = await call(docsWaiter({ branch: 'docs/retro#681' }));
      expect(pullRequests).toEqual([]);
      expect(run.stdout).not.toMatch(DOCS_ONLY_LINE);
      expect(run.code).toBe(3);
    },
    TIMEOUT
  );

  it(
    'waits on a detached HEAD',
    async () => {
      busy = true;
      const w = docsWaiter();
      git(w.repo, 'checkout', '-q', '--detach');
      const run = await call(w);
      expect(run.stdout).not.toMatch(DOCS_ONLY_LINE);
      expect(run.code).toBe(3);
    },
    TIMEOUT
  );
});

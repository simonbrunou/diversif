// scripts/wait-e2e-slot.sh against a fake forge (#615). Each waiter is a git
// repo of its own that holds a copy of the script and a ci.yml naming the
// E2E job, so the script reads that repo's top level as the waiter's
// identity. A fake HOME holds the token, and E2E_SLOT_CLAIM points the claim
// and its queue at a directory each test empties. E2E_WAIT=0 makes each call
// a single poll: exit 3 when it reads busy, exit 0 when it takes the slot.
// The tests write stale stamps back-dated instead of waiting them out.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const scriptPath = path.resolve(import.meta.dir, 'wait-e2e-slot.sh');
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

// The answer to one request path, query string left out: the run list (the
// script's first probe asks for it too) or run 7's jobs.
function answer(requestPath: string): { status: number; body: string } {
  if (refuse) return { status: 401, body: '' };
  if (requestPath.endsWith('/actions/runs')) {
    onRunList?.();
    const runs = busy
      ? [{ id: 7, index_in_repo: 41, title: 'another PR', commit_sha: RUN_SHA }]
      : [];
    return { status: 200, body: JSON.stringify({ workflow_runs: runs }) };
  }
  if (requestPath.endsWith('/actions/runs/7/jobs')) {
    return { status: 200, body: JSON.stringify([{ name: JOB, status: 'running' }]) };
  }
  return { status: 404, body: '' };
}

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
      const { status, body } = answer(socket.data.request.split(' ')[1].split('?')[0]);
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
});

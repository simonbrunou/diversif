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
// jq. A loaded CI runner stalls a process for seconds (testing.md, « A
// wall-clock assertion »), so the tests get 30 s instead of the 5 s default.
const TIMEOUT = 30_000;

// Per test: whether another run's E2E job is running, and whether the forge
// answers every request with a 401.
let busy = false;
let refuse = false;

// The answer to one request path, query string left out: the run list (the
// script's first probe asks for it too) or run 7's jobs.
function answer(requestPath: string): { status: number; body: string } {
  if (refuse) return { status: 401, body: '' };
  if (requestPath.endsWith('/actions/runs')) {
    const runs = busy
      ? [{ id: 7, index_in_repo: 41, title: 'another PR', commit_sha: 'ab'.repeat(20) }]
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
  rmSync(claimDir, { recursive: true, force: true });
  mkdirSync(claimDir);
});

// Async spawn: the fake forge answers on this process's event loop, which
// Bun.spawnSync would block.
async function call(w: Waiter) {
  const proc = Bun.spawn({
    cmd: ['bash', w.script],
    env: {
      ...process.env,
      HOME: home,
      E2E_SLOT_API: api,
      E2E_SLOT_CLAIM: claim,
      E2E_WAIT: '0',
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

const ahead = (w: Waiter) =>
  new RegExp(
    `^ahead in the queue: ${RegExp.escape(w.id)}, waiting since \\d\\d:\\d\\d:\\d\\d$`,
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
      expect((await call(b)).stdout).toMatch(ahead(a));
      expect((await call(a)).code).toBe(0);
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

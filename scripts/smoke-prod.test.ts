// scripts/smoke-prod.sh against a local server that answers every check the
// way production does, except where a test makes it drop a request (close the
// connection without an answer), leave one unanswered or answer with another
// status. A fake `sleep` on PATH logs its argument and returns at once, so the
// retry spacing is asserted without waiting for it. A run with a SHA uses a
// tracked copy of the script in a git repo with no origin remote: its fetch
// fails, so the wait matches the SHA as a prefix of the live one. Two tests
// give that repo an origin whose fetch stalls instead: a local bare repo whose
// upload-pack command sleeps 15 s first. They use the real `sleep`, since the
// fake one would end the stall at once, and the timer that cuts the fetch too.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const scriptPath = path.resolve(import.meta.dir, 'smoke-prod.sh');

interface Answer {
  status: number;
  headers?: Record<string, string>;
  body?: string;
}

const html = { 'Content-Type': 'text/html; charset=utf-8' };
const js = { 'Content-Type': 'text/javascript' };
const production: Record<string, Answer> = {
  '/': {
    status: 200,
    headers: {
      ...html,
      'Content-Security-Policy': "default-src 'self'; script-src 'self'",
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Frame-Options': 'DENY'
    },
    body: '<!doctype html><html></html>'
  },
  '/guide': { status: 200, headers: html, body: '<html></html>' },
  '/en': { status: 200, headers: html, body: '<html></html>' },
  '/_app/env.js': { status: 200, headers: js, body: 'export const env = {};' },
  '/service-worker.js': { status: 200, headers: js, body: 'self;' },
  '/sw.js': { status: 404, body: 'Not found' },
  '/healthz': {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: '{"ok":true,"db":"ok","uptimeMs":51000}'
  },
  // Production serves the prerendered page with no Content-Type.
  '/offline': { status: 200, body: '<!doctype html><html></html>' }
};

// Per test: the requests to drop (path -> how many first requests), the
// answers that differ from production, and the replies that depend on the
// request's number (path -> a function of it). A reply of 'hang' keeps the
// connection open and never answers; undefined falls through to the others.
let drops: Record<string, number> = {};
let overrides: Record<string, Answer> = {};
let replies: Record<string, (n: number) => Answer | 'hang' | undefined> = {};
const hits = new Map<string, number>();

function render({ status, headers = {}, body = '' }: Answer): string {
  const lines = [
    `HTTP/1.1 ${status} X`,
    `Content-Length: ${Buffer.byteLength(body)}`,
    'Connection: close'
  ];
  for (const [name, value] of Object.entries(headers)) lines.push(`${name}: ${value}`);
  return `${lines.join('\r\n')}\r\n\r\n${body}`;
}

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
      const requestPath = socket.data.request.split(' ')[1];
      const n = (hits.get(requestPath) ?? 0) + 1;
      hits.set(requestPath, n);
      const reply = replies[requestPath]?.(n);
      if (reply === 'hang') return;
      if (n <= (drops[requestPath] ?? 0)) {
        socket.end();
        return;
      }
      socket.end(
        render(reply ?? overrides[requestPath] ?? production[requestPath] ?? { status: 404 })
      );
    }
  }
});
const base = `http://127.0.0.1:${server.port}`;
const allPassed = `smoke-prod: 11 of 11 checks passed on ${base}`;

// A host that accepts every connection and never answers.
const silent = Bun.listen({ hostname: '127.0.0.1', port: 0, socket: { data() {} } });
const silentBase = `http://127.0.0.1:${silent.port}`;

const oldSha = 'fedcba9876543210fedcba9876543210fedcba98';
const newSha = '0123456789abcdef0123456789abcdef01234567';
const version = (sha: string): Answer => ({
  status: 200,
  headers: { 'Content-Type': 'application/json' },
  body: `{"version":"${sha}"}`
});

let binDir: string;
let sleepLog: string;

beforeAll(() => {
  binDir = mkdtempSync(path.join(tmpdir(), 'smoke-prod-test-'));
  sleepLog = path.join(binDir, 'sleeps');
  writeFileSync(path.join(binDir, 'sleep'), '#!/bin/sh\necho "$*" >>"$SLEEP_LOG"\n');
  chmodSync(path.join(binDir, 'sleep'), 0o755);
});

afterAll(() => {
  server.stop(true);
  silent.stop(true);
  rmSync(binDir, { recursive: true, force: true });
});

beforeEach(() => {
  drops = {};
  overrides = {};
  replies = {};
  hits.clear();
  writeFileSync(sleepLog, '');
});

// A tracked copy of the script in a new git repo. Given an upload-pack
// command, its origin remote is a local bare repo that runs that command for
// each fetch. Without one, the repo has no origin.
function trackedCopy(uploadpack?: string): string {
  const root = mkdtempSync(path.join(binDir, 'repo-'));
  const copy = path.join(root, 'scripts', 'smoke-prod.sh');
  mkdirSync(path.dirname(copy), { recursive: true });
  copyFileSync(scriptPath, copy);
  const cmds = [
    ['git', 'init', '-q', root],
    ['git', '-C', root, 'add', 'scripts/smoke-prod.sh']
  ];
  if (uploadpack) {
    const origin = mkdtempSync(path.join(binDir, 'origin-'));
    cmds.push(
      ['git', 'init', '-q', '--bare', origin],
      ['git', '-C', root, 'remote', 'add', 'origin', origin],
      ['git', '-C', root, 'config', 'remote.origin.uploadpack', uploadpack]
    );
  }
  for (const cmd of cmds) {
    expect(Bun.spawnSync({ cmd }).exitCode).toBe(0);
  }
  return copy;
}

// Whether a process runs. A dead one still exists, as a zombie, until
// something reaps it. In a CI job container, which has no init, nothing does,
// so on Linux a zombie counts as gone.
function running(pid: number): boolean {
  try {
    process.kill(pid, 0);
  } catch {
    return false;
  }
  if (process.platform !== 'linux') return true;
  try {
    // The state follows the command name, which sits in parentheses.
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
    return stat[stat.lastIndexOf(')') + 2] !== 'Z';
  } catch {
    return false;
  }
}

// Async spawn: the server answers on this process's event loop, which
// Bun.spawnSync would block until the script gave up. realSleep leaves the
// fake `sleep` off PATH, so the wait's sleeps take real time.
async function smoke(
  baseUrl = base,
  { script = scriptPath, args = [] as string[], wait = '', checkTime = '', realSleep = false } = {}
) {
  const started = performance.now();
  const proc = Bun.spawn({
    cmd: ['bash', script, ...args],
    env: {
      ...process.env,
      PATH: realSleep ? process.env.PATH : `${binDir}:${process.env.PATH}`,
      SMOKE_BASE_URL: baseUrl,
      ...(wait ? { SMOKE_WAIT: wait } : {}),
      ...(checkTime ? { SMOKE_CHECK_TIME: checkTime } : {}),
      SLEEP_LOG: sleepLog,
      // A proxy from the shell would answer for the local server.
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
  const lines = stdout.trimEnd().split('\n');
  return {
    ms: performance.now() - started,
    code,
    stderr,
    lines,
    last: lines.at(-1),
    retries: lines.filter((line) => line.startsWith('RETRY')),
    sleeps: readFileSync(sleepLog, 'utf8').split('\n').filter(Boolean)
  };
}

describe('scripts/smoke-prod.sh', () => {
  it('passes 11 of 11 without a SHA when every check answers', async () => {
    const run = await smoke();
    expect(run.stderr).toBe('');
    expect(run.last).toBe(allPassed);
    expect(run.code).toBe(0);
    expect(run.retries).toEqual([]);
    expect(run.sleeps).toEqual([]);
  });

  it('retries a request that gets no answer, 5 s later, and counts one PASS', async () => {
    drops = { '/healthz': 1 };
    const run = await smoke();
    expect(run.retries).toHaveLength(1);
    expect(run.retries[0]).toMatch(
      /^RETRY \/healthz got no answer \(curl: \(52\) [^)]+\), attempt 2 of 4 in 5 s$/
    );
    expect(run.sleeps).toEqual(['5']);
    expect(run.lines).toContain('PASS /healthz ok, db ok');
    expect(run.last).toBe(allPassed);
    expect(run.code).toBe(0);
  });

  it('fails a 500 at once, without a retry', async () => {
    overrides = { '/healthz': { status: 500, body: 'Internal Error' } };
    const run = await smoke();
    expect(run.lines).toContain('FAIL /healthz returned 500 with no Content-Type Internal Error');
    expect(run.retries).toEqual([]);
    expect(run.sleeps).toEqual([]);
    expect(hits.get('/healthz')).toBe(1);
    expect(run.last).toBe(`smoke-prod: 1 of 11 checks failed on ${base}`);
    expect(run.code).toBe(1);
  });

  it('checks the headers of the attempt that answered', async () => {
    drops = { '/': 1 };
    const run = await smoke();
    expect(run.retries).toHaveLength(1);
    expect(run.lines).toContain("PASS CSP has default-src 'self'");
    expect(run.lines).toContain('PASS HSTS max-age=31536000; includeSubDomains');
    expect(run.lines).toContain('PASS X-Frame-Options DENY');
    expect(run.last).toBe(allPassed);
  });

  it('leaves each later check its own retries after one passed on a retry', async () => {
    drops = { '/guide': 2, '/offline': 3 };
    const run = await smoke();
    expect(run.retries.map((line) => line.replace(/ got .*,/, ','))).toEqual([
      'RETRY /guide, attempt 2 of 4 in 5 s',
      'RETRY /guide, attempt 3 of 4 in 5 s',
      'RETRY /offline, attempt 2 of 4 in 5 s',
      'RETRY /offline, attempt 3 of 4 in 5 s',
      'RETRY /offline, attempt 4 of 4 in 5 s'
    ]);
    expect(run.sleeps).toEqual(['5', '5', '5', '5', '5']);
    expect(run.last).toBe(allPassed);
    expect(run.code).toBe(0);
  });

  it('on a dead host retries only the first check, then fails the others at once', async () => {
    // Port 9 (discard) is outside the ephemeral range that port-0 listeners
    // draw from, so no other test's server lands there.
    const deadBase = 'http://127.0.0.1:9';
    const run = await smoke(deadBase);
    expect(run.retries).toHaveLength(3);
    run.retries.forEach((line, i) => {
      expect(line).toMatch(
        new RegExp(
          `^RETRY / got no answer \\(curl: \\(7\\) [^)]+\\), attempt ${i + 2} of 4 in 5 s$`
        )
      );
    });
    expect(run.sleeps).toEqual(['5', '5', '5']);
    expect(run.lines.find((line) => line.startsWith('FAIL / '))).toContain('curl: (7)');
    expect(run.last).toBe(`smoke-prod: 11 of 11 checks failed on ${deadBase}`);
    expect(run.code).toBe(1);
  });

  // A copy can tell neither whether the SHA is on main nor whether the newer
  // live commit contains it. Without the guard it polls version.json until
  // SMOKE_WAIT runs out and exits 3 with PENDING, as #484's deploy check did.
  it.each([
    ['in a plain directory', false],
    ['untracked inside another git repo', true]
  ])('with a SHA, fails at once when run as a copy %s', async (_where, insideRepo) => {
    const root = mkdtempSync(path.join(binDir, 'copy-'));
    if (insideRepo) expect(Bun.spawnSync({ cmd: ['git', 'init', '-q', root] }).exitCode).toBe(0);
    const copy = path.join(root, 'scripts', 'smoke-prod.sh');
    mkdirSync(path.dirname(copy), { recursive: true });
    copyFileSync(scriptPath, copy);
    overrides['/_app/version.json'] = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: '{"version":"fedcba9876543210fedcba9876543210fedcba98"}'
    };
    const run = await smoke(base, {
      script: copy,
      args: ['0123456789abcdef0123456789abcdef01234567'],
      wait: '2'
    });
    expect(run.lines.find((line) => line.startsWith('FAIL '))).toBe(
      `FAIL ${copy} is not the scripts/smoke-prod.sh of a git checkout`
    );
    expect(run.last).toBe(
      'smoke-prod: run scripts/smoke-prod.sh by its path in a checkout, not a copy or a link'
    );
    expect(run.code).toBe(1);
    expect(hits.size).toBe(0);
  });

  // Every run ends by one deadline, SMOKE_WAIT + SMOKE_CHECK_TIME seconds after
  // it starts, so that it fits in one 600 s agent Bash call. A run still ends
  // a little past it: bash starts before the script reads its clock, and
  // curl's exit, the last FAIL lines and the exit trap come after. That
  // overshoot is about 20 ms locally and reached 887 ms on a loaded CI runner
  // (run 346), hence the slack. Before the deadline, each unanswered request
  // below took curl's full 20 s.
  const slack = 2000;
  const budgetFails = (lines: string[]) =>
    lines.filter((line) => line.endsWith(' not run: the time budget ran out'));

  it('with a SHA that goes live late in the wait, fails the checks left past the deadline', async () => {
    replies = {
      '/_app/version.json': (n) => version(n === 1 ? oldSha : newSha),
      '/guide': () => 'hang'
    };
    // The real sleep after the first poll is cut so that the second poll, the
    // last one of the wait, starts 1 s before SMOKE_WAIT ends. A 4 s wait
    // leaves the first poll 3 s: with a 2 s wait, a first poll slowed by a
    // loaded CI runner left no time for the second (run 347).
    const run = await smoke(base, {
      script: trackedCopy(),
      args: [newSha],
      wait: '4',
      checkTime: '1',
      realSleep: true
    });
    expect(run.ms).toBeLessThan(5000 + slack);
    // /guide hangs until the deadline, which the run cannot beat.
    expect(run.ms).toBeGreaterThan(4500);
    expect(hits.get('/_app/version.json')).toBe(2);
    expect(run.lines).toContain(`PASS /_app/version.json is ${newSha}`);
    expect(run.lines).toContain("PASS CSP has default-src 'self'");
    // Too little time left for a 5 s retry: the check keeps its curl error.
    expect(run.retries).toEqual([]);
    expect(run.lines.find((line) => line.startsWith('FAIL /guide '))).toMatch(
      /^FAIL \/guide returned no answer \(curl: \(28\) [^)]+\), expected 200 text\/html\*$/
    );
    expect(budgetFails(run.lines)).toEqual(
      ['/en', '/_app/env.js', '/service-worker.js', '/sw.js', '/healthz', '/offline'].map(
        (check) => `FAIL ${check} not run: the time budget ran out`
      )
    );
    expect(hits.has('/en')).toBe(false);
    expect(run.last).toBe(`smoke-prod: 7 of 12 checks failed on ${base}`);
    expect(run.code).toBe(1);
  }, 10_000);

  it.each([
    [
      'exits 3 when an older commit served',
      (n: number) => (n === 1 ? version(oldSha) : 'hang'),
      `PENDING /_app/version.json is ${oldSha}, not ${newSha} after 2s`,
      3
    ],
    [
      'exits 1 when no version came',
      () => 'hang' as const,
      /^FAIL \/_app\/version\.json returned no answer \(curl: \(28\) [^)]+\) after 2s$/,
      1
    ]
  ])(
    'with a SHA, ends a failed wait by SMOKE_WAIT and %s',
    async (_outcome, reply, line, code) => {
      replies = { '/_app/version.json': reply };
      const run = await smoke(base, { script: trackedCopy(), args: [newSha], wait: '2' });
      // The last poll gets only the time left in the wait, not curl's 20 s.
      expect(run.ms).toBeLessThan(2000 + 2000);
      expect(run.lines.some((l) => (typeof line === 'string' ? l === line : line.test(l)))).toBe(
        true
      );
      expect(run.code).toBe(code);
      expect(hits.size).toBe(1);
    },
    10_000
  );

  it('with a SHA and SMOKE_WAIT=0, sends no request and exits 1', async () => {
    const run = await smoke(base, { script: trackedCopy(), args: [newSha], wait: '0' });
    expect(run.stderr).toBe('');
    expect(run.lines).toContain('FAIL /_app/version.json not run: the time budget ran out');
    expect(run.last).toBe(`smoke-prod: ${newSha} not live on ${base}, checks skipped`);
    expect(run.code).toBe(1);
    expect(hits.size).toBe(0);
  });

  // A fetch of origin that stalls is cut at the deadline and counts as a
  // failed one. Each stall lasts 15 s, past the deadline and its slack, and
  // each test's timeout is above it, so a run the cut misses fails on its time.
  it('with a SHA, cuts a fetch of origin that stalls before the wait at the deadline', async () => {
    const pidFile = path.join(mkdtempSync(path.join(binDir, 'upload-pack-')), 'pid');
    const run = await smoke(base, {
      script: trackedCopy(`echo $$ >${pidFile}; sleep 15; git upload-pack`),
      args: [newSha],
      wait: '2',
      checkTime: '1',
      realSleep: true
    });
    expect(run.ms).toBeLessThan(3000 + slack);
    expect(run.stderr).toBe('');
    // The cut ends git's upload-pack child too, and the shell that runs it.
    const shell = Number(readFileSync(pidFile, 'utf8'));
    for (let i = 0; i < 40 && running(shell); i++) await Bun.sleep(50);
    expect(running(shell)).toBe(false);
    // No origin/main check, then a wait with no time left for a poll.
    expect(run.lines.filter((line) => line.includes('is not a commit on origin/main'))).toEqual([]);
    expect(run.lines).toContain('FAIL /_app/version.json not run: the time budget ran out');
    expect(run.last).toBe(`smoke-prod: ${newSha} not live on ${base}, checks skipped`);
    expect(run.code).toBe(1);
    expect(hits.size).toBe(0);
  }, 20_000);

  it('with a SHA, cuts the fetch for an unknown live commit at the deadline', async () => {
    // Fails the fetch before the wait at once and stalls the next one.
    const uploadpack = path.join(mkdtempSync(path.join(binDir, 'upload-pack-')), 'stall-second');
    writeFileSync(
      uploadpack,
      [
        '#!/bin/sh',
        'n=$(cat "$0.count" 2>/dev/null || echo 0)',
        'echo $((n + 1)) >"$0.count"',
        '[ "$n" -ge 1 ] || exit 1',
        'sleep 15',
        'exec git upload-pack "$@"',
        ''
      ].join('\n')
    );
    chmodSync(uploadpack, 0o755);
    replies = { '/_app/version.json': () => version(oldSha) };
    // The first fetch and the first poll must fit in the wait, so it leaves
    // them 4 s, as in the late-SHA test above.
    const run = await smoke(base, {
      script: trackedCopy(uploadpack),
      args: [newSha],
      wait: '4',
      checkTime: '1',
      realSleep: true
    });
    expect(run.ms).toBeLessThan(5000 + slack);
    // The cut comes at the run deadline, not at the end of the wait: a newer
    // commit read by the wait's last poll still leaves its fetch time to end.
    expect(run.ms).toBeGreaterThan(4500);
    expect(run.stderr).toBe('');
    expect(readFileSync(`${uploadpack}.count`, 'utf8')).toBe('2\n');
    // The stalled fetch, not the polling, used up the wait: one poll only.
    expect(hits.get('/_app/version.json')).toBe(1);
    expect(run.lines).toContain(`PENDING /_app/version.json is ${oldSha}, not ${newSha} after 4s`);
    expect(run.code).toBe(3);
  }, 20_000);

  it('without a SHA, ends by the deadline on a host that never answers', async () => {
    const run = await smoke(silentBase, { wait: '1', checkTime: '1' });
    expect(run.ms).toBeLessThan(2000 + slack);
    expect(run.retries).toEqual([]);
    expect(run.lines.find((line) => line.startsWith('FAIL / '))).toContain('curl: (28)');
    expect(budgetFails(run.lines)).toEqual(
      ['/guide', '/en', '/_app/env.js', '/service-worker.js', '/sw.js', '/healthz', '/offline'].map(
        (check) => `FAIL ${check} not run: the time budget ran out`
      )
    );
    expect(run.last).toBe(`smoke-prod: 11 of 11 checks failed on ${silentBase}`);
    expect(run.code).toBe(1);
  }, 10_000);
});

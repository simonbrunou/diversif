// scripts/smoke-prod.sh against a local server that answers every check the
// way production does, except where a test makes it drop a request (close the
// connection without an answer), leave one unanswered or answer with another
// status. A fake `sleep` on PATH logs its argument and returns at once, so the
// retry spacing is asserted without waiting for it. A run with a SHA uses a
// tracked copy of the script in a git repo with no origin remote: its fetch
// fails, so the wait matches the SHA as a prefix of the live one. The stall
// tests give that repo an origin whose fetch stalls instead: a local bare repo
// whose upload-pack command sleeps 15 s first. They use the real `sleep`,
// since the fake one would end the stall at once, and the timer that cuts the
// fetch too. The one that reads the timer's delay from the fake one calls the
// real one by its path.
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
// The real sleep, for an upload-pack that must stall under the fake one.
const sleepBin = Bun.which('sleep');
// The real curl, which the logging one runs by its path.
const curlBin = Bun.which('curl');

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
let curlDir: string;
let curlLog: string;

beforeAll(() => {
  binDir = mkdtempSync(path.join(tmpdir(), 'smoke-prod-test-'));
  sleepLog = path.join(binDir, 'sleeps');
  writeFileSync(path.join(binDir, 'sleep'), '#!/bin/sh\necho "$*" >>"$SLEEP_LOG"\n');
  chmodSync(path.join(binDir, 'sleep'), 0o755);
  curlDir = path.join(binDir, 'logged-curl');
  curlLog = path.join(binDir, 'curls');
  mkdirSync(curlDir);
  writeFileSync(
    path.join(curlDir, 'curl'),
    `#!/bin/sh\necho "$*" >>"$CURL_LOG"\nexec ${curlBin} "$@"\n`
  );
  chmodSync(path.join(curlDir, 'curl'), 0o755);
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
  writeFileSync(curlLog, '');
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

// A file's content, or '' while it does not exist.
function readIfThere(file: string): string {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
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
// fake `sleep` off PATH, so the wait's sleeps take real time. termIgnored
// starts the script with TERM ignored, which its children inherit. logCurl
// puts a curl first on PATH that logs each call's arguments, then runs the
// real one. interruptOn sends the script alone SIGINT, as a Ctrl-C does once job control
// moved its fetch to a group of its own, when that file has content.
async function smoke(
  baseUrl = base,
  {
    script = scriptPath,
    args = [] as string[],
    wait = '',
    checkTime = '',
    realSleep = false,
    termIgnored = false,
    logCurl = false,
    interruptOn = ''
  } = {}
) {
  const started = performance.now();
  const proc = Bun.spawn({
    cmd: termIgnored
      ? ['bash', '-c', 'trap "" TERM; exec bash "$0" "$@"', script, ...args]
      : ['bash', script, ...args],
    env: {
      ...process.env,
      PATH: `${logCurl ? `${curlDir}:` : ''}${realSleep ? '' : `${binDir}:`}${process.env.PATH}`,
      SMOKE_BASE_URL: baseUrl,
      ...(wait ? { SMOKE_WAIT: wait } : {}),
      ...(checkTime ? { SMOKE_CHECK_TIME: checkTime } : {}),
      SLEEP_LOG: sleepLog,
      CURL_LOG: curlLog,
      // A proxy from the shell would answer for the local server.
      no_proxy: '*',
      NO_PROXY: '*'
    },
    stdout: 'pipe',
    stderr: 'pipe'
  });
  if (interruptOn) {
    void (async () => {
      while (proc.exitCode === null && !readIfThere(interruptOn)) await Bun.sleep(20);
      proc.kill('SIGINT');
    })();
  }
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
    sleeps: readFileSync(sleepLog, 'utf8').split('\n').filter(Boolean),
    // Each call's arguments, split on spaces: the URL comes last.
    curls: readFileSync(curlLog, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((call) => call.split(' '))
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
  // below took curl's full 20 s. The test on a host that never answers reads
  // its deadline from curl's --max-time instead: a stall overshot it by 2.7 s
  // (run 354, #575).
  const slack = 2000;
  const budgetFails = (lines: string[]) =>
    lines.filter((line) => line.endsWith(' not run: the time budget ran out'));

  // After a poll that reads an older commit, the wait sleeps until 1 s before
  // SMOKE_WAIT ends, so that its last poll still gets that 1 s (#541). The
  // fake sleep logs the pause and returns at once, so the second poll needs no
  // real time. The pause is SMOKE_WAIT less 1 s less the setup before it,
  // which gets 6 s here: a stalled runner held a run for 3.7 s in CI (#572).
  // Under the real sleep, that stall left no time for the second poll (runs
  // 347 and 353). The pause comes last in the log: the timers of the two
  // fetches of origin before it log theirs first, and no check after it
  // retries. Above 16 s, SMOKE_WAIT would log the flat 15 s pause instead.
  it('with a SHA, polls again 1 s before SMOKE_WAIT ends after an older commit served', async () => {
    replies = { '/_app/version.json': (n) => version(n === 1 ? oldSha : newSha) };
    const wait = 14;
    const run = await smoke(base, { script: trackedCopy(), args: [newSha], wait: `${wait}` });
    const pause = Number(run.sleeps.at(-1));
    expect(pause).toBeLessThanOrEqual(wait - 1);
    expect(pause).toBeGreaterThan(wait - 7);
    expect(hits.get('/_app/version.json')).toBe(2);
    expect(run.lines).toContain(`PASS /_app/version.json is ${newSha}`);
    expect(run.last).toBe(`smoke-prod: 12 of 12 checks passed on ${base}`);
    expect(run.code).toBe(0);
  });

  // The checks share one deadline with the wait, SMOKE_WAIT + SMOKE_CHECK_TIME
  // after the start, so a SHA that goes live late leaves them only what
  // remains. Here it is live on the first poll, which gets the whole 4 s wait,
  // and /guide hangs until 5 s after the start, not 1 s after the poll.
  it('with a SHA live on the first poll, fails the checks left past the run deadline', async () => {
    replies = {
      '/_app/version.json': () => version(newSha),
      '/guide': () => 'hang'
    };
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
    expect(hits.get('/_app/version.json')).toBe(1);
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

  // A fetch of origin that stalls is cut, TERM 1 s before the deadline and
  // KILL at it, and counts as a failed one. Each stall lasts 15 s, past the
  // deadline and its slack, and each test's timeout is above it, so a run the
  // cut misses fails on its time.
  // This upload-pack outlives TERM, and so does its sleep: only KILL ends
  // them. Started with TERM ignored, git outlives TERM too.
  it.each([
    ['', 0],
    [' when started with TERM ignored', 1000]
  ])(
    'with a SHA, cuts a fetch of origin that stalls before the wait by the deadline%s',
    async (_when, outlived) => {
      const dir = mkdtempSync(path.join(binDir, 'upload-pack-'));
      const [pidFile, termFile] = [path.join(dir, 'pid'), path.join(dir, 'term')];
      // Upload-pack notes the TERM only where the KILL comes 1 s after it.
      // When git exits on the TERM, the KILL follows at once and can land
      // before the note on a loaded runner (#581).
      const onTerm = outlived ? `echo >${termFile}` : '';
      const run = await smoke(base, {
        script: trackedCopy(
          `trap "${onTerm}" TERM; (trap "" TERM; exec sleep 15) & echo $! >${pidFile};` +
            ' wait $!; wait $!; git upload-pack'
        ),
        args: [newSha],
        wait: '2',
        checkTime: '1',
        realSleep: true,
        termIgnored: outlived > 0
      });
      expect(run.ms).toBeLessThan(3000 + slack);
      // The fetch stalls until the cut: the TERM ends git, else the KILL.
      expect(run.ms).toBeGreaterThan(1500 + outlived);
      expect(run.stderr).toBe('');
      expect(readIfThere(termFile)).toBe(outlived ? '\n' : '');
      // KILL ended upload-pack's sleep too.
      const sleeper = Number(readFileSync(pidFile, 'utf8'));
      for (let i = 0; i < 40 && running(sleeper); i++) await Bun.sleep(50);
      expect(running(sleeper)).toBe(false);
      // No origin/main check, then a wait with no time left for a poll.
      expect(run.lines.filter((line) => line.includes('is not a commit on origin/main'))).toEqual(
        []
      );
      expect(run.lines).toContain('FAIL /_app/version.json not run: the time budget ran out');
      expect(run.last).toBe(`smoke-prod: ${newSha} not live on ${base}, checks skipped`);
      expect(run.code).toBe(1);
      expect(hits.size).toBe(0);
    },
    20_000
  );

  // The fake sleep logs the timer's first delay, the one before the TERM: at
  // most 9 s with a 10 s deadline, less the script's setup before the fetch,
  // which gets 4 s here. A wall-clock bound on the TERM's arrival failed
  // under CI load (#581).
  it('with a SHA, sends a stalled fetch of origin TERM 1 s before the deadline', async () => {
    const run = await smoke(base, {
      script: trackedCopy(`${sleepBin} 15; git upload-pack`),
      args: [newSha],
      wait: '0',
      checkTime: '10'
    });
    expect(Number(run.sleeps[0])).toBeLessThanOrEqual(9);
    expect(Number(run.sleeps[0])).toBeGreaterThan(5);
    expect(run.lines).toContain('FAIL /_app/version.json not run: the time budget ran out');
    expect(run.code).toBe(1);
  });

  it('with a SHA, cuts the fetch for an unknown live commit by the deadline', async () => {
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
    // them 4 s, as the test of a SHA live on the first poll leaves its poll.
    // The 2 s for the checks put the cut 1 s after the wait ends.
    const run = await smoke(base, {
      script: trackedCopy(uploadpack),
      args: [newSha],
      wait: '4',
      checkTime: '2',
      realSleep: true
    });
    expect(run.ms).toBeLessThan(6000 + slack);
    // The cut comes by the run deadline, not by the end of the wait: a newer
    // commit read by the wait's last poll still leaves its fetch time to end.
    expect(run.ms).toBeGreaterThan(4500);
    expect(run.stderr).toBe('');
    expect(readFileSync(`${uploadpack}.count`, 'utf8')).toBe('2\n');
    // The stalled fetch, not the polling, used up the wait: one poll only.
    expect(hits.get('/_app/version.json')).toBe(1);
    expect(run.lines).toContain(`PENDING /_app/version.json is ${oldSha}, not ${newSha} after 4s`);
    expect(run.code).toBe(3);
  }, 20_000);

  it('with a SHA, ends a fetch of origin that a Ctrl-C interrupts', async () => {
    const pidFile = path.join(mkdtempSync(path.join(binDir, 'upload-pack-')), 'pid');
    const run = await smoke(base, {
      script: trackedCopy(`sleep 15 & echo $! >${pidFile}; wait; git upload-pack`),
      args: [newSha],
      wait: '2',
      checkTime: '1',
      realSleep: true,
      interruptOn: pidFile
    });
    expect(run.code).toBe(130);
    expect(run.stderr).toBe('');
    // The exit trap's TERM ends the fetch, which the SIGINT never reached.
    const sleeper = Number(readFileSync(pidFile, 'utf8'));
    for (let i = 0; i < 40 && running(sleeper); i++) await Bun.sleep(50);
    expect(running(sleeper)).toBe(false);
  }, 20_000);

  // The only request, for /, must end by the run deadline, 5 s after the
  // script first reads its clock: the --max-time the script hands curl proves
  // it. The wall clock cannot, as bash's start-up and the work after curl
  // gives up fall outside the deadline, and a loaded runner stalls them for
  // seconds. The 5 s leave the request time to start after such a stall, not
  // fail as not run. The wall-clock bound only tells a run that ends near the
  // deadline from one that waits curl's own 20 s.
  it('without a SHA, ends by the deadline on a host that never answers', async () => {
    const [wait, checkTime] = [1, 4];
    const run = await smoke(silentBase, {
      wait: `${wait}`,
      checkTime: `${checkTime}`,
      logCurl: true
    });
    expect(run.curls.map((args) => args.at(-1))).toEqual([`${silentBase}/`]);
    const maxTime = Number(run.curls[0][run.curls[0].indexOf('--max-time') + 1]);
    expect(maxTime).toBeGreaterThan(0);
    expect(maxTime).toBeLessThanOrEqual(wait + checkTime);
    expect(run.ms).toBeLessThan(15_000);
    expect(run.retries).toEqual([]);
    expect(run.lines.find((line) => line.startsWith('FAIL / '))).toContain('curl: (28)');
    expect(budgetFails(run.lines)).toEqual(
      ['/guide', '/en', '/_app/env.js', '/service-worker.js', '/sw.js', '/healthz', '/offline'].map(
        (check) => `FAIL ${check} not run: the time budget ran out`
      )
    );
    expect(run.last).toBe(`smoke-prod: 11 of 11 checks failed on ${silentBase}`);
    expect(run.code).toBe(1);
  }, 30_000);
});

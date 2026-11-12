// scripts/smoke-prod.sh against a local server that answers every check the
// way production does, except where a test makes it drop a request (close the
// connection without an answer), leave one unanswered or answer with another
// status. A fake `sleep` on PATH logs its argument and returns at once, so the
// retry spacing is asserted without waiting for it. A run with a SHA uses a
// tracked copy of the script in a git repo with no origin remote: its fetch
// fails, so the wait matches the SHA as a prefix of the live one. The stall
// tests give that repo an origin whose fetch stalls instead: a local bare repo
// whose upload-pack command first sleeps past the run deadline. They use the
// real `sleep`, since the fake one would end the stall at once, and the timer
// that cuts the fetch too. The one that reads the timer's delay from the fake
// one calls the real one by its path.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
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
// The real git, which the logging one runs by its path.
const gitBin = Bun.which('git');

interface Answer {
  status: number;
  headers?: Record<string, string>;
  body?: string;
}

const oldSha = 'fedcba9876543210fedcba9876543210fedcba98';
const newSha = '0123456789abcdef0123456789abcdef01234567';

// A page as SvelteKit renders it, its build SHA in the inline boot script.
const page = (sha: string) =>
  `<!doctype html><html><body><script>\n\t\t\t\t\t__sveltekit_4z2lge = {\n\t\t\t\t\t\tbase: "",\n\t\t\t\t\t\tversion: "${sha}"\n\t\t\t\t\t};\n</script></body></html>`;

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
    body: page(newSha)
  },
  '/guide': { status: 200, headers: html, body: page(newSha) },
  '/en': { status: 200, headers: html, body: page(newSha) },
  '/_app/env.js': { status: 200, headers: js, body: 'export const env = {};' },
  '/service-worker.js': { status: 200, headers: js, body: 'self;' },
  '/sw.js': { status: 404, body: 'Not found' },
  '/healthz': {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: '{"ok":true,"db":"ok","uptimeMs":51000}'
  },
  // Production serves the prerendered page with no Content-Type.
  '/offline': { status: 200, body: page(newSha) }
};

// Per test: the requests to drop (path -> how many first requests), the
// answers that differ from production, and the replies that depend on the
// request's number (path -> a function of it). A reply of 'hang' keeps the
// connection open and never answers, one of 'drop' closes it without an
// answer; undefined falls through to the others.
let drops: Record<string, number> = {};
let overrides: Record<string, Answer> = {};
let replies: Record<string, (n: number) => Answer | 'hang' | 'drop' | undefined> = {};
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
      if (reply === 'drop' || n <= (drops[requestPath] ?? 0)) {
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

// Commits a tracked copy's repo twice: the script, then an empty commit on
// top. Returns both SHAs, the older first.
function commitTwice(copy: string): [string, string] {
  const root = path.dirname(path.dirname(copy));
  const git = (...args: string[]) => {
    const run = Bun.spawnSync({
      cmd: [
        'git',
        '-C',
        root,
        '-c',
        'user.name=smoke',
        '-c',
        'user.email=smoke@example.invalid',
        '-c',
        'commit.gpgsign=false',
        ...args
      ]
    });
    expect(run.exitCode).toBe(0);
    return run.stdout.toString().trim();
  };
  git('commit', '-q', '-m', 'script');
  const first = git('rev-parse', 'HEAD');
  git('commit', '-q', '--allow-empty', '-m', 'newer');
  return [first, git('rev-parse', 'HEAD')];
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
// moved its fetch to a group of its own, when that file has content. tmpDir
// is the TMPDIR its mktemp -d creates $TMP in. binFirst puts that directory
// first on PATH, ahead of the fake sleep and the logging curl. locale sets
// LC_ALL.
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
    interruptOn = '',
    tmpDir = '',
    binFirst = '',
    locale = ''
  } = {}
) {
  const started = performance.now();
  const proc = Bun.spawn({
    cmd: termIgnored
      ? ['bash', '-c', 'trap "" TERM; exec bash "$0" "$@"', script, ...args]
      : ['bash', script, ...args],
    env: {
      ...process.env,
      PATH: `${binFirst ? `${binFirst}:` : ''}${logCurl ? `${curlDir}:` : ''}${realSleep ? '' : `${binDir}:`}${process.env.PATH}`,
      SMOKE_BASE_URL: baseUrl,
      ...(wait ? { SMOKE_WAIT: wait } : {}),
      ...(checkTime ? { SMOKE_CHECK_TIME: checkTime } : {}),
      ...(tmpDir ? { TMPDIR: tmpDir } : {}),
      ...(locale ? { LC_ALL: locale } : {}),
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
  // it starts, so that it fits in one 600 s agent Bash call. The wall clock
  // cannot prove it: bash starts before the script reads its clock, and
  // curl's exit, the last FAIL lines and the exit trap come after, so a
  // loaded runner stalls a run past its deadline by seconds (2.7 s in run
  // 354, #575). The tests read the limits the script hands its tools instead:
  // each request's --max-time through the logging curl, at most the time from
  // the start to the end of the wait for a poll, to the run deadline for a
  // check, and the timer's and the wait's delays through the fake sleep. A
  // wall-clock upper bound only tells a run that ends near its deadline from
  // one that waits out curl's own 20 s or a stalled fetch, so it sits at
  // least 5 s from each, and the test's timeout above the longer wait. A
  // lower bound holds under any stall, which only makes a run longer. Every
  // step that must come before the wait or the run ends gets at least 6 s
  // from the start: a stalled runner held a run for 3.7 s in CI (#572).
  const budgetFails = (lines: string[]) =>
    lines.filter((line) => line.endsWith(' not run: the time budget ran out'));
  // The --max-time, in seconds, of one call in run.curls.
  const maxTime = (args: string[]) => Number(args[args.indexOf('--max-time') + 1]);

  // After a poll that reads an older commit, the wait sleeps until 1 s before
  // SMOKE_WAIT ends, so that its last poll still gets that 1 s (#541). The
  // fake sleep logs the pause and returns at once, so the second poll follows
  // the first right away. The pause is SMOKE_WAIT less 1 s less the time the
  // setup and the first poll took, which get 6 s here: a stalled runner held
  // a run for 3.7 s in CI (#572).
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
  // remains. Here it is live on the first poll, which gets the whole 6 s wait,
  // and /guide hangs until 7 s after the start, not 1 s after the poll.
  it('with a SHA live on the first poll, fails the checks left past the run deadline', async () => {
    replies = {
      '/_app/version.json': () => version(newSha),
      '/guide': () => 'hang'
    };
    const [wait, checkTime] = [6, 1];
    const run = await smoke(base, {
      script: trackedCopy(),
      args: [newSha],
      wait: `${wait}`,
      checkTime: `${checkTime}`,
      realSleep: true,
      logCurl: true
    });
    expect(run.curls.map((args) => args.at(-1))).toEqual(
      ['/_app/version.json', '/', '/guide'].map((check) => `${base}${check}`)
    );
    run.curls.forEach((args, i) => {
      expect(maxTime(args)).toBeGreaterThan(0);
      expect(maxTime(args)).toBeLessThanOrEqual(i === 0 ? wait : wait + checkTime);
    });
    expect(run.ms).toBeLessThan(15_000);
    // /guide hangs until the deadline, which the run cannot beat.
    expect(run.ms).toBeGreaterThan(6500);
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
  }, 30_000);

  // The first poll gets 6 s. The run waits out the last one, which hangs.
  it.each([
    [
      'exits 3 when an older commit served',
      (n: number) => (n === 1 ? version(oldSha) : 'hang'),
      `PENDING /_app/version.json is ${oldSha}, not ${newSha} after 6s`,
      3
    ],
    [
      'exits 1 when no version came',
      () => 'hang' as const,
      /^FAIL \/_app\/version\.json returned no answer \(curl: \(28\) [^)]+\) after 6s$/,
      1
    ]
  ])(
    'with a SHA, ends a failed wait by SMOKE_WAIT and %s',
    async (_outcome, reply, line, code) => {
      replies = { '/_app/version.json': reply };
      const wait = 6;
      const run = await smoke(base, {
        script: trackedCopy(),
        args: [newSha],
        wait: `${wait}`,
        logCurl: true
      });
      // The last poll gets only the time left in the wait, not curl's 20 s.
      expect(run.curls.length).toBeGreaterThan(0);
      for (const args of run.curls) {
        expect(args.at(-1)).toBe(`${base}/_app/version.json`);
        expect(maxTime(args)).toBeGreaterThan(0);
        expect(maxTime(args)).toBeLessThanOrEqual(wait);
      }
      expect(run.ms).toBeLessThan(15_000);
      expect(run.lines.some((l) => (typeof line === 'string' ? l === line : line.test(l)))).toBe(
        true
      );
      expect(run.code).toBe(code);
      expect(hits.size).toBe(1);
    },
    30_000
  );

  it('with a SHA and SMOKE_WAIT=0, sends no request and exits 1', async () => {
    const run = await smoke(base, { script: trackedCopy(), args: [newSha], wait: '0' });
    expect(run.stderr).toBe('');
    expect(run.lines).toContain('FAIL /_app/version.json not run: the time budget ran out');
    expect(run.last).toBe(`smoke-prod: ${newSha} not live on ${base}, checks skipped`);
    expect(run.code).toBe(1);
    expect(hits.size).toBe(0);
  });

  // The line of fetch_origin that starts the fetch, which the next two tests
  // rewrite in their copies.
  const fetchLine = '  git -C "$REPO" fetch -q origin </dev/null >/dev/null 2>&1 &\n';

  // On bash 5.2, the child bash forks for the fetch keeps the script's EXIT
  // trap until it execs git, and a TERM that reaches it before then runs the
  // trap there. Under the fake sleep the timer's TERM comes at once, and in
  // CI a loaded runner once held the child long enough: it removed the main
  // shell's $TMP (#606). This copy holds the child before exec for up to 15 s,
  // in a command substitution whose sleep is in the fetch's process group:
  // the timer's TERM ends both, and lands in that window even when a loaded
  // runner delays the timer by seconds. The KILL right after it could still
  // beat the trap and pass the old trap too; it did not in 80 runs under bash
  // 5.2. Bash 5.3 never runs the trap there, so only a 5.2 run (CI's) fails.
  it("with a SHA, keeps $TMP when its fetch's child gets TERM before it execs", async () => {
    const copy = trackedCopy();
    const source = readFileSync(copy, 'utf8');
    expect(source).toContain(fetchLine);
    writeFileSync(
      copy,
      source.replace(fetchLine, fetchLine.replace('"$REPO"', `"$REPO$(${sleepBin} 15)"`))
    );
    const tmpDir = mkdtempSync(path.join(binDir, 'tmpdir-'));
    const run = await smoke(base, { script: copy, args: [newSha], wait: '0', tmpDir });
    expect(run.stderr).toBe('');
    expect(run.lines).toContain('FAIL /_app/version.json not run: the time budget ran out');
    expect(run.last).toBe(`smoke-prod: ${newSha} not live on ${base}, checks skipped`);
    expect(run.code).toBe(1);
    expect(hits.size).toBe(0);
    // The main shell's trap still removed $TMP.
    expect(readdirSync(tmpDir)).toEqual([]);
  });

  // On bash 5.2, that child also keeps the main shell's state from the middle
  // of its fork. After a simple command in the trap, it waits for the main
  // shell's last child, which it never forked, and bash prints "wait_for: No
  // record of process <pid>" on stderr, as in CI run 488 (#674). A command
  // substitution in the child clears that state, so the test above never
  // printed it. This copy holds the child in a word expansion that forks
  // nothing: a pattern substitution over 800,000 spaces. A TERM ends it at
  // once. Left alone, it lasts about 7 s in the C locale, which leaves the
  // timer the 6 s that a step gets against a stalled runner (#572), and 20 to
  // 40 times longer in a UTF-8 one. This test's sleep returns at once for the
  // timer's delay before the TERM and lasts 20 s between the TERM and the
  // KILL, so the KILL cannot end the child before the trap does. A git first
  // on PATH logs each call: an ls-files call and no fetch call, in a run well
  // under those 20 s, show that the TERM ended the child before it ran git.
  // Bash 5.3 never runs the trap there, so only a 5.2 run (CI's) fails with a
  // simple command as the guard.
  it("with a SHA, prints no bash warning when its fetch's child gets TERM before it execs", async () => {
    const copy = trackedCopy();
    const source = readFileSync(copy, 'utf8');
    expect(source).toContain(fetchLine);
    writeFileSync(
      copy,
      source.replace(
        fetchLine,
        `  printf -v hold '%*s' 800000 ''\n${fetchLine.replace('"$REPO"', '"$REPO${hold// /}"')}`
      )
    );
    const bin = mkdtempSync(path.join(binDir, 'held-'));
    const gitLog = path.join(bin, 'calls');
    writeFileSync(path.join(bin, 'git'), `#!/bin/sh\necho "$*" >>${gitLog}\nexec ${gitBin} "$@"\n`);
    writeFileSync(
      path.join(bin, 'sleep'),
      `#!/bin/sh\n[ ! -e "$0.first" ] || exec ${sleepBin} 20\n: >"$0.first"\n`
    );
    chmodSync(path.join(bin, 'git'), 0o755);
    chmodSync(path.join(bin, 'sleep'), 0o755);
    const tmpDir = mkdtempSync(path.join(binDir, 'tmpdir-'));
    const run = await smoke(base, {
      script: copy,
      args: [newSha],
      wait: '0',
      tmpDir,
      binFirst: bin,
      locale: 'C'
    });
    expect(run.ms).toBeLessThan(15_000);
    const calls = readFileSync(gitLog, 'utf8').split('\n').filter(Boolean);
    expect(calls.some((call) => call.includes(' ls-files --error-unmatch '))).toBe(true);
    expect(calls.filter((call) => call.includes(' fetch '))).toEqual([]);
    expect(run.stderr).toBe('');
    expect(run.lines).toContain('FAIL /_app/version.json not run: the time budget ran out');
    expect(run.last).toBe(`smoke-prod: ${newSha} not live on ${base}, checks skipped`);
    expect(run.code).toBe(1);
    expect(hits.size).toBe(0);
    expect(readdirSync(tmpDir)).toEqual([]);
  }, 30_000);

  // A fetch of origin that stalls is cut, TERM 1 s before the deadline and
  // KILL at it, and counts as a failed one. Each stall lasts 30 s, at least
  // 5 s past the wall-clock bound, and each test's timeout is above it, so a
  // run the cut misses fails on its time. The TERM comes 6 s after the start,
  // which leaves the fetch and its upload-pack time to start.
  // This upload-pack outlives TERM, and so does its sleep: only KILL ends
  // them. Started with TERM ignored, git outlives TERM too, so that run lasts
  // until the KILL, at least 1 s after the TERM. No assertion needs a process
  // to run between the TERM and the KILL, as a TERM trap that writes a file
  // would: in main run 565, upload-pack's trap file was still empty after
  // that KILL (#712).
  it.each([
    ['', 0],
    [' when started with TERM ignored', 1000]
  ])(
    'with a SHA, cuts a fetch of origin that stalls before the wait by the deadline%s',
    async (_when, outlived) => {
      const pidFile = path.join(mkdtempSync(path.join(binDir, 'upload-pack-')), 'pid');
      const run = await smoke(base, {
        script: trackedCopy(
          `trap "" TERM; (trap "" TERM; exec sleep 30) & echo $! >${pidFile};` +
            ' wait $!; wait $!; git upload-pack'
        ),
        args: [newSha],
        wait: '2',
        checkTime: '5',
        realSleep: true,
        termIgnored: outlived > 0
      });
      expect(run.ms).toBeLessThan(15_000);
      // The fetch stalls until the cut: the TERM ends git, else the KILL.
      expect(run.ms).toBeGreaterThan(5500 + outlived);
      expect(run.stderr).toBe('');
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
    40_000
  );

  // The fake sleep logs the timer's first delay, the one before the TERM: at
  // most 11 s with a 12 s deadline, less the script's setup before the fetch,
  // which gets 6 s here. Under the fake sleep the TERM comes at once, so the
  // deadline costs no time. A wall-clock bound on the TERM's arrival failed
  // under CI load (#581).
  it('with a SHA, sends a stalled fetch of origin TERM 1 s before the deadline', async () => {
    const run = await smoke(base, {
      script: trackedCopy(`${sleepBin} 15; git upload-pack`),
      args: [newSha],
      wait: '0',
      checkTime: '12'
    });
    expect(Number(run.sleeps[0])).toBeLessThanOrEqual(11);
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
        'sleep 30',
        'exec git upload-pack "$@"',
        ''
      ].join('\n')
    );
    chmodSync(uploadpack, 0o755);
    replies = { '/_app/version.json': () => version(oldSha) };
    // The first fetch and the first poll must fit in the wait, so it leaves
    // them 6 s, as the test of a SHA live on the first poll leaves its poll.
    // The 2 s for the checks put the cut 1 s after the wait ends. The stall
    // lasts 30 s, as in the tests of a fetch that stalls before the wait.
    const wait = 6;
    const run = await smoke(base, {
      script: trackedCopy(uploadpack),
      args: [newSha],
      wait: `${wait}`,
      checkTime: '2',
      realSleep: true,
      logCurl: true
    });
    expect(run.curls.map((args) => args.at(-1))).toEqual([`${base}/_app/version.json`]);
    expect(maxTime(run.curls[0])).toBeGreaterThan(0);
    expect(maxTime(run.curls[0])).toBeLessThanOrEqual(wait);
    expect(run.ms).toBeLessThan(15_000);
    // The cut comes by the run deadline, not by the end of the wait: a newer
    // commit read by the wait's last poll still leaves its fetch time to end.
    expect(run.ms).toBeGreaterThan(6500);
    expect(run.stderr).toBe('');
    expect(readFileSync(`${uploadpack}.count`, 'utf8')).toBe('2\n');
    // The stalled fetch, not the polling, used up the wait: one poll only.
    expect(hits.get('/_app/version.json')).toBe(1);
    expect(run.lines).toContain(`PENDING /_app/version.json is ${oldSha}, not ${newSha} after 6s`);
    expect(run.code).toBe(3);
  }, 40_000);

  // The timer's TERM would come 6 s after the start, which leaves the fetch
  // and its upload-pack time to start. The Ctrl-C ends the run before it.
  it('with a SHA, ends a fetch of origin that a Ctrl-C interrupts', async () => {
    const pidFile = path.join(mkdtempSync(path.join(binDir, 'upload-pack-')), 'pid');
    const run = await smoke(base, {
      script: trackedCopy(`sleep 15 & echo $! >${pidFile}; wait; git upload-pack`),
      args: [newSha],
      wait: '2',
      checkTime: '5',
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
    expect(maxTime(run.curls[0])).toBeGreaterThan(0);
    expect(maxTime(run.curls[0])).toBeLessThanOrEqual(wait + checkTime);
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

  // With a SHA, each HTML page must hold the build SHA of <sha>, or of a newer
  // main commit that contains it (#542). The old container can still answer
  // once /_app/version.json reports <sha>, so a page that holds an older build
  // is fetched again, 5 s later, within a 60 s budget that all pages share.
  // Each pause logs a bare '5' through the fake sleep; the fetch timers log
  // their delays with a decimal point, so the 5s count the pauses.
  describe('with a SHA, the build SHA in each page', () => {
    const live = () => ({ '/_app/version.json': () => version(newSha) });
    const refetches = (lines: string[]) => lines.filter((line) => line.startsWith('REFETCH'));
    const pauses = (sleeps: string[]) => sleeps.filter((delay) => delay === '5');
    const oldPage = (path: string): Answer => ({ ...production[path], body: page(oldSha) });

    it.each(['/', '/guide', '/en', '/offline'])(
      'fetches %s again while it holds an older build, and counts one PASS',
      async (check) => {
        replies = { ...live(), [check]: (n) => (n <= 2 ? oldPage(check) : undefined) };
        const run = await smoke(base, { script: trackedCopy(), args: [newSha] });
        expect(run.stderr).toBe('');
        expect(refetches(run.lines)).toHaveLength(2);
        for (const line of refetches(run.lines)) {
          expect(line).toMatch(
            new RegExp(
              `^REFETCH ${check} holds build ${oldSha}, again in 5 s, \\d+ s of the SHA budget left$`
            )
          );
        }
        expect(pauses(run.sleeps)).toEqual(['5', '5']);
        expect(hits.get(check)).toBe(3);
        expect(run.lines.find((line) => line.startsWith(`PASS ${check} `))).toContain(
          `build ${newSha}`
        );
        expect(run.retries).toEqual([]);
        expect(run.last).toBe(`smoke-prod: 12 of 12 checks passed on ${base}`);
        expect(run.code).toBe(0);
      }
    );

    // 60 s of budget, 5 s per pause: 12 new fetches at most.
    it('fails a page that holds an older build once the SHA budget is spent', async () => {
      replies = { ...live(), '/en': () => oldPage('/en') };
      const run = await smoke(base, { script: trackedCopy(), args: [newSha] });
      expect(refetches(run.lines)).toHaveLength(12);
      expect(pauses(run.sleeps)).toHaveLength(12);
      expect(hits.get('/en')).toBe(13);
      expect(run.lines).toContain(
        `FAIL /en holds build ${oldSha} after the 60 s SHA budget, expected ${newSha} or a newer main commit`
      );
      // The checks after it still run, each once.
      expect(hits.get('/offline')).toBe(1);
      expect(run.last).toBe(`smoke-prod: 1 of 12 checks failed on ${base}`);
      expect(run.code).toBe(1);
    });

    it('shares the SHA budget between the pages', async () => {
      replies = {
        ...live(),
        '/guide': (n) => (n <= 3 ? oldPage('/guide') : undefined),
        '/en': () => oldPage('/en')
      };
      const run = await smoke(base, { script: trackedCopy(), args: [newSha] });
      expect(hits.get('/guide')).toBe(4);
      // The 9 new fetches left after /guide's 3.
      expect(hits.get('/en')).toBe(10);
      expect(refetches(run.lines)).toHaveLength(12);
      expect(run.lines.find((line) => line.startsWith('FAIL '))).toStartWith(
        `FAIL /en holds build ${oldSha} after the 60 s SHA budget`
      );
      expect(run.last).toBe(`smoke-prod: 1 of 12 checks failed on ${base}`);
      expect(run.code).toBe(1);
    });

    // The run deadline comes 12 s after the start, before the 60 s budget
    // would end, so each new fetch line counts the time left to it.
    it('cuts the SHA budget at the run deadline', async () => {
      replies = { ...live(), '/en': () => oldPage('/en') };
      const [wait, checkTime] = [6, 6];
      const run = await smoke(base, {
        script: trackedCopy(),
        args: [newSha],
        wait: `${wait}`,
        checkTime: `${checkTime}`
      });
      const left = refetches(run.lines).map((line) => Number(/(\d+) s of the SHA/.exec(line)?.[1]));
      expect(left.length).toBeGreaterThan(0);
      for (const seconds of left) expect(seconds).toBeLessThanOrEqual(wait + checkTime);
      expect(run.code).toBe(1);
    });

    // The four pages of a repo whose commits the tests make: each holds sha.
    const pagesOf = (sha: string) =>
      Object.fromEntries(
        ['/', '/guide', '/en', '/offline'].map((check) => [
          check,
          () => ({ ...production[check], body: page(sha) })
        ])
      );

    it('passes a page that holds a newer main commit containing <sha> on its first fetch', async () => {
      const copy = trackedCopy();
      const [sha, newer] = commitTwice(copy);
      replies = {
        ...pagesOf(sha),
        '/_app/version.json': () => version(sha),
        '/guide': () => ({ ...production['/guide'], body: page(newer) })
      };
      const run = await smoke(base, { script: copy, args: [sha] });
      expect(run.stderr).toBe('');
      expect(refetches(run.lines)).toEqual([]);
      expect(hits.get('/guide')).toBe(1);
      expect(run.lines.find((line) => line.startsWith('PASS /guide '))).toContain(`build ${newer}`);
      expect(run.last).toBe(`smoke-prod: 12 of 12 checks passed on ${base}`);
      expect(run.code).toBe(0);
    });

    it('fetches again a page that holds a commit not containing <sha>', async () => {
      const copy = trackedCopy();
      const [older, sha] = commitTwice(copy);
      replies = {
        ...pagesOf(sha),
        '/_app/version.json': () => version(sha),
        '/guide': (n) => ({ ...production['/guide'], body: page(n === 1 ? older : sha) })
      };
      const run = await smoke(base, { script: copy, args: [sha] });
      expect(refetches(run.lines)).toHaveLength(1);
      expect(refetches(run.lines)[0]).toStartWith(`REFETCH /guide holds build ${older}, `);
      expect(run.last).toBe(`smoke-prod: 12 of 12 checks passed on ${base}`);
      expect(run.code).toBe(0);
    });

    it.each(['/', '/guide', '/en', '/offline'])(
      'fails %s at once when it holds no build SHA',
      async (check) => {
        replies = { ...live(), [check]: () => ({ ...production[check], body: '<html></html>' }) };
        const run = await smoke(base, { script: trackedCopy(), args: [newSha] });
        expect(run.lines).toContain(`FAIL ${check} holds no build SHA (version: "<sha>")`);
        expect(refetches(run.lines)).toEqual([]);
        expect(pauses(run.sleeps)).toEqual([]);
        expect(hits.get(check)).toBe(1);
        expect(run.last).toBe(`smoke-prod: 1 of 12 checks failed on ${base}`);
        expect(run.code).toBe(1);
      }
    );

    // The old build's answer to / carries none of the headers, so the checks
    // pass only on the later answer.
    it('checks the headers of the answer to / that held <sha>', async () => {
      replies = {
        ...live(),
        '/': (n) => (n === 1 ? { status: 200, headers: html, body: page(oldSha) } : undefined)
      };
      const run = await smoke(base, { script: trackedCopy(), args: [newSha] });
      expect(refetches(run.lines)).toHaveLength(1);
      expect(run.lines).toContain("PASS CSP has default-src 'self'");
      expect(run.lines).toContain('PASS HSTS max-age=31536000; includeSubDomains');
      expect(run.lines).toContain('PASS X-Frame-Options DENY');
      expect(run.last).toBe(`smoke-prod: 12 of 12 checks passed on ${base}`);
    });

    // The new fetch gets no answer, and its retry 5 s later holds <sha>.
    it('retries a new fetch that gets no answer', async () => {
      replies = {
        ...live(),
        '/guide': (n) => (n === 1 ? oldPage('/guide') : n === 2 ? 'drop' : undefined)
      };
      const run = await smoke(base, { script: trackedCopy(), args: [newSha] });
      expect(refetches(run.lines)).toHaveLength(1);
      expect(run.retries).toHaveLength(1);
      expect(run.retries[0]).toMatch(
        /^RETRY \/guide got no answer \(curl: \(52\) [^)]+\), attempt 2 of 4 in 5 s$/
      );
      expect(hits.get('/guide')).toBe(3);
      expect(run.last).toBe(`smoke-prod: 12 of 12 checks passed on ${base}`);
      expect(run.code).toBe(0);
    });

    // A full answer with another status ends the new fetches at once.
    it('fails a new fetch that answers 502 at once', async () => {
      replies = {
        ...live(),
        '/guide': (n) => (n === 1 ? oldPage('/guide') : { status: 502, body: 'Bad Gateway' })
      };
      const run = await smoke(base, { script: trackedCopy(), args: [newSha] });
      expect(refetches(run.lines)).toHaveLength(1);
      expect(hits.get('/guide')).toBe(2);
      expect(run.lines).toContain(
        'FAIL /guide returned 502 with no Content-Type, expected 200 text/html*'
      );
      expect(run.last).toBe(`smoke-prod: 1 of 12 checks failed on ${base}`);
      expect(run.code).toBe(1);
    });
  });

  it('without a SHA, reads no build SHA', async () => {
    overrides = {
      '/guide': { ...production['/guide'], body: page(oldSha) },
      '/en': { ...production['/en'], body: '<html></html>' }
    };
    const run = await smoke();
    expect(run.lines.filter((line) => line.startsWith('REFETCH'))).toEqual([]);
    expect(run.lines.filter((line) => line.includes(' build '))).toEqual([]);
    expect(hits.get('/guide')).toBe(1);
    expect(run.last).toBe(allPassed);
    expect(run.code).toBe(0);
  });
});

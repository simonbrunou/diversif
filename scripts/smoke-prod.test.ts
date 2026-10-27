// scripts/smoke-prod.sh against a local server that answers every check the
// way production does, except where a test makes it drop a request (close the
// connection without an answer) or answer with another status. A fake `sleep`
// on PATH logs its argument and returns at once, so the retry spacing is
// asserted without waiting for it. The SHA wait is left out: it fetches origin.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'bun:test';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

// Per test: the requests to drop (path -> how many first requests) and the
// answers that differ from production.
let drops: Record<string, number> = {};
let overrides: Record<string, Answer> = {};
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
      if (n <= (drops[requestPath] ?? 0)) {
        socket.end();
        return;
      }
      socket.end(render(overrides[requestPath] ?? production[requestPath] ?? { status: 404 }));
    }
  }
});
const base = `http://127.0.0.1:${server.port}`;
const allPassed = `smoke-prod: 11 of 11 checks passed on ${base}`;

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
  rmSync(binDir, { recursive: true, force: true });
});

beforeEach(() => {
  drops = {};
  overrides = {};
  hits.clear();
  writeFileSync(sleepLog, '');
});

// Async spawn: the server answers on this process's event loop, which
// Bun.spawnSync would block until the script gave up.
async function smoke(baseUrl = base) {
  const proc = Bun.spawn({
    cmd: ['bash', scriptPath],
    env: {
      ...process.env,
      PATH: `${binDir}:${process.env.PATH}`,
      SMOKE_BASE_URL: baseUrl,
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
    // Port 9 (discard) is privileged, so no test process on the host can listen there.
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
});

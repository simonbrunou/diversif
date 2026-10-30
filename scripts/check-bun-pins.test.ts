// scripts/check-bun-pins.sh (#528) against small pin files written per test,
// so every line number below is exact and no edit to the repo's own
// ci.yml, railpack.json or Dockerfile moves it. The fixture holds the step
// and stage shapes the script must read: three setup-bun steps, one
// railpack.json pin and three oven/bun stages. A test edits one line into
// one failure class and asserts the exit code and the message that names
// the pin.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repo = path.resolve(import.meta.dir, '..');
const scriptPath = path.join(repo, 'scripts', 'check-bun-pins.sh');
const CI = '.forgejo/workflows/ci.yml';

const ciLines = [
  'name: CI', // 1
  'jobs:',
  '  a:',
  '    steps:',
  '      - uses: actions/checkout@v4', // 5
  '      - uses: oven-sh/setup-bun@abc123 # v2', // 6: a step that opens on its `- uses:`
  '        with:',
  '          bun-version: 1.2.3', // 8
  '      - run: bun install',
  '  b:', // 10
  '    steps:',
  '      - name: Setup Bun',
  '        uses: "oven-sh/setup-bun@abc123"', // 13: quoted, after `- name:`
  '        with:',
  '      # a comment at the dash column, inside the open step',
  '',
  '          no-cache: true',
  '          bun-version: "1.2.3" # pinned', // 18
  '      - run: echo b',
  '  c:', // 20
  '    steps:',
  '    - name: Setup Bun after a nested list',
  '      env:',
  '        LIST:',
  '          - item', // 25
  '      uses: oven-sh/setup-bun@abc123', // 26: the last step of the file
  '      with: # the setup-bun inputs',
  "        bun-version: '1.2.3'" // 28
];
const dockerLines = [
  'FROM oven/bun:1.2.3-debian@sha256:0123abcd AS builder', // 1
  'RUN bun install',
  'FROM --platform=linux/amd64 docker.io/oven/bun:1.2.3 AS deps', // 3
  'COPY --from=builder /app /app',
  'FROM oven/bun:1.2.3-alpine' // 5
];
const fixture: Record<string, string> = {
  [CI]: `${ciLines.join('\n')}\n`,
  'railpack.json': `${JSON.stringify({ provider: 'node', packages: { bun: '1.2.3' } }, null, 2)}\n`,
  Dockerfile: `${dockerLines.join('\n')}\n`
};

const base = mkdtempSync(path.join(tmpdir(), 'check-bun-pins-'));
// The current test's copy of the fixture: base/<test number>.
let dir = '';
let testNumber = 0;

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

beforeEach(() => {
  testNumber += 1;
  dir = path.join(base, String(testNumber));
  mkdirSync(path.join(dir, '.forgejo', 'workflows'), { recursive: true });
  for (const [file, text] of Object.entries(fixture)) writeFileSync(path.join(dir, file), text);
});

// Replace line `at` (1-based) of `file` with `text`, which may hold several lines.
function setLine(file: string, at: number, text: string): void {
  const p = path.join(dir, file);
  const lines = readFileSync(p, 'utf8').split('\n');
  if (at < 1 || at > lines.length) throw new Error(`${file} has no line ${at}`);
  lines[at - 1] = text;
  writeFileSync(p, lines.join('\n'));
}

function lineText(file: string, at: number): string {
  return fixture[file]!.split('\n')[at - 1]!;
}

function run(args: string[] = [dir], env?: Record<string, string>) {
  const p = Bun.spawnSync([scriptPath, ...args], env ? { env } : {});
  return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
}

// Run on the test's copy and expect exit 1 with every message on stderr.
function failsWith(...messages: string[]): string {
  const { code, err } = run();
  expect(code).toBe(1);
  for (const message of messages) expect(err).toContain(message);
  return err;
}

describe('check-bun-pins.sh passes', () => {
  it('on the repo pins', () => {
    const { code, out } = run([repo]);
    expect(code).toBe(0);
    expect(out).toContain('pins read Bun');
  });

  it('on every step and stage shape of the fixture, reading all seven pins', () => {
    const { code, out } = run();
    expect(code).toBe(0);
    expect(out).toContain('7 pins read Bun 1.2.3');
  });

  it('on CRLF line endings', () => {
    for (const file of Object.keys(fixture)) {
      writeFileSync(path.join(dir, file), fixture[file]!.replaceAll('\n', '\r\n'));
    }
    const { code, out } = run();
    expect(code).toBe(0);
    expect(out).toContain('7 pins read Bun 1.2.3');
  });

  it.each([
    [
      'an escape directive that keeps the backslash',
      1,
      `# escape=\\\n${lineText('Dockerfile', 1)}`
    ],
    ['a registry with a port', 5, 'FROM localhost:5000/oven/bun:1.2.3'],
    [
      'a FROM continued over lines that hold a comment and a blank line',
      3,
      'FROM --platform=linux/amd64 \\\n  # the deps stage\n\n  docker.io/oven/bun:1.2.3 \\\n  AS deps'
    ],
    // A build arg in a flag leaves the image's tag readable, so it passes.
    [
      'a --platform flag that reads a build arg',
      3,
      'FROM --platform=$BUILDPLATFORM docker.io/oven/bun:1.2.3 AS deps'
    ]
  ])('on %s', (_name, at, text) => {
    setLine('Dockerfile', at, text);
    const { code, out } = run();
    expect(code).toBe(0);
    expect(out).toContain('7 pins read Bun 1.2.3');
  });
});

describe('check-bun-pins.sh fails when a pin differs, listing every pin', () => {
  it.each([8, 18, 28])('the ci.yml input on line %d', (at) => {
    setLine(CI, at, lineText(CI, at).replace('1.2.3', '9.9.9'));
    failsWith('the Bun pins differ', `${CI}:${at}  9.9.9`, 'railpack.json packages.bun  1.2.3');
  });

  it('railpack.json packages.bun', () => {
    writeFileSync(path.join(dir, 'railpack.json'), JSON.stringify({ packages: { bun: '9.9.9' } }));
    failsWith('railpack.json packages.bun  9.9.9', `${CI}:8  1.2.3`);
  });

  it.each([1, 3, 5])('the Dockerfile stage on line %d', (at) => {
    setLine('Dockerfile', at, lineText('Dockerfile', at).replace('1.2.3', '9.9.9'));
    failsWith(`Dockerfile:${at}  9.9.9`);
  });

  // Lines BuildKit's parser reads as a FROM oven/bun:9.9.9 stage: the line
  // `at` of the fixture becomes `text`, and the stage starts on line `from`.
  it.each([
    [
      'an oven/bun image on the continued line of a FROM',
      5,
      'FROM \\\n  oven/bun:9.9.9 AS extra',
      5
    ],
    ['a continuation that splits the image mid-word', 5, 'FROM oven/b\\\nun:9.9.9', 5],
    ['a no-break space before FROM', 5, ' FROM oven/bun:9.9.9', 5],
    ['a vertical tab after FROM', 5, 'FROM\voven/bun:9.9.9', 5],
    ['a continuation line that ends in two CRs', 5, 'FROM \\\r\r\noven/bun:9.9.9', 5],
    [
      'a FROM on the first line, after a UTF-8 byte order mark',
      1,
      '﻿FROM oven/bun:9.9.9 AS builder',
      1
    ],
    [
      'a FROM after a line that ends in an escaped backslash',
      2,
      'RUN echo \\\\\nFROM oven/bun:9.9.9',
      3
    ],
    [
      'a FROM after a comment line that ends in a backslash',
      2,
      '# a comment \\\nFROM oven/bun:9.9.9',
      3
    ],
    [
      'a FROM after heredocs, whatever their end words',
      2,
      'RUN <<EOF-END\necho ok\nEOF-END\nFROM oven/bun:9.9.9\nRUN <<EOF\necho ok\nEOF',
      5
    ],
    // Known limit, failing closed: the check reads a heredoc body like any
    // other line rather than risk skipping a real stage (see the script header).
    [
      'a heredoc body line that starts with FROM oven/bun:<tag>',
      2,
      'RUN <<EOF\nFROM oven/bun:9.9.9\nEOF',
      3
    ],
    [
      'a FROM after a heredoc body that reads like a stage name',
      2,
      'RUN <<EOF\nFROM alpine AS oven/bun:9.9.9\nEOF\nFROM oven/bun:9.9.9',
      5
    ],
    [
      'a FROM after a heredoc end word that ends in a backslash',
      2,
      "RUN <<'EOF\\'\necho ok\nEOF\\\nFROM oven/bun:9.9.9",
      5
    ],
    [
      'a FROM split over two lines after a heredoc end word that ends in a backslash',
      2,
      "RUN <<'EOF\\'\necho ok\nEOF\\\nFROM \\\noven/bun:9.9.9",
      5
    ]
  ])('%s', (_name, at, text, from) => {
    setLine('Dockerfile', at, text);
    failsWith('the Bun pins differ', `Dockerfile:${from}  9.9.9`);
  });
});

describe('check-bun-pins.sh fails when it cannot read a pin', () => {
  it.each([
    [6, 8],
    [13, 18],
    [26, 28]
  ])('the setup-bun step on line %d without its bun-version', (step, input) => {
    setLine(CI, input, '');
    failsWith(`${CI}:${step} oven-sh/setup-bun step has no bun-version`);
  });

  it("a bun-version under the step's env: instead of with:", () => {
    setLine(CI, 7, '        env:');
    failsWith(
      `${CI}:6 oven-sh/setup-bun step has no bun-version`,
      `${CI}:8 bun-version is not in an oven-sh/setup-bun step`
    );
  });

  it("a bun-version under env: after the step's with:", () => {
    setLine(CI, 18, '        env:\n          bun-version: 1.2.3');
    failsWith(
      `${CI}:13 oven-sh/setup-bun step has no bun-version`,
      `${CI}:19 bun-version is not in an oven-sh/setup-bun step`
    );
  });

  it('a bun-version outside any setup-bun step', () => {
    setLine(CI, 5, `${lineText(CI, 5)}\n        with:\n          bun-version: 1.2.3`);
    failsWith(`${CI}:7 bun-version is not in an oven-sh/setup-bun step`);
  });

  it('a ci.yml with no setup-bun step', () => {
    writeFileSync(
      path.join(dir, CI),
      fixture[CI]!.replaceAll('oven-sh/setup-bun@', 'other/setup@')
    );
    failsWith(`${CI} has no oven-sh/setup-bun step`);
  });

  it.each([CI, 'railpack.json', 'Dockerfile'])('a %s that is gone', (file) => {
    renameSync(path.join(dir, file), path.join(dir, `${file}.old`));
    failsWith(`${file} not found`);
  });

  it.each([
    ['a renamed packages.bun key', JSON.stringify({ packages: { bunVersion: '1.2.3' } })],
    ['a JSON null', 'null']
  ])('railpack.json with %s', (_name, text) => {
    writeFileSync(path.join(dir, 'railpack.json'), text);
    expect(failsWith('railpack.json has no packages.bun')).not.toContain('TypeError');
  });

  it('a railpack.json that is not JSON, without a stack trace', () => {
    writeFileSync(path.join(dir, 'railpack.json'), '{ "packages": { "bun": "1.2.3", } }');
    expect(failsWith('railpack.json is not valid JSON')).not.toContain('SyntaxError');
  });

  it.each([
    ['oven/bun:latest', "oven/bun tag 'latest' does not start with an x.y.z version"],
    ['oven/bun:1.2-debian', "oven/bun tag '1.2-debian' does not start with an x.y.z version"],
    ['oven/bun', 'oven/bun has no tag'],
    ['oven/bun@sha256:0123abcd', 'oven/bun has no tag']
  ])('a Dockerfile stage FROM %s', (image, message) => {
    setLine('Dockerfile', 5, `FROM ${image}`);
    failsWith(`Dockerfile:5 ${message}`);
  });

  it.each(['FROM ${IMG}', 'FROM --platform=linux/amd64 ${IMG}'])(
    'a Dockerfile stage that takes its image from a build arg: %s',
    (from) => {
      setLine('Dockerfile', 5, `ARG IMG=oven/bun:1.2.3\n${from}`);
      failsWith('Dockerfile:6 FROM takes its image from a build arg');
    }
  );

  it.each([
    [
      'on line 1',
      `# escape=\`\n${lineText('Dockerfile', 1)}\nRUN echo ok\\\nFROM oven/bun:9.9.9`,
      1
    ],
    [
      'in capitals, after a syntax directive',
      `# syntax=docker/dockerfile:1\n#  ESCAPE = \`\n${lineText('Dockerfile', 1)}`,
      2
    ],
    ['after a leading space', ` # escape=\`\n${lineText('Dockerfile', 1)}`, 1]
  ])('a Dockerfile whose escape directive makes a backslash literal: %s', (_name, text, at) => {
    setLine('Dockerfile', 1, text);
    failsWith(`Dockerfile:${at} sets an escape character other than a backslash`);
  });

  it('a Dockerfile with no oven/bun stage', () => {
    for (const at of [1, 3, 5]) setLine('Dockerfile', at, 'FROM debian:bookworm-slim');
    failsWith('Dockerfile has no FROM oven/bun line');
  });
});

describe('check-bun-pins.sh exits 2', () => {
  it('on a directory that does not exist', () => {
    const { code, err } = run([path.join(base, 'missing')]);
    expect(code).toBe(2);
    expect(err).toContain('no directory');
  });

  it('on two arguments', () => {
    const { code, err } = run([dir, dir]);
    expect(code).toBe(2);
    expect(err).toContain('usage:');
  });

  it('without bun on PATH', () => {
    // A PATH holding bash alone, for the script's `#!/usr/bin/env bash`.
    const bin = path.join(dir, 'bin');
    mkdirSync(bin);
    symlinkSync(Bun.which('bash')!, path.join(bin, 'bash'));
    const { code, err } = run([dir], { PATH: bin });
    expect(code).toBe(2);
    expect(err).toContain('needs bun on PATH');
  });
});

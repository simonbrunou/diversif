// scripts/check-bun-pins.sh (#528) against small pin files written per test,
// so every line number below is exact and no edit to the repo's own
// ci.yml, railpack.json or Dockerfile moves it. The fixture holds the step
// and stage shapes the script must read: three setup-bun steps, one
// railpack.json pin and three oven/bun stages. A test edits one line into
// one failure class and asserts the exit code and the message that names
// the pin. The cases at the end compare the check with a YAML parser
// instead: they assert only that the check never passes a workflow the
// parser reads as a violation.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { execFile } from 'node:child_process';
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
import { parseDocument } from 'yaml';

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

// Run on the test's copy and expect exit 0, reading the fixture's seven pins.
function passes(): void {
  const { code, out, err } = run();
  expect(err).not.toContain(`${CI}:`);
  expect(code).toBe(0);
  expect(out).toContain('7 pins read Bun 1.2.3');
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

  // The body of a block scalar is shell text: what it says about
  // bun-version or setup-bun is no pin.
  const body = [
    'echo "bun-version: 9.9.9"',
    'bun-version: 1.2.3',
    'uses: oven-sh/setup-bun@abc123',
    '- { uses: oven-sh/setup-bun@abc123, with: { bun-version: 9.9.9 } }'
  ];
  it.each([
    ['- run: |', ['      - run: |', ...body.map((l) => `          ${l}`)]],
    [
      'run: >- under - name:',
      ['      - name: Install', '        run: >-', ...body.map((l) => `          ${l}`)]
    ]
  ])('on a block scalar body (%s) that mentions bun-version and setup-bun', (_name, text) => {
    setLine(CI, 9, text.join('\n'));
    passes();
  });

  it.each(['with: &inputs', 'with: !!map # tagged', 'with: !!map &inputs', '"with":'])(
    'on a block mapping of inputs named as %s',
    (withLine) => {
      setLine(CI, 7, `        ${withLine}`);
      passes();
    }
  );

  it.each([
    ['a plain value and a comment', 'bun-version: 1.2.3 # pinned'],
    ['a plain value and a tab before the comment', 'bun-version: 1.2.3\t# pinned'],
    ['a double-quoted key', '"bun-version": 1.2.3'],
    ['a single-quoted key', "'bun-version': 1.2.3"],
    ['a blank before the colon', 'bun-version : 1.2.3'],
    ['an anchor on the key', '&pin bun-version: 1.2.3']
  ])('on a bun-version input written as %s', (_name, text) => {
    setLine(CI, 8, `          ${text}`);
    passes();
  });

  // The runner hands setup-bun each input as INPUT_<key in upper case>.
  it.each(['Bun-Version: 1.2.3', 'BUN-VERSION: 1.2.3'])(
    'on a bun-version input in another letter case: %s',
    (text) => {
      setLine(CI, 8, `          ${text}`);
      passes();
    }
  );

  it.each([
    ['a comment that names setup-bun', 1, 'name: CI # example oven-sh/setup-bun@abc123'],
    ['a comment that names bun-version', 5, `${lineText(CI, 5)} # bun-version: 9.9.9`],
    ['a backslash in plain and single-quoted text', 9, `      - run: echo "a\\b" 'c\\d'`],
    ['a double-quoted backslash inside a single-quoted string', 1, `name: 'Example: "a\\b"'`],
    ['a * and a ? inside plain text', 9, '      - run: ls *.md && test "$x" = a?b'],
    ['a flow collection closed on its line', 1, 'name: CI\non: { push: { branches: [main] } }'],
    ['an expression in plain text', 9, '      - run: echo ${{ github.sha }}'],
    ['a key named after bun-version', 9, '      - env: { my-bun-version: 9.9.9 }'],
    ['a plain key with no blank after its colon in a flow mapping', 9, '      - env: {A:"b\\x2d"}'],
    [
      'a uses: >- inside a run: | body',
      9,
      '      - run: |\n          uses: >-\n            oven-sh/setup-bun@abc123'
    ]
  ])('on %s, which YAML reads as text', (_name, at, text) => {
    setLine(CI, at, text);
    passes();
  });
});

describe('check-bun-pins.sh fails when a pin differs, listing every pin', () => {
  it.each([8, 18, 28])('the ci.yml input on line %d', (at) => {
    setLine(CI, at, lineText(CI, at).replace('1.2.3', '9.9.9'));
    failsWith('the Bun pins differ', `${CI}:${at}  9.9.9`, 'railpack.json packages.bun  1.2.3');
  });

  it.each([
    ['a full URL', '      - uses: https://github.com/oven-sh/setup-bun@abc123'],
    ['another letter case', '      - uses: Oven-Sh/Setup-Bun@abc123']
  ])('the input of a setup-bun step whose uses: names the action by %s', (_name, uses) => {
    setLine(CI, 6, uses);
    setLine(CI, 8, '          bun-version: 9.9.9');
    failsWith('the Bun pins differ', `${CI}:8  9.9.9`);
  });

  it.each(['"bun-version": 9.9.9', "'bun-version': 9.9.9"])(
    'the input of a setup-bun step under a quoted key: %s',
    (key) => {
      setLine(CI, 8, `          ${key}`);
      failsWith('the Bun pins differ', `${CI}:8  9.9.9`);
    }
  );

  it('the input of a setup-bun step after a block scalar body, which ends at the dash column', () => {
    setLine(
      CI,
      9,
      '      - run: |\n          echo hi\n      - uses: oven-sh/setup-bun@abc123\n        with:\n          bun-version: 9.9.9'
    );
    failsWith('the Bun pins differ', `${CI}:13  9.9.9`);
  });

  it('the input of a setup-bun step after a key whose comment ends in `: |`, which starts no block scalar', () => {
    setLine(
      CI,
      28,
      `${lineText(CI, 28)}\n  hidden: # note: |\n    steps:\n      - uses: oven-sh/setup-bun@abc123\n        with:\n          bun-version: 9.9.9`
    );
    failsWith('the Bun pins differ', `${CI}:33  9.9.9`);
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

  // The value setup-bun receives is what YAML reads: the text inside the
  // quotes, or a plain scalar up to a # after a blank.
  it.each([
    ['a double-quoted # in the value', '"1.2.3#oops"', '1.2.3#oops'],
    ['a plain # with no blank before it', '1.2.3#oops', '1.2.3#oops'],
    ['two parts', '1.2', '1.2'],
    ['a dist-tag', 'latest', 'latest'],
    ['a v prefix', 'v1.2.3', 'v1.2.3'],
    ['a blank inside the quotes', '" 1.2.3"', ' 1.2.3'],
    ['a tab before the version inside the quotes', '"\t1.2.3"', '\t1.2.3'],
    ['a tab after the version inside the quotes', '"1.2.3\t"', '1.2.3\t'],
    ['text after the closing quote', '"1.2.3" 4', '"1.2.3" 4'],
    ['no value', '', ''],
    ['a block scalar', '|\n            1.2.3', '|']
  ])('a bun-version with %s', (_name, written, value) => {
    setLine(CI, 8, `          bun-version: ${written}`);
    const err = failsWith(`${CI}:8 bun-version '${value}' is not an x.y.z version`);
    expect(err).not.toContain('continues on the next line');
  });

  it.each([
    ['double-quoted', '"1.2.3\n            oops"'],
    ['single-quoted', "'1.2.3\n            oops'"]
  ])('a %s bun-version that runs onto the next line', (_name, written) => {
    setLine(CI, 8, `          bun-version: ${written}`);
    failsWith(
      `${CI}:8 leaves a quoted string open onto the next line, which this check cannot read`
    );
  });

  it.each([
    [8, 'on a deeper line', '          bun-version: 1.2.3\n            oops'],
    [8, 'after a blank line', '          bun-version: 1.2.3\n\n            oops'],
    [8, 'as a value on the next line', '          bun-version:\n            1.2.3'],
    [28, 'on a deeper line at the end of the file', '        bun-version: 1.2.3\n          oops']
  ])('a plain bun-version on line %d that continues %s', (at, _name, text) => {
    setLine(CI, at, text);
    failsWith(`${CI}:${at} bun-version continues on the next line, which this check cannot read`);
  });

  it('a bun-version nested deeper than the inputs of with:', () => {
    setLine(CI, 8, '          other:\n            bun-version: 1.2.3');
    failsWith(
      `${CI}:9 bun-version is nested deeper than the inputs of the step's with:`,
      `${CI}:6 oven-sh/setup-bun step has no bun-version`
    );
  });

  it('a bun-version under a with: nested in another key of the step', () => {
    setLine(CI, 8, '');
    setLine(CI, 7, '        env:\n          with:\n            bun-version: 1.2.3');
    failsWith(
      `${CI}:9 bun-version is not in an oven-sh/setup-bun step`,
      `${CI}:6 oven-sh/setup-bun step has no bun-version`
    );
  });

  it('a bun-version set twice in one step', () => {
    setLine(CI, 8, `${lineText(CI, 8)}\n          bun-version: 1.2.3`);
    failsWith(`${CI}:9 oven-sh/setup-bun step sets bun-version twice`);
  });

  // The runner hands setup-bun both as INPUT_BUN-VERSION, in Go's map order.
  it.each(['Bun-Version: 9.9.9', 'BUN-VERSION: 9.9.9'])(
    'a bun-version set twice in one step, the second time as %s',
    (text) => {
      setLine(CI, 8, `${lineText(CI, 8)}\n          ${text}`);
      failsWith(`${CI}:9 oven-sh/setup-bun step sets bun-version twice`);
    }
  );

  // Go's strings.ToUpper turns ſ into S and ı into I.
  it.each(['bun-verſion: 9.9.9', 'bun-versıon: 9.9.9'])(
    'an input of a setup-bun step written as %s, which the runner upper-cases to BUN-VERSION',
    (text) => {
      setLine(CI, 8, `${lineText(CI, 8)}\n          ${text}`);
      failsWith(
        `${CI}:9 names an input with a letter outside ASCII, which the runner may hand setup-bun as bun-version`
      );
    }
  );

  // The runner reads the uses: key by its exact name, so these steps never
  // run setup-bun.
  it.each([
    [6, '      - USES: oven-sh/setup-bun@abc123', 8],
    [13, '        Uses: "oven-sh/setup-bun@abc123"', 18]
  ])('a setup-bun step on line %d whose uses: key is not in lower case: %s', (at, text, input) => {
    setLine(CI, at, text);
    failsWith(
      `${CI}:${at} names setup-bun@ under a uses key not in lower case, which the runner does not read as uses:`,
      `${CI}:${input} bun-version is not in an oven-sh/setup-bun step`
    );
  });

  it('a step whose with: comes before its uses:', () => {
    setLine(CI, 8, '');
    setLine(CI, 7, '');
    setLine(
      CI,
      6,
      '      - with:\n          bun-version: 1.2.3\n        uses: oven-sh/setup-bun@abc123'
    );
    failsWith(
      `${CI}:7 bun-version is not in an oven-sh/setup-bun step`,
      `${CI}:8 oven-sh/setup-bun step has no bun-version`
    );
  });

  it.each([
    ['with its inputs', '{ uses: oven-sh/setup-bun@abc123, with: { bun-version: 9.9.9 } }'],
    ['without with:', '{ uses: oven-sh/setup-bun@abc123 }'],
    ['in a flow sequence of steps', '[ { uses: oven-sh/setup-bun@abc123 } ]']
  ])('a setup-bun step written as one flow mapping %s', (_name, step) => {
    setLine(CI, 8, `${lineText(CI, 8)}\n      - ${step}`);
    failsWith(
      `${CI}:9 names setup-bun@ in a flow mapping or sequence ({ uses: ... }), which this check cannot read`
    );
  });

  it('a setup-bun step written as a flow mapping over several lines', () => {
    setLine(
      CI,
      8,
      `${lineText(CI, 8)}\n      - { name: Setup Bun,\n          uses: oven-sh/setup-bun@abc123 }`
    );
    failsWith(
      `${CI}:9 leaves a flow mapping or sequence open onto the next line, which this check cannot read`
    );
  });

  it.each([
    [
      'a full URL',
      'https://github.com/oven-sh/setup-bun@abc123',
      'oven-sh/setup-bun step has no bun-version'
    ],
    [
      'another letter case',
      'Oven-Sh/Setup-Bun@abc123',
      'oven-sh/setup-bun step has no bun-version'
    ],
    [
      'a tag',
      '!!str oven-sh/setup-bun@abc123',
      'names setup-bun@ outside a uses: key this check reads (after a tag or an anchor, or in plain text)'
    ]
  ])(
    'a setup-bun step without with: whose uses: names the action by %s',
    (_name, action, message) => {
      setLine(CI, 8, '');
      setLine(CI, 7, '');
      setLine(CI, 6, `      - uses: ${action}`);
      failsWith(`${CI}:6 ${message}`);
    }
  );

  it.each([
    ['a flow mapping', '        with: { bun-version: 1.2.3 }'],
    [
      'a flow mapping with a nested bun-version',
      '        with: { other: { bun-version: 9.9.9 }, bun-version: 1.2.3 }'
    ],
    [
      'a flow mapping over several lines',
      '        with: {\n          bun-version: 1.2.3\n        }'
    ],
    ['an alias', '        with: *inputs'],
    ['an anchor then an alias', '        with: &a *b'],
    ['a tag other than !!map', '        with: !!str'],
    ['an anchor with no name', '        with: & '],
    ['a block scalar', '        with: |\n          bun-version: 1.2.3']
  ])('a setup-bun step whose with: is %s', (_name, text) => {
    setLine(CI, 8, '');
    setLine(CI, 7, text);
    failsWith(
      `${CI}:7 oven-sh/setup-bun step does not write with: as a block mapping, which this check cannot read`
    );
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

// YAML decodes these forms into text other than the line spells, so a
// bun-version or a setup-bun step written with them would pass unread.
describe('check-bun-pins.sh fails on a YAML form that can spell a key or value as other text', () => {
  it.each([
    // Line `at` of the fixture becomes `text`, and the escape is on line `on`.
    ['an escaped bun-version key', 8, '          "bun\\x2dversion": 9.9.9', 8],
    ['an escaped bun-version value', 8, '          bun-version: "1.2.\\x33"', 8],
    ['an escaped setup-bun in uses:', 6, '      - uses: "oven-sh/setup\\x2dbun@abc123"', 6],
    [
      'a step written as one flow mapping with escaped keys',
      8,
      `${lineText(CI, 8)}\n      - { "us\\x65s": "oven-sh/setup\\x2dbun@abc123", with: { "bun\\x2dversion": 9.9.9 } }`,
      9
    ]
  ])('%s', (_name, at, text, on) => {
    setLine(CI, at, text);
    failsWith(
      `${CI}:${on} holds an escape in a double-quoted string, which this check cannot read`
    );
  });

  // In a flow collection, a colon right after a quoted key or a closed
  // collection starts a value even with no blank after it.
  it.each([
    ['a double-quoted key', '      - {"uses":"oven-sh/setup\\x2dbun@abc123"}'],
    ['a double-quoted key and a blank', '      - {"uses" :"oven-sh/setup\\x2dbun@abc123"}'],
    ['a single-quoted key', `      - {'uses':"oven-sh/setup\\x2dbun@abc123"}`],
    ['a closed flow sequence', '      - {[a]:"oven-sh/setup\\x2dbun@abc123"}'],
    ['a closed empty flow sequence', '      - {[]:"oven-sh/setup\\x2dbun@abc123"}']
  ])(
    'an escaped setup-bun in a flow mapping, after %s then a colon with no blank after it',
    (_name, text) => {
      setLine(CI, 9, text);
      failsWith(`${CI}:9 holds an escape in a double-quoted string, which this check cannot read`);
    }
  );

  it('an alias as the action of a JSON-style uses: key', () => {
    setLine(CI, 1, 'name: &action oven-sh/setup-bun@abc123');
    setLine(CI, 9, '      - {"uses":*action}');
    failsWith(`${CI}:9 uses a YAML alias, which this check cannot read`);
  });

  it('an alias as an input key', () => {
    setLine(CI, 1, 'name: &key bun-version');
    setLine(CI, 8, '          *key : 9.9.9');
    failsWith(
      `${CI}:8 uses a YAML alias, which this check cannot read`,
      `${CI}:6 oven-sh/setup-bun step has no bun-version`
    );
  });

  it('an alias as the bun-version value', () => {
    setLine(CI, 1, 'name: &pin 9.9.9');
    setLine(CI, 8, '          bun-version: *pin');
    failsWith(`${CI}:8 uses a YAML alias, which this check cannot read`);
  });

  it('an alias as the action of uses:, and the anchor that names setup-bun', () => {
    setLine(CI, 1, 'name: &action oven-sh/setup-bun@abc123');
    setLine(CI, 6, '      - uses: *action');
    failsWith(
      `${CI}:1 names setup-bun@ outside a uses: key this check reads`,
      `${CI}:6 uses a YAML alias`
    );
  });

  it('an explicit bun-version key', () => {
    setLine(CI, 8, '          ? bun-version\n          : 9.9.9');
    failsWith(`${CI}:8 uses a YAML explicit key (?), which this check cannot read`);
  });

  it.each([
    ['a !!binary key that decodes to bun-version', 8, '          !!binary YnVuLXZlcnNpb24=: 9.9.9'],
    ['a !!str key', 8, '          !!str bun-version: 9.9.9'],
    ['a local tag on the bun-version value', 8, '          bun-version: !pin 1.2.3'],
    [
      'a !!binary uses: that decodes to setup-bun',
      5,
      '      - uses: !!binary b3Zlbi1zaC9zZXR1cC1idW5AYWJjMTIz'
    ],
    [
      'a !!binary uses: after a JSON-style key with no blank after its colon',
      9,
      '      - {"uses":!!binary b3Zlbi1zaC9zZXR1cC1idW5AYWJjMTIz}'
    ]
  ])('%s', (_name, at, text) => {
    setLine(CI, at, text);
    failsWith(`${CI}:${at} uses a YAML tag other than !!map, which this check cannot read`);
  });

  it('a quoted string that runs onto the next line', () => {
    setLine(CI, 1, 'name: "CI\n  main"');
    failsWith(
      `${CI}:1 leaves a quoted string open onto the next line, which this check cannot read`
    );
  });
});

// This reader skips the body of a block scalar, so a uses: written as one
// would hide the action it names.
describe('check-bun-pins.sh fails on a uses: written as a block scalar', () => {
  const blockUses = (line: number) =>
    `${CI}:${line} uses: names its action in a block scalar (| or >), which this check cannot read`;

  it.each([
    ['- uses: >-', '      - uses: >-', 9],
    ['- uses: |', '      - uses: |', 9],
    ['- "uses": >-', '      - "uses": >-', 9],
    ["- 'uses': |-", "      - 'uses': |-", 9],
    ['- Uses: > in another letter case', '      - Uses: >', 9],
    ['uses: > under - name:', '      - name: Setup Bun\n        uses: >', 10]
  ])('%s that names setup-bun', (_name, header, line) => {
    setLine(CI, 9, `${header}\n          oven-sh/setup-bun@abc123`);
    failsWith(blockUses(line));
  });

  it('that names another action, which this reader cannot tell', () => {
    setLine(CI, 9, '      - uses: >-\n          actions/checkout@v4');
    failsWith(blockUses(9));
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

// The check reads ci.yml with an awk line reader, and each gap in it was
// found by hand (#564, #589). Here a YAML parser reads the same workflows
// (#652, ported from sutom#204). Each case writes one entry of the fixture's
// setup-bun steps in one YAML form (or a whole step, or a step or a
// bun-version it adds), and parses the result with eemeli/yaml, which
// resolves << merge keys as go-yaml does for Forgejo. Bun.YAML would not do:
// it reads a !!binary scalar as its base64 text and takes a duplicate key.
// The check may refuse any case. It must never exit 0 on one in which the
// parser finds a setup-bun step whose with: holds no bun-version of 1.2.3
// (the fixture's railpack.json and Dockerfile pin, so an x.y.z other than
// that one is a pin the check misread), or a bun-version key anywhere else.

// A mapping entry: a key and a scalar, or a key and the entries of a block
// mapping.
type Entry = [key: string, value: string | Entry[]];
// One YAML form: the lines of an entry whose key sits at column `at`, or
// null when the form does not apply to that entry.
type Form = (entry: Entry, at: number) => string[] | null;
// One form of a whole step: the lines of the list item whose dash sits at
// column `dash`.
type ItemForm = (entries: Entry[], dash: number) => string[];

const BV = 'bun-version';
const PIN = '1.2.3';
const ACTION = 'oven-sh/setup-bun@abc123';

const pad = (n: number) => ' '.repeat(n);
const hex = (s: string) => `\\x${s.charCodeAt(0).toString(16).padStart(2, '0')}`;

function block([key, value]: Entry, at: number, writtenKey = key): string[] {
  return typeof value === 'string'
    ? [`${pad(at)}${writtenKey}: ${value}`]
    : [`${pad(at)}${writtenKey}:`, ...value.flatMap((entry) => block(entry, at + 2))];
}

function flow(entries: Entry[]): string {
  const items = entries.map(([k, v]) => `${k}: ${typeof v === 'string' ? v : flow(v)}`);
  return `{ ${items.join(', ')} }`;
}

// The lines after a { that ends the line of a key or a dash at column `at`:
// one entry a line, deeper than the key, as eemeli/yaml requires, then the }.
function flowLines(entries: Entry[], at: number): string[] {
  const items = entries.map(
    ([k, v]) => `${pad(at + 4)}${k}: ${typeof v === 'string' ? v : flow(v)},`
  );
  return [...items, `${pad(at + 2)}}`];
}

function json(entries: Entry[]): string {
  const items = entries.map(
    ([k, v]) => `${JSON.stringify(k)}:${typeof v === 'string' ? JSON.stringify(v) : json(v)}`
  );
  return `{${items.join(',')}}`;
}

// A form that applies to scalar entries only, or to block mappings only.
const scalarOnly =
  (write: (key: string, value: string, at: number) => string[]): Form =>
  ([key, value], at) =>
    typeof value === 'string' ? write(key, value, at) : null;
const mappingOnly =
  (write: (key: string, value: Entry[], at: number) => string[]): Form =>
  ([key, value], at) =>
    typeof value === 'string' ? null : write(key, value, at);
// The block lines of an entry, with `text` (an anchor or a tag) written
// after its key.
const afterKey = (entry: Entry, at: number, text: string) => {
  const [first, ...rest] = block(entry, at);
  return [first!.replace(/:( |$)/, `: ${text}$1`), ...rest];
};

const forms: [name: string, form: Form][] = [
  ['plain', (entry, at) => block(entry, at)],
  ['a double-quoted key', (entry, at) => block(entry, at, `"${entry[0]}"`)],
  ['a single-quoted key', (entry, at) => block(entry, at, `'${entry[0]}'`)],
  // The runner reads uses: and with: by their exact names, and hands
  // setup-bun each input as INPUT_<name in upper case>, with Go's
  // strings.ToUpper, which also turns ſ into S and ı into I.
  ['a key in upper case', (entry, at) => block(entry, at, entry[0].toUpperCase())],
  [
    'a key with a letter the runner upper-cases to ASCII',
    ([k, v], at) =>
      k.includes('s')
        ? block([k, v], at, k.replace('s', 'ſ'))
        : k.includes('i')
          ? block([k, v], at, k.replace('i', 'ı'))
          : null
  ],
  ['a tab after the colon', scalarOnly((k, v, at) => [`${pad(at)}${k}:\t${v}`])],
  ['a double-quoted value', scalarOnly((k, v, at) => [`${pad(at)}${k}: "${v}"`])],
  ['a single-quoted value', scalarOnly((k, v, at) => [`${pad(at)}${k}: '${v}'`])],
  [
    'a comment after it',
    (entry, at) => {
      const [first, ...rest] = block(entry, at);
      return [`${first} # bun-version: 9.9.9 uses: oven-sh/setup-bun@v2`, ...rest];
    }
  ],
  [
    'a comment line before it',
    (entry, at) => [`${pad(at)}# with: { bun-version: 9.9.9 }`, ...block(entry, at)]
  ],
  ['the !!str tag', scalarOnly((k, v, at) => [`${pad(at)}${k}: !!str ${v}`])],
  ['the !!map tag', mappingOnly((k, v, at) => afterKey([k, v], at, '!!map'))],
  ['the !!binary tag', scalarOnly((k, v, at) => [`${pad(at)}${k}: !!binary ${btoa(v)}`])],
  ['a local tag', (entry, at) => afterKey(entry, at, '!pin')],
  ['an anchor on the value', (entry, at) => afterKey(entry, at, '&v')],
  ['an anchor on the key', (entry, at) => block(entry, at, `&k ${entry[0]}`)],
  [
    'an alias of an anchor on another key',
    ([k, v], at) => [...afterKey([`x-${k}`, v], at, '&v'), `${pad(at)}${k}: *v`]
  ],
  ['a merge key', mappingOnly((k, v, at) => [`${pad(at)}${k}:`, `${pad(at + 2)}<<: ${flow(v)}`])],
  ['a flow mapping', mappingOnly((k, v, at) => [`${pad(at)}${k}: ${flow(v)}`])],
  ['a JSON-style flow mapping', mappingOnly((k, v, at) => [`${pad(at)}${k}: ${json(v)}`])],
  [
    'a flow mapping over several lines',
    mappingOnly((k, v, at) => [`${pad(at)}${k}: {`, ...flowLines(v, at)])
  ],
  ['a flow sequence', scalarOnly((k, v, at) => [`${pad(at)}${k}: [${v}]`])],
  [
    'a literal block scalar',
    scalarOnly((k, v, at) => [`${pad(at)}${k}: |-`, `${pad(at + 2)}${v}`])
  ],
  ['a folded block scalar', scalarOnly((k, v, at) => [`${pad(at)}${k}: >-`, `${pad(at + 2)}${v}`])],
  [
    'a block scalar after an anchor',
    scalarOnly((k, v, at) => [`${pad(at)}${k}: &v |-`, `${pad(at + 2)}${v}`])
  ],
  [
    'the value on the next line',
    scalarOnly((k, v, at) => [`${pad(at)}${k}:`, `${pad(at + 2)}${v}`])
  ],
  [
    'a plain value continued on a deeper line',
    scalarOnly((k, v, at) => [`${pad(at)}${k}: ${v}`, `${pad(at + 2)}oops`])
  ],
  [
    'a double-quoted value over two lines',
    scalarOnly((k, v, at) => [`${pad(at)}${k}: "${v}`, `${pad(at + 2)}"`])
  ],
  [
    'an escape in the key',
    (entry, at) => block(entry, at, `"${hex(entry[0])}${entry[0].slice(1)}"`)
  ],
  [
    'an escape in the value',
    scalarOnly((k, v, at) => [`${pad(at)}${k}: "${hex(v)}${v.slice(1)}"`])
  ],
  [
    'an explicit key',
    ([k, v], at) =>
      typeof v === 'string'
        ? [`${pad(at)}? ${k}`, `${pad(at)}: ${v}`]
        : [`${pad(at)}? ${k}`, `${pad(at)}:`, ...block([k, v], at).slice(1)]
  ],
  // The entry under another key, or as text in the body of a block scalar.
  ['under another key', (entry, at) => [`${pad(at)}other:`, ...block(entry, at + 2)]],
  [
    'in the body of a block scalar that is a list item',
    (entry, at) => [`${pad(at)}args:`, `${pad(at + 2)}- |`, ...block(entry, at + 4)]
  ],
  [
    'in the body of a block scalar whose key holds a blank',
    (entry, at) => [`${pad(at)}my key: |`, ...block(entry, at + 2)]
  ],
  [
    'in the body of a block scalar after an anchor',
    (entry, at) => [`${pad(at)}notes: &n |`, ...block(entry, at + 2)]
  ],
  [
    'in the body of a block scalar whose quoted key holds a blank',
    (entry, at) => [`${pad(at)}"my key": |`, ...block(entry, at + 2)]
  ],
  // The entry in a setup-bun step nested in another value, which YAML reads
  // as no step. A second uses: there would be a duplicate key.
  [
    'under another key, beside a uses: of setup-bun',
    (entry, at) =>
      entry[0] === 'uses'
        ? null
        : [`${pad(at)}other:`, `${pad(at + 2)}uses: ${ACTION}`, ...block(entry, at + 2)]
  ],
  [
    'in a setup-bun step in a list under another key',
    (entry, at) =>
      entry[0] === 'uses'
        ? null
        : [`${pad(at)}args:`, `${pad(at + 2)}- uses: ${ACTION}`, ...block(entry, at + 4)]
  ]
];

const itemForms: [name: string, form: ItemForm][] = [
  ['a flow mapping', (entries, dash) => [`${pad(dash)}- ${flow(entries)}`]],
  ['a JSON-style flow mapping', (entries, dash) => [`${pad(dash)}- ${json(entries)}`]],
  [
    'a JSON-style flow mapping with its dashes escaped',
    (entries, dash) => [`${pad(dash)}- ${json(entries).replaceAll('-', '\\x2d')}`]
  ],
  [
    'a flow mapping over several lines',
    (entries, dash) => [`${pad(dash)}- {`, ...flowLines(entries, dash)]
  ],
  [
    'an anchor on the item',
    (entries, dash) => [`${pad(dash)}- &step`, ...entries.flatMap((e) => block(e, dash + 2))]
  ],
  [
    'the !!map tag on the item',
    (entries, dash) => [`${pad(dash)}- !!map`, ...entries.flatMap((e) => block(e, dash + 2))]
  ],
  ['a merge key', (entries, dash) => [`${pad(dash)}- <<: ${flow(entries)}`]]
];

// The lines of a list item whose keys sit at column dash + 2, with the dash
// on its first line that is no comment.
function dashed(lines: string[], dash: number): string[] {
  const first = lines.findIndex((line) => !/^\s*#/.test(line));
  return lines.map((line, i) => (i === first ? `${pad(dash)}- ${line.slice(dash + 2)}` : line));
}

// The fixture's setup-bun steps: the first line of the item, the column of
// its dash, the lines of its uses: and with:, the entries the item forms
// write before uses: (they leave out step c's env:, a list), and the inputs
// by line. The last input, bun-version, is on the last line of the step.
type Step = {
  item: number;
  dash: number;
  uses: number;
  with: number;
  entries: Entry[];
  inputs: [line: number, input: Entry][];
};
const steps: Step[] = [
  { item: 6, dash: 6, uses: 6, with: 7, entries: [], inputs: [[8, [BV, PIN]]] },
  {
    item: 12,
    dash: 6,
    uses: 13,
    with: 14,
    entries: [['name', 'Setup Bun']],
    inputs: [
      [17, ['no-cache', 'true']],
      [18, [BV, PIN]]
    ]
  },
  {
    item: 22,
    dash: 4,
    uses: 26,
    with: 27,
    entries: [['name', 'Setup Bun after a nested list']],
    inputs: [[28, [BV, PIN]]]
  }
];

// The fixture's ci.yml with line `at` (1-based) replaced by edits[at], which
// may hold no line or several.
function edited(edits: Record<number, string[]>): string {
  return `${ciLines.flatMap((line, i) => edits[i + 1] ?? [line]).join('\n')}\n`;
}

// Lines `from` to `to` replaced by `lines`.
function replaced(from: number, to: number, lines: string[]): Record<number, string[]> {
  const edits: Record<number, string[]> = { [from]: lines };
  for (let at = from + 1; at <= to; at++) edits[at] = [];
  return edits;
}

// Line `at` kept, and `lines` added after it.
const after = (at: number, lines: string[]) => ({ [at]: [ciLines[at - 1]!, ...lines] });

// A setup-bun step without a bun-version, added after line 9 in the
// fixture's layout: `- ` at column 6.
const ADDED = 'a setup-bun step without a bun-version added after line 9';
const addedUses: Entry = ['uses', ACTION];
const noCache: Entry = ['with', [['no-cache', 'true']]];
const addedStep = (lines: string[]) => edited(after(9, dashed(lines, 6)));

// Whether the parser rejects `text` for duplicate keys and nothing else.
function duplicateKeysOnly(text: string): boolean {
  const { errors } = parseDocument(text, { merge: true });
  return errors.length > 0 && errors.every((e) => e.code === 'DUPLICATE_KEY');
}

type Case = { name: string; form: string; text: string };
const cases: Case[] = [{ name: 'the unmodified fixture', form: 'none', text: fixture[CI]! }];
function addCase(form: string, where: string, text: string | null): void {
  if (text !== null) cases.push({ name: `${form}: ${where}`, form, text });
}

for (const [name, form] of forms) {
  for (const step of steps) {
    // The step's keys sit two columns right of its dash, and its inputs two
    // more.
    const keys = step.dash + 2;
    const inputAt = keys + 2;
    const inputs = step.inputs.map(([, input]) => input);
    const last = step.inputs.at(-1)![0];
    // The uses:, a line added to the step before its with:, and each input
    // but bun-version, each as it is and with the step's bun-version
    // removed, where the parser reads a violation.
    const variants: [name: string, edits: Record<number, string[]>][] = [
      ['', {}],
      [`, with the ${BV} on line ${last} removed`, { [last]: [] }]
    ];
    for (const [variant, edits] of variants) {
      const uses = form(addedUses, keys);
      const usesLines = uses && (step.uses === step.item ? dashed(uses, step.dash) : uses);
      addCase(
        name,
        `the uses: on line ${step.uses}${variant}`,
        usesLines && edited({ ...edits, [step.uses]: usesLines })
      );
      const id = form(['id', 'setup'], keys);
      addCase(
        name,
        `a line added after line ${step.uses}${variant}`,
        id && edited({ ...edits, ...after(step.uses, id) })
      );
      for (const [line, input] of step.inputs.slice(0, -1)) {
        const lines = form(input, inputAt);
        addCase(
          name,
          `the input on line ${line}${variant}`,
          lines && edited({ ...edits, [line]: lines })
        );
      }
    }
    // The with: block, as it is, with bun-version 9.9.9, nested under
    // extra:, and removed.
    const withBlock = (written: Entry[]) => {
      const lines = form(['with', written], keys);
      return lines && edited(replaced(step.with, last, lines));
    };
    const others = inputs.filter(([k]) => k !== BV);
    addCase(name, `the with: on line ${step.with}`, withBlock(inputs));
    addCase(
      name,
      `the with: on line ${step.with}, with ${BV}: 9.9.9`,
      withBlock([...others, [BV, '9.9.9']])
    );
    addCase(
      name,
      `the with: on line ${step.with}, with ${BV} nested under extra:`,
      withBlock([...others, ['extra', [[BV, PIN]]]])
    );
    addCase(name, `the with: on line ${step.with}, without ${BV}`, withBlock(others));
    // The bun-version input, as it is, with 9.9.9, nested under extra:, and
    // moved to the step's keys.
    const input = form([BV, PIN], inputAt);
    addCase(name, `the input on line ${last}`, input && edited({ [last]: input }));
    const other = form([BV, '9.9.9'], inputAt);
    addCase(name, `the input on line ${last}, reading 9.9.9`, other && edited({ [last]: other }));
    const nested = form([BV, PIN], inputAt + 2);
    addCase(
      name,
      `the input on line ${last}, nested under extra:`,
      nested && edited({ [last]: [`${pad(inputAt)}extra:`, ...nested] })
    );
    const moved = form([BV, PIN], keys);
    addCase(
      name,
      `the input on line ${last}, moved to the step's keys after line ${step.uses}`,
      moved && edited({ [last]: [], ...after(step.uses, moved) })
    );
    // A second bun-version after the step's own. Most forms write the same
    // key again, which YAML rejects as a duplicate, so those cases drop out.
    const second = form([BV, '9.9.9'], inputAt);
    const beside = second && edited(after(last, second));
    if (beside !== null && !duplicateKeysOnly(beside)) {
      addCase(name, `a ${BV}: 9.9.9 added after line ${last}`, beside);
    }
  }
  // A bun-version added to the with: of the checkout step on line 5.
  const added = form([BV, PIN], 10);
  addCase(
    name,
    `a ${BV} added to a with: of the step on line 5`,
    added && edited(after(5, ['        with:', ...added]))
  );
  const uses = form(addedUses, 8);
  addCase(name, `the uses: of ${ADDED}`, uses && addedStep([...uses, ...block(noCache, 8)]));
  const inputs = form(noCache, 8);
  addCase(name, `the with: of ${ADDED}`, inputs && addedStep([...block(addedUses, 8), ...inputs]));
  const input = form(['no-cache', 'true'], 10);
  addCase(
    name,
    `the input of ${ADDED}`,
    input && addedStep([...block(addedUses, 8), '        with:', ...input])
  );
}

for (const [name, form] of itemForms) {
  const item = `the step as ${name}`;
  for (const step of steps) {
    const inputs = step.inputs.map(([, input]) => input);
    const others = inputs.filter(([k]) => k !== BV);
    const last = step.inputs.at(-1)![0];
    const variants: [name: string, written: Entry[]][] = [
      ['', inputs],
      [`, with ${BV}: 9.9.9`, [...others, [BV, '9.9.9']]],
      [`, without ${BV}`, others]
    ];
    for (const [variant, written] of variants) {
      const lines = form([...step.entries, addedUses, ['with', written]], step.dash);
      addCase(item, `on line ${step.item}${variant}`, edited(replaced(step.item, last, lines)));
    }
  }
  addCase(item, ADDED, edited(after(9, form([addedUses, noCache], 6))));
}

// The setup-bun steps the parser reads whose with: holds no bun-version of
// 1.2.3, as `<job> step <n>`, and every other bun-version key, by its path.
// A step's uses: and with: are read by their exact names, and its inputs in
// upper case, as the runner reads them (see `forms`): two inputs that both
// read BUN-VERSION leave setup-bun's version to Go's map order. A !!binary
// scalar is bytes here, which go-yaml hands Forgejo as text, so it is read
// as text. A workflow the parser rejects throws: the generator wrote no
// YAML.
function parserViolations(text: string): string[] {
  const doc = parseDocument(text, { merge: true });
  if (doc.errors.length > 0) {
    throw new Error(`the parser rejects this case: ${doc.errors[0]!.message}\n${text}`);
  }
  const asText = (v: unknown) =>
    typeof v === 'string' ? v : v instanceof Uint8Array ? new TextDecoder().decode(v) : undefined;
  const get = (node: unknown, key: string): unknown =>
    node instanceof Map ? [...node].find(([k]) => asText(k) === key)?.[1] : undefined;
  const violations: string[] = [];
  const root: unknown = doc.toJS({ mapAsMap: true });
  // The paths of the with: of each setup-bun step.
  const inputs = new Set<string>();
  const jobs = get(root, 'jobs');
  for (const [job, body] of jobs instanceof Map ? jobs : []) {
    const jobSteps = get(body, 'steps');
    (Array.isArray(jobSteps) ? jobSteps : []).forEach((step: unknown, i) => {
      const uses = asText(get(step, 'uses'))?.toLowerCase();
      if (uses === undefined || !/^(.*\/)?oven-sh\/setup-bun@/.test(uses)) return;
      inputs.add(`/jobs/${asText(job)}/steps/${i}/with`);
      const stepInputs = get(step, 'with');
      const pins = [...(stepInputs instanceof Map ? stepInputs : [])].filter(
        ([k]) => asText(k)?.toUpperCase() === BV.toUpperCase()
      );
      if (pins.length !== 1 || asText(pins[0]![1]) !== PIN) {
        violations.push(`${asText(job)} step ${i + 1}`);
      }
    });
  }
  // Every bun-version key, keys that are collections included.
  const walk = (node: unknown, at: string): void => {
    if (Array.isArray(node)) node.forEach((item, i) => walk(item, `${at}/${i}`));
    if (!(node instanceof Map)) return;
    for (const [k, v] of node) {
      if (asText(k) === BV && !inputs.has(at)) violations.push(`${BV} at ${at || '/'}`);
      walk(k, `${at}/?`);
      walk(v, `${at}/${asText(k) ?? '?'}`);
    }
  };
  walk(root, '');
  return violations;
}

function runAsync(target: string): Promise<{ code: number | null; out: string; err: string }> {
  return new Promise((resolve) => {
    // A run still going after 30 s is stuck: killed, it exits with no code.
    execFile(scriptPath, [target], { encoding: 'utf8', timeout: 30_000 }, (error, out, err) => {
      const code = error === null ? 0 : typeof error.code === 'number' ? error.code : null;
      resolve({ code, out, err });
    });
  });
}

describe('check-bun-pins.sh compared with a YAML parser', () => {
  it('reads the unmodified fixture as the parser does: every step pins 1.2.3', () => {
    expect(parserViolations(fixture[CI]!)).toEqual([]);
    passes();
  });

  it('generates, for every form, a case the parser reads as a violation, each under its own name', () => {
    const names = [
      ...forms.map(([name]) => name),
      ...itemForms.map(([name]) => `the step as ${name}`)
    ];
    const found = new Set(
      cases.filter((c) => parserViolations(c.text).length > 0).map((c) => c.form)
    );
    expect(names.filter((name) => !found.has(name))).toEqual([]);
    expect(new Set(cases.map((c) => c.name)).size).toBe(cases.length);
  });

  // Each case runs in its own directory, so the cases run side by side.
  describe.concurrent('never passes a case the parser reads as a violation', () => {
    for (const [i, { name, text }] of cases.entries()) {
      it(name, async () => {
        const violations = parserViolations(text);
        const at = path.join(base, 'yaml', String(i));
        mkdirSync(path.join(at, '.forgejo', 'workflows'), { recursive: true });
        for (const [file, content] of Object.entries({ ...fixture, [CI]: text })) {
          writeFileSync(path.join(at, file), content);
        }
        const { code, out, err } = await runAsync(at);
        const codes: (number | null)[] = [0, 1];
        expect(codes, `check-bun-pins.sh exited ${code}:\n${out}${err}`).toContain(code);
        if (code === 0) expect(violations, `check-bun-pins.sh passed on\n${text}`).toEqual([]);
      });
    }
  });
});

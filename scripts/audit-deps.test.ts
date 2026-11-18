// scripts/audit-deps.sh, its ignore of GHSA-fc5q-39xc-vjpf and the expiry
// check of that ignore (#780), with a stub `bun` first on PATH, so no test
// installs a package, audits one or calls the registry. The stub logs each
// call, and hands `bun -e` (the production scope's package.json rewrite and
// the version comparison) to the Bun that runs this test. Its `audit` acts
// like the real one: it exits 1 unless each advisory it finds is named by an
// `--ignore=`. It finds those in FAKE_ADVISORIES, plus FAKE_PRODUCTION_EXTRA
// in the production scope (which audits under TMPDIR) or FAKE_ALL_EXTRA in
// the all scope. Its `info` prints FAKE_LATEST and exits FAKE_INFO_EXIT.
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const scriptPath = path.resolve(import.meta.dir, 'audit-deps.sh');
// The production scope spawns Bun twice; a loaded CI runner stalls a process
// for seconds (#572), so the tests get 30 s instead of the 5 s default.
const TIMEOUT = 30_000;
const GHSA = 'GHSA-fc5q-39xc-vjpf';
const OTHER_GHSA = 'GHSA-aaaa-bbbb-cccc';

const STUB = `#!/usr/bin/env bash
printf '%s\\n' "$*" >> "$CALLS"
case "$1" in
  -e) exec "$REAL_BUN" "$@" ;;
  install) exit 0 ;;
  audit)
    case "$PWD" in
      "$TMPDIR"/*) extra="$FAKE_PRODUCTION_EXTRA" ;;
      *) extra="$FAKE_ALL_EXTRA" ;;
    esac
    for advisory in $FAKE_ADVISORIES $extra; do
      found=0
      for arg in "$@"; do
        if [ "$arg" = "--ignore=$advisory" ]; then found=1; fi
      done
      if [ "$found" = 0 ]; then
        echo "$advisory: 1 vulnerability (1 high)"
        exit 1
      fi
    done
    echo "No vulnerabilities found"
    exit 0
    ;;
  info)
    printf '%s\\n' "$FAKE_LATEST"
    exit "\${FAKE_INFO_EXIT:-0}"
    ;;
  *)
    echo "stub bun: unexpected call: $*" >&2
    exit 99
    ;;
esac
`;

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(path.join(tmpdir(), 'audit-deps-test-'));
  writeFileSync(path.join(dir, 'bun'), STUB);
  chmodSync(path.join(dir, 'bun'), 0o755);
  writeFileSync(path.join(dir, 'calls'), '');
});

afterEach(() => rmSync(dir, { recursive: true, force: true }));

interface Fake {
  latest?: string;
  infoExit?: number;
  advisories?: string[];
  productionExtra?: string;
  allExtra?: string;
}

function auditDeps(args: string[], fake: Fake = {}) {
  const r = Bun.spawnSync({
    cmd: ['bash', scriptPath, ...args],
    env: {
      PATH: `${dir}:${process.env.PATH ?? ''}`,
      HOME: process.env.HOME ?? tmpdir(),
      TMPDIR: dir,
      CALLS: path.join(dir, 'calls'),
      REAL_BUN: process.execPath,
      FAKE_LATEST: fake.latest ?? '4.0.7',
      FAKE_INFO_EXIT: String(fake.infoExit ?? 0),
      FAKE_ADVISORIES: (fake.advisories ?? [GHSA]).join(' '),
      FAKE_PRODUCTION_EXTRA: fake.productionExtra ?? '',
      FAKE_ALL_EXTRA: fake.allExtra ?? ''
    }
  });
  const calls = readFileSync(path.join(dir, 'calls'), 'utf8').split('\n').filter(Boolean);
  return {
    code: r.exitCode,
    out: r.stdout.toString(),
    err: r.stderr.toString(),
    calls: (sub: string) => calls.filter((c) => c.split(' ')[0] === sub)
  };
}

describe('audit-deps.sh', () => {
  describe('ignores the picomatch advisory', () => {
    it.each([
      ['production', ['install --ignore-scripts']],
      ['all', ['install --frozen-lockfile']]
    ])(
      'in the %s scope',
      (scope, installs) => {
        const r = auditDeps([scope]);
        expect(r.code).toBe(0);
        expect(r.calls('install')).toEqual(installs);
        expect(r.calls('audit')).toEqual([`audit --audit-level=high --ignore=${GHSA}`]);
      },
      TIMEOUT
    );

    it(
      'in both scopes of a run with no argument',
      () => {
        const r = auditDeps([]);
        expect(r.code).toBe(0);
        expect(r.calls('audit')).toEqual([
          `audit --audit-level=high --ignore=${GHSA}`,
          `audit --audit-level=high --ignore=${GHSA}`
        ]);
        expect(r.calls('info')).toEqual(['info picomatch dist-tags.latest']);
      },
      TIMEOUT
    );
  });

  it.each(['production', 'all'])(
    'still fails the %s scope on another advisory',
    (scope) => {
      const r = auditDeps([scope], { advisories: [GHSA, OTHER_GHSA] });
      expect(r.code).toBe(1);
      expect(r.out).toContain(`${OTHER_GHSA}: 1 vulnerability (1 high)`);
    },
    TIMEOUT
  );

  it.each([
    ['production', { productionExtra: OTHER_GHSA }],
    ['all', { allExtra: OTHER_GHSA }]
  ])(
    'fails a run with no argument when only the %s scope finds another advisory, after auditing both',
    (_scope, fake) => {
      const r = auditDeps([], fake);
      expect(r.code).toBe(1);
      expect(r.out).toContain(`${OTHER_GHSA}: 1 vulnerability (1 high)`);
      expect(r.calls('audit')).toHaveLength(2);
    },
    TIMEOUT
  );

  it.each(['4.0.7', '4.0.6'])(
    'audits when npm latest picomatch is %s',
    (latest) => {
      const r = auditDeps(['all'], { latest });
      expect(r.code).toBe(0);
      expect(r.calls('audit')).toHaveLength(1);
    },
    TIMEOUT
  );

  it.each([
    ['production', '4.0.8'],
    ['all', '4.0.8'],
    ['all', '5.0.0'],
    ['all', '4.0.8-beta.1']
  ])(
    'fails the %s scope before auditing once npm latest picomatch is %s',
    (scope, latest) => {
      const r = auditDeps([scope], { latest });
      expect(r.code).toBe(1);
      expect(r.err).toContain(
        `npm's latest picomatch is ${latest}, past the 4.0.7 that the ignore of ${GHSA} covers`
      );
      expect(r.err).toContain('« new advisory »');
      expect(r.calls('install')).toEqual([]);
      expect(r.calls('audit')).toEqual([]);
    },
    TIMEOUT
  );

  it(
    'fails a run with no argument once, before either scope, when the ignore has expired',
    () => {
      const r = auditDeps([], { latest: '4.0.8' });
      expect(r.code).toBe(1);
      expect(r.out).toBe('');
      expect(r.calls('info')).toHaveLength(1);
      expect(r.calls('audit')).toEqual([]);
    },
    TIMEOUT
  );

  it(
    'fails when the registry lookup fails, without a retry',
    () => {
      // The stub still prints a covered version, so only the exit status
      // tells the script that the lookup failed.
      const r = auditDeps(['all'], { latest: '4.0.7', infoExit: 1 });
      expect(r.code).toBe(1);
      expect(r.err).toContain('the registry lookup `bun info picomatch dist-tags.latest` failed');
      expect(r.calls('info')).toHaveLength(1);
      expect(r.calls('audit')).toEqual([]);
    },
    TIMEOUT
  );

  it.each([
    ['nothing', ''],
    ['a word', 'garbage'],
    ['two versions', '4.0.7\n4.0.8']
  ])(
    'fails when the registry lookup prints %s',
    (_name, latest) => {
      const r = auditDeps(['all'], { latest });
      expect(r.code).toBe(1);
      expect(r.err).toContain(
        `the registry lookup \`bun info picomatch dist-tags.latest\` printed '${latest}', not a version`
      );
      expect(r.calls('audit')).toEqual([]);
    },
    TIMEOUT
  );

  it.each([
    ['an unknown scope', ['prod']],
    ['an empty scope', ['']],
    ['two arguments', ['production', 'all']]
  ])(
    'exits 2 without a registry lookup on %s',
    (_name, args) => {
      const r = auditDeps(args);
      expect(r.code).toBe(2);
      expect(r.err).toBe('usage: scripts/audit-deps.sh [production|all]\n');
      expect(r.calls('info')).toEqual([]);
    },
    TIMEOUT
  );
});

// scripts/pinned-bun.sh against a fake Bun release served from a directory
// (PINNED_BUN_RELEASES=file://...), so no test touches the network. Each test
// copies the script beside a railpack.json of its own, which pins 1.2.3, and
// unzips into a PINNED_BUN_DIR of its own. The fake bun prints a version.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repo = path.resolve(import.meta.dir, '..');
const VERSION = '1.2.3';
// One zip per host the script knows, so the tests pass on any of them.
const ASSETS = ['bun-linux-x64', 'bun-linux-aarch64', 'bun-darwin-aarch64', 'bun-darwin-x64'];

const base = mkdtempSync(path.join(tmpdir(), 'pinned-bun-'));
// The current test's copy of the repo: base/<test number>.
let dir = '';
let testNumber = 0;
let releases = '';
let cache = '';

afterAll(() => {
  rmSync(base, { recursive: true, force: true });
});

beforeEach(() => {
  testNumber += 1;
  dir = path.join(base, String(testNumber));
  mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  copyFileSync(
    path.join(repo, 'scripts', 'pinned-bun.sh'),
    path.join(dir, 'scripts', 'pinned-bun.sh')
  );
  writeRailpack({ packages: { bun: VERSION } });
  releases = path.join(dir, 'releases');
  cache = path.join(dir, 'cache');
  writeRelease(fakeBun(VERSION));
});

function writeRailpack(json: unknown): void {
  writeFileSync(path.join(dir, 'railpack.json'), `${JSON.stringify(json, null, 2)}\n`);
}

/** A bun that answers `bun --version` with `version`. */
function fakeBun(version: string): string {
  return `#!/bin/sh\necho ${version}\n`;
}

/**
 * Release bun-v<VERSION> as GitHub serves it: one <asset>.zip holding
 * <asset>/bun, and SHASUMS256.txt, whose lines `sums` may rewrite.
 */
function writeRelease(bun: string, sums: (line: string) => string = (line) => line): void {
  const out = path.join(releases, `bun-v${VERSION}`);
  mkdirSync(out, { recursive: true });
  const lines: string[] = [];
  for (const asset of ASSETS) {
    const zip = zipOf(`${asset}/bun`, new TextEncoder().encode(bun));
    writeFileSync(path.join(out, `${asset}.zip`), zip);
    lines.push(sums(`${new Bun.CryptoHasher('sha256').update(zip).digest('hex')}  ${asset}.zip`));
  }
  writeFileSync(path.join(out, 'SHASUMS256.txt'), `${lines.join('\n')}\n`);
}

/** A zip of one stored (uncompressed) executable file, which unzip unpacks with its mode. */
function zipOf(name: string, data: Uint8Array): Uint8Array {
  const nameBytes = new TextEncoder().encode(name);
  const crc = Bun.hash.crc32(data);
  const local = new DataView(new ArrayBuffer(30));
  local.setUint32(0, 0x04034b50, true);
  local.setUint16(4, 10, true); // version needed to extract
  local.setUint16(12, 0x21, true); // 1980-01-01
  local.setUint32(14, crc, true);
  local.setUint32(18, data.length, true);
  local.setUint32(22, data.length, true);
  local.setUint16(26, nameBytes.length, true);
  const central = new DataView(new ArrayBuffer(46));
  central.setUint32(0, 0x02014b50, true);
  central.setUint16(4, (3 << 8) | 20, true); // made by Unix, so the mode below counts
  central.setUint16(6, 10, true);
  central.setUint16(14, 0x21, true);
  central.setUint32(16, crc, true);
  central.setUint32(20, data.length, true);
  central.setUint32(24, data.length, true);
  central.setUint16(28, nameBytes.length, true);
  central.setUint32(38, (0o100755 << 16) >>> 0, true); // a regular file, rwxr-xr-x
  const centralAt = 30 + nameBytes.length + data.length;
  const centralSize = 46 + nameBytes.length;
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, 1, true);
  end.setUint16(10, 1, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, centralAt, true);
  const parts = [local, nameBytes, data, central, nameBytes, end].map((part) =>
    part instanceof DataView ? new Uint8Array(part.buffer) : part
  );
  const zip = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let at = 0;
  for (const part of parts) {
    zip.set(part, at);
    at += part.length;
  }
  return zip;
}

function run(args: string[], env: Record<string, string> = {}) {
  const p = Bun.spawnSync([path.join(dir, 'scripts', 'pinned-bun.sh'), ...args], {
    env: {
      ...process.env,
      PINNED_BUN_RELEASES: `file://${releases}`,
      PINNED_BUN_DIR: cache,
      ...env
    }
  });
  return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
}

describe('pinned-bun.sh', () => {
  it('runs the command with the pinned Bun first on PATH', () => {
    const { code, out, err } = run(['bun', '--version']);
    expect(err).toContain(`downloading Bun ${VERSION}`);
    expect(code).toBe(0);
    expect(out).toBe(`${VERSION}\n`);
  });

  it('reuses the Bun it unzipped instead of downloading it again', () => {
    expect(run(['true']).code).toBe(0);
    rmSync(releases, { recursive: true });

    const { code, out, err } = run(['bun', '--version']);
    expect(code).toBe(0);
    expect(out).toBe(`${VERSION}\n`);
    expect(err).not.toContain('downloading');
  });

  it("exits with the command's own code", () => {
    expect(run(['sh', '-c', 'exit 7']).code).toBe(7);
  });

  it('fails without a command', () => {
    const { code, err } = run([]);
    expect(code).toBe(2);
    expect(err).toContain('usage: scripts/pinned-bun.sh <command>');
  });

  it('refuses a zip that does not match SHASUMS256.txt, and keeps nothing', () => {
    writeRelease(fakeBun(VERSION), (line) => line.replace(/^[0-9a-f]{64}/, '0'.repeat(64)));

    const { code, err } = run(['true']);
    expect(code).toBe(2);
    expect(err).toContain('does not match its SHASUMS256.txt line');
    expect(existsSync(path.join(cache, VERSION))).toBe(false);
  });

  it('fails when the release cannot be downloaded', () => {
    const { code, err } = run(['true'], {
      PINNED_BUN_RELEASES: `file://${path.join(dir, 'missing')}`
    });
    expect(code).toBe(2);
    expect(err).toContain('the download from');
  });

  it.each([
    ['no packages.bun', { packages: {} }],
    ['a version that is not x.y.z', { packages: { bun: 'latest' } }]
  ])('refuses a railpack.json with %s', (_, json) => {
    writeRailpack(json);
    const { code, err } = run(['true']);
    expect(code).toBe(2);
    expect(err).toContain('railpack.json holds no x.y.z packages.bun');
  });

  it('refuses an unzipped bun that reports another version', () => {
    writeRelease(fakeBun('9.9.9'));
    const { code, err } = run(['true']);
    expect(code).toBe(2);
    expect(err).toContain(`reports '9.9.9', not ${VERSION}`);
  });
});

// scripts/pinned-bun.sh against a fake Bun release served from a directory
// (PINNED_BUN_RELEASES=file://...), so no test touches the network. Each test
// copies the script beside a railpack.json of its own, which pins 1.2.3, and
// unzips into a PINNED_BUN_DIR of its own. The fake bun prints a version.
import { afterAll, beforeEach, describe, expect, it } from 'bun:test';
import {
  chmodSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repo = path.resolve(import.meta.dir, '..');
const VERSION = '1.2.3';
const ASSET = 'bun-linux-x64';

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
  writeRelease(zipOf(`${ASSET}/bun`, fakeBun(VERSION)));
});

function writeRailpack(json: unknown): void {
  writeFileSync(path.join(dir, 'railpack.json'), `${JSON.stringify(json, null, 2)}\n`);
}

/** A bun that answers `bun --version` with `version`. */
function fakeBun(version: string): string {
  return `#!/bin/sh\necho ${version}\n`;
}

/**
 * Release bun-v<VERSION> as GitHub serves it: <ASSET>.zip, and the
 * SHASUMS256.txt line for it, which `sums` may rewrite.
 */
function writeRelease(zip: Uint8Array, sums: (line: string) => string = (line) => line): void {
  const out = path.join(releases, `bun-v${VERSION}`);
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, `${ASSET}.zip`), zip);
  const sum = new Bun.CryptoHasher('sha256').update(zip).digest('hex');
  writeFileSync(path.join(out, 'SHASUMS256.txt'), `${sums(`${sum}  ${ASSET}.zip`)}\n`);
}

/** A zip of one stored (uncompressed) executable file, which unzip unpacks with its mode. */
function zipOf(name: string, text: string): Uint8Array {
  const data = new TextEncoder().encode(text);
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

function env(extra: Record<string, string> = {}): Record<string, string> {
  return {
    ...(process.env as Record<string, string>),
    PINNED_BUN_RELEASES: `file://${releases}`,
    PINNED_BUN_DIR: cache,
    ...extra
  };
}

function run(args: string[], extra: Record<string, string> = {}) {
  const p = Bun.spawnSync([path.join(dir, 'scripts', 'pinned-bun.sh'), ...args], {
    env: env(extra)
  });
  return { code: p.exitCode, out: p.stdout.toString(), err: p.stderr.toString() };
}

function failsWith(message: string, args: string[] = ['true'], extra = {}): void {
  const { code, err } = run(args, extra);
  expect(err).toContain(message);
  expect(code).toBe(2);
}

describe('pinned-bun.sh', () => {
  it('runs the command with the pinned Bun first on PATH', () => {
    const { code, out, err } = run(['bun', '--version']);
    expect(err).toContain(`downloading Bun ${VERSION}`);
    expect(code).toBe(0);
    expect(out).toBe(`${VERSION}\n`);
    // Nothing left of the download but the install and its lock.
    expect(readdirSync(cache).sort()).toEqual([VERSION, `${VERSION}.lock`]);
  });

  it('reuses the Bun it unzipped instead of downloading it again', () => {
    expect(run(['true']).code).toBe(0);
    rmSync(releases, { recursive: true });

    const { code, out, err } = run(['bun', '--version']);
    expect(code).toBe(0);
    expect(out).toBe(`${VERSION}\n`);
    expect(err).not.toContain('downloading');
  });

  it('waits for a run that is installing the same version, then reuses its install', async () => {
    rmSync(releases, { recursive: true });
    mkdirSync(cache);
    const installed = path.join(cache, VERSION, ASSET);
    // Another run: it takes the lock, says so, and installs only once the
    // test writes a line to it, after the script has said it waits.
    const other = Bun.spawn(
      [
        'flock',
        path.join(cache, `${VERSION}.lock`),
        'sh',
        '-c',
        `echo locked; read go; mkdir -p ${installed}; printf '${fakeBun(VERSION)}' > ${installed}/bun; chmod +x ${installed}/bun`
      ],
      { stdin: 'pipe', stdout: 'pipe' }
    );
    const locked = await other.stdout.getReader().read();
    expect(new TextDecoder().decode(locked.value)).toBe('locked\n');
    // The script starts once the other run holds the lock.
    const script = Bun.spawn([path.join(dir, 'scripts', 'pinned-bun.sh'), 'bun', '--version'], {
      env: env(),
      stdout: 'pipe',
      stderr: 'pipe'
    });
    try {
      let err = '';
      const stderr = script.stderr.getReader();
      const waits = (async () => {
        while (!err.includes('waiting for another run')) {
          const { done, value } = await stderr.read();
          if (done) return false;
          err += new TextDecoder().decode(value);
        }
        return true;
      })();
      expect(await Promise.race([waits, Bun.sleep(3000).then(() => false)])).toBe(true);

      other.stdin.write('go\n');
      await other.stdin.end();
      expect(await script.exited).toBe(0);
      for (let chunk = await stderr.read(); !chunk.done; chunk = await stderr.read()) {
        err += new TextDecoder().decode(chunk.value);
      }
      expect(err).not.toContain('downloading');
      expect(await new Response(script.stdout).text()).toBe(`${VERSION}\n`);
      expect(await other.exited).toBe(0);
    } finally {
      other.kill();
      script.kill();
    }
  });

  it('installs over an install directory left without its bun', () => {
    mkdirSync(path.join(cache, VERSION, ASSET), { recursive: true });
    const { code, out } = run(['bun', '--version']);
    expect(code).toBe(0);
    expect(out).toBe(`${VERSION}\n`);
  });

  it("exits with the command's own code", () => {
    expect(run(['sh', '-c', 'exit 7']).code).toBe(7);
  });

  it('fails without a command', () => {
    failsWith('usage: scripts/pinned-bun.sh <command>', []);
  });

  it.each([
    ['no packages.bun', { packages: {} }],
    ['a version that is not x.y.z', { packages: { bun: 'latest' } }]
  ])('refuses a railpack.json with %s', (_, json) => {
    writeRailpack(json);
    failsWith('railpack.json holds no x.y.z packages.bun');
  });

  it('refuses another system than x86_64 Linux', () => {
    const bin = path.join(dir, 'bin');
    mkdirSync(bin);
    writeFileSync(
      path.join(bin, 'uname'),
      '#!/bin/sh\ncase "$1" in -s) echo Darwin ;; -m) echo arm64 ;; esac\n'
    );
    chmodSync(path.join(bin, 'uname'), 0o755);
    failsWith('runs on x86_64 Linux only', ['true'], { PATH: `${bin}:${process.env.PATH}` });
  });

  it('fails when the release cannot be downloaded', () => {
    failsWith('the download from', ['true'], {
      PINNED_BUN_RELEASES: `file://${path.join(dir, 'missing')}`
    });
  });

  it('refuses a zip that does not match SHASUMS256.txt, and keeps nothing', () => {
    writeRelease(zipOf(`${ASSET}/bun`, fakeBun(VERSION)), (line) =>
      line.replace(/^[0-9a-f]{64}/, '0'.repeat(64))
    );
    failsWith('does not match its SHASUMS256.txt line');
    expect(readdirSync(cache)).toEqual([`${VERSION}.lock`]);
  });

  it('fails on a zip that does not unzip', () => {
    writeRelease(new TextEncoder().encode('not a zip'));
    failsWith(`could not unzip ${ASSET}.zip`);
  });

  it('fails when it cannot write the install', () => {
    mkdirSync(cache);
    writeFileSync(path.join(cache, VERSION), 'a file where the version directory goes');
    failsWith(`could not move Bun ${VERSION}`);
  });

  it('refuses a downloaded bun that reports another version', () => {
    writeRelease(zipOf(`${ASSET}/bun`, fakeBun('9.9.9')));
    failsWith(`reports '9.9.9', not ${VERSION}`);
  });

  it('refuses a cached bun that reports another version', () => {
    expect(run(['true']).code).toBe(0);
    writeFileSync(path.join(cache, VERSION, ASSET, 'bun'), fakeBun('9.9.9'));
    failsWith(`reports '9.9.9', not ${VERSION}`);
  });
});

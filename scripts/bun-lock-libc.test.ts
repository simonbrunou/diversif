import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import {
  assertLockKeepsLibc,
  installDir,
  readInstalledManifest,
  type ReadManifest
} from './bun-lock-libc.ts';

const ROOT = join(import.meta.dir, '..');

const entry = (meta: Record<string, unknown>) => ['pkg@1.0.0', '', meta, 'sha512-x'];
const manifests =
  (byKey: Record<string, { libc?: unknown }>): ReadManifest =>
  (key) =>
    byKey[key];

describe('bun.lock', () => {
  test('keeps the libc field of every installed package that declares one', async () => {
    const lock = Bun.JSONC.parse(await Bun.file(join(ROOT, 'bun.lock')).text()) as {
      packages: Record<string, unknown>;
    };
    expect(() => assertLockKeepsLibc(lock.packages, readInstalledManifest(ROOT))).not.toThrow();
  });
});

describe('assertLockKeepsLibc', () => {
  test('passes when bun.lock writes a one-value libc list as the bare string', () => {
    const read = manifests({ a: { libc: ['glibc'] }, b: {} });
    expect(() =>
      assertLockKeepsLibc({ a: entry({ libc: 'glibc' }), b: entry({}), c: entry({}) }, read)
    ).not.toThrow();
  });

  test('fails when bun.lock lost the libc of an installed package', () => {
    const read = manifests({ a: { libc: ['glibc'] } });
    expect(() => assertLockKeepsLibc({ a: entry({ os: 'linux' }) }, read)).toThrow(
      'a: package.json ["glibc"], bun.lock undefined'
    );
  });

  test('fails when bun.lock holds another libc than the installed package', () => {
    const read = manifests({ a: { libc: ['glibc'] } });
    expect(() => assertLockKeepsLibc({ a: entry({ libc: 'musl' }) }, read)).toThrow(
      'a: package.json ["glibc"], bun.lock "musl"'
    );
  });

  test('fails on an entry of a form it does not read', () => {
    const read = manifests({ a: { libc: ['glibc'] } });
    expect(() =>
      assertLockKeepsLibc({ a: entry({ libc: 'glibc' }), b: ['pkg@1.0.0', '', {}] }, read)
    ).toThrow('bun.lock entry b has the form [string,string,object]');
    expect(() => assertLockKeepsLibc({ c: 'pkg@1.0.0' }, read)).toThrow(
      'bun.lock entry c has the form [string]'
    );
  });

  test('fails when no installed package declares libc', () => {
    const read = manifests({ a: {} });
    expect(() => assertLockKeepsLibc({ a: entry({}), b: entry({}) }, read)).toThrow(
      'no installed package declares libc'
    );
  });
});

describe('installDir', () => {
  test('nests each key segment under node_modules, keeping scopes whole', () => {
    expect(installDir('/r', 'knip/oxc-parser')).toBe(
      '/r/node_modules/knip/node_modules/oxc-parser'
    );
    expect(
      installDir('/r', '@sentry/bundler-plugins/oxc-parser/@oxc-parser/binding-linux-x64-gnu')
    ).toBe(
      '/r/node_modules/@sentry/bundler-plugins/node_modules/oxc-parser/node_modules/@oxc-parser/binding-linux-x64-gnu'
    );
  });

  test('reads no manifest for a package that is not installed', () => {
    expect(readInstalledManifest('/nonexistent')('vite')).toBeUndefined();
  });
});

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// The dev shell's Bun 1.4.2 drops the `libc` field from native packages'
// bun.lock entries, and the pinned Bun 1.4.4 keeps such a lockfile as it is:
// `bun install --frozen-lockfile` and `--lockfile-only` both pass it (#658,
// #476). Bun then installs the musl bindings next to the glibc ones. So every
// installed package that declares `libc` in its package.json must carry the
// same `libc` in its bun.lock entry. Write bun.lock with
// `scripts/pinned-bun.sh bun install` (docs/agents/testing.md).

/** Reads an installed package's package.json by its bun.lock key, or undefined when not installed. */
export type ReadManifest = (key: string) => { libc?: unknown } | undefined;

/** node_modules path of a bun.lock key such as `knip/oxc-parser` or `@a/b/@c/d`. */
export function installDir(root: string, key: string): string {
  const parts = key.split('/');
  const names: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    names.push(parts[i].startsWith('@') ? `${parts[i]}/${parts[++i]}` : parts[i]);
  }
  return join(root, ...names.flatMap((name) => ['node_modules', name]));
}

export function readInstalledManifest(root: string): ReadManifest {
  return (key) => {
    const manifest = join(installDir(root, key), 'package.json');
    return existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')) : undefined;
  };
}

/**
 * Throws when an installed package's `libc` differs from its bun.lock entry's,
 * when an entry has a form this check does not read, or when no installed
 * package declares `libc`, which would leave the check vacuous.
 */
export function assertLockKeepsLibc(packages: Record<string, unknown>, read: ReadManifest): void {
  const mismatches: string[] = [];
  let checked = 0;
  for (const [key, value] of Object.entries(packages)) {
    const shape = Array.isArray(value) ? value.map((x) => typeof x).join(',') : typeof value;
    if (shape !== 'string,string,object,string') {
      throw new Error(
        `bun.lock entry ${key} has the form [${shape}], which this check does not read`
      );
    }
    const declared = read(key)?.libc;
    if (declared === undefined) continue;
    checked++;
    // bun.lock writes a one-value list as the bare string ("glibc" for ["glibc"]).
    const locked = ((value as unknown[])[2] as { libc?: unknown }).libc;
    if (JSON.stringify([locked].flat()) !== JSON.stringify([declared].flat())) {
      mismatches.push(
        `${key}: package.json ${JSON.stringify(declared)}, bun.lock ${JSON.stringify(locked)}`
      );
    }
  }
  if (mismatches.length > 0) {
    throw new Error(
      `bun.lock lost or changed libc; rewrite it with scripts/pinned-bun.sh bun install:\n${mismatches.join('\n')}`
    );
  }
  if (checked === 0)
    throw new Error('no installed package declares libc, so the check read nothing');
}

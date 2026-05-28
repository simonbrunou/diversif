#!/usr/bin/env bun
// Per-file bun test runner. bun:test's mock.module is process-global with
// no per-file isolation, so files that mock $app/state, $lib/paraglide/runtime,
// $lib/server/db, etc. leak their overrides into every subsequent file in
// the same process. Vitest got per-file isolation for free. We get it by
// spawning a fresh bun process per file.
//
// Cost: ~1.5s startup × ~180 files = ~5 minutes (vs ~40s for in-process).
// Trade-off worth it: 99% pass rate per-file vs ~85% combined.
//
// Usage:
//   bun scripts/bun-test.ts                    # run all *.test.ts under src/
//   bun scripts/bun-test.ts --coverage         # forwarded to bun test
//   bun scripts/bun-test.ts src/lib/utils       # subset path

import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';

function collectFiles(roots: string[]): string[] {
  const files: string[] = [];
  function walk(p: string): void {
    const stat = statSync(p);
    if (stat.isDirectory()) {
      for (const entry of readdirSync(p)) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        walk(path.join(p, entry));
      }
    } else if (/\.(test|spec)\.[jt]sx?$/.test(p)) {
      files.push(p);
    }
  }
  for (const root of roots) walk(root);
  return files.sort();
}

const args = process.argv.slice(2);
const passthroughFlags = args.filter((a) => a.startsWith('--') || a.startsWith('-'));
const paths = args.filter((a) => !a.startsWith('-'));
const roots = paths.length > 0 ? paths : ['src'];

const files = collectFiles(roots);
if (files.length === 0) {
  console.error(`No test files found under ${roots.join(', ')}`);
  process.exit(1);
}

console.log(`Running ${files.length} test files (isolated processes)...\n`);

let totalPass = 0;
let totalFail = 0;
let totalSkip = 0;
const failedFiles: string[] = [];
const startWall = Date.now();

for (let i = 0; i < files.length; i++) {
  const f = files[i];
  const proc = Bun.spawnSync({
    cmd: ['bun', '--conditions=browser', 'test', '--timeout=5000', ...passthroughFlags, f],
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe'
  });
  // bun:test writes to stderr; both streams may contain output.
  const out = `${proc.stdout?.toString() ?? ''}${proc.stderr?.toString() ?? ''}`;
  const passMatch = out.match(/(\d+) pass/);
  const failMatch = out.match(/(\d+) fail/);
  const skipMatch = out.match(/(\d+) skip/);
  const pass = passMatch ? Number(passMatch[1]) : 0;
  const fail = failMatch ? Number(failMatch[1]) : 0;
  const skip = skipMatch ? Number(skipMatch[1]) : 0;
  totalPass += pass;
  totalFail += fail;
  totalSkip += skip;
  // Trust the fail counter over proc.exitCode — bun test sometimes exits
  // non-zero on warnings (e.g. svelte derived_inert) even when every test
  // passed.
  const status = fail > 0 ? 'FAIL' : 'pass';
  const counts = [pass && `${pass}p`, fail && `${fail}f`, skip && `${skip}s`]
    .filter(Boolean)
    .join(' ');
  console.log(`[${i + 1}/${files.length}] ${status.padEnd(4)} ${counts.padEnd(15)} ${f}`);
  if (fail > 0) {
    failedFiles.push(f);
    // Emit the file's output so failure details aren't lost.
    process.stderr.write(out);
  }
}

const elapsedSec = ((Date.now() - startWall) / 1000).toFixed(1);
console.log(
  `\n${files.length} files | ${totalPass} pass | ${totalFail} fail | ${totalSkip} skip | ${elapsedSec}s`
);

if (failedFiles.length > 0) {
  console.log(`\nFailed files:`);
  for (const f of failedFiles) console.log(`  ${f}`);
  process.exit(1);
}

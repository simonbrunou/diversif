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
  // Anchor the counters to bun's summary lines (" 10 pass", " 0 fail"), not
  // loose substrings. A bare /(\d+) fail/ also matches prose inside a printed
  // test name — e.g. forms.test.ts's "returns ok:false with a 400 failure …"
  // yields a phantom "400 fail" — but only when bun emits per-test (pass)
  // lines (it does in CI), which is why this slipped through locally. The
  // leading `^\s*` + trailing `\b` pin the match to the real summary row.
  const passMatch = out.match(/^\s*(\d+) pass\b/m);
  const failMatch = out.match(/^\s*(\d+) fail\b/m);
  const skipMatch = out.match(/^\s*(\d+) skip\b/m);
  // Guard against bun changing its output format: if none of the counters
  // match, we have no signal at all — treat the file as a failure rather
  // than silently summing 0+0+0 and claiming green.
  const parsedNothing = passMatch == null && failMatch == null && skipMatch == null;
  const pass = passMatch ? Number(passMatch[1]) : 0;
  const fail = failMatch ? Number(failMatch[1]) : 0;
  const skip = skipMatch ? Number(skipMatch[1]) : 0;
  // Secondary signal: non-zero exit with zero parsed counts almost always
  // means the runner itself blew up (loader error, segfault, etc).
  const exitCode = proc.exitCode ?? 0;
  const runnerCrashed = exitCode !== 0 && pass === 0 && fail === 0 && skip === 0;
  const runnerBroken = parsedNothing || runnerCrashed;
  totalPass += pass;
  totalFail += fail;
  totalSkip += skip;
  // Trust the fail counter over proc.exitCode — bun test sometimes exits
  // non-zero on warnings (e.g. svelte derived_inert) even when every test
  // passed. But if we couldn't parse anything, fall back to failing loud.
  const status = fail > 0 || runnerBroken ? 'FAIL' : 'pass';
  const counts = [pass && `${pass}p`, fail && `${fail}f`, skip && `${skip}s`]
    .filter(Boolean)
    .join(' ');
  console.log(`[${i + 1}/${files.length}] ${status.padEnd(4)} ${counts.padEnd(15)} ${f}`);
  if (fail > 0 || runnerBroken) {
    failedFiles.push(f);
    if (runnerBroken) {
      const reason = parsedNothing
        ? "runner: couldn't parse bun test output"
        : `runner: bun exited ${exitCode} with no parsed counts`;
      process.stderr.write(`!! ${f}: ${reason}\n`);
    }
    // Emit the file's output so failure details aren't lost.
    process.stderr.write(out);
  }
}

const elapsedSec = ((Date.now() - startWall) / 1000).toFixed(1);
console.log(
  `\n${files.length} files | ${totalPass} pass | ${totalFail} fail | ${totalSkip} skip | ${elapsedSec}s`
);

// Whole-run sanity check: if we walked the tree and found test files but
// parsed zero of every counter, the regex contract with bun is broken.
// Don't let that masquerade as a clean run.
if (totalPass + totalFail + totalSkip === 0) {
  console.error(
    `\n!! Runner self-check failed: found ${files.length} test file(s) but parsed 0p/0f/0s overall.\n!! The bun test output format may have changed — counter regexes need updating.`
  );
  process.exit(2);
}

if (failedFiles.length > 0) {
  console.log(`\nFailed files:`);
  for (const f of failedFiles) console.log(`  ${f}`);
  process.exit(1);
}

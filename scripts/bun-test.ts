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

import { existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import bunfig from '../bunfig.toml';

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
// Coverage is handled by this runner, not forwarded blindly: each child only
// sees the modules its one test file imports, so global thresholds can only
// be enforced by merging the children's lcov output here. (bun 1.3.14 also
// never enforces bunfig coverageThreshold, and silently drops the CLI
// --coverage flag when bunfig says `coverage = false` — two more reasons the
// old "forward --coverage" approach enforced nothing.)
const wantCoverage = args.includes('--coverage');
// Re-runs only the merge/enforcement step against the lcov output a previous
// `--coverage` run left in coverage/raw — for iterating on gate logic without
// re-running the whole suite.
const reportOnly = args.includes('--coverage-report-only');
const passthroughFlags = args.filter(
  (a) => (a.startsWith('--') || a.startsWith('-')) && !a.startsWith('--coverage')
);
const paths = args.filter((a) => !a.startsWith('-'));
const roots = paths.length > 0 ? paths : ['src'];

const covRoot = path.join(process.cwd(), 'coverage', 'raw');
if (wantCoverage && !reportOnly) rmSync(covRoot, { recursive: true, force: true });

const files = collectFiles(roots);
if (files.length === 0) {
  console.error(`No test files found under ${roots.join(', ')}`);
  process.exit(1);
}

if (!reportOnly) console.log(`Running ${files.length} test files (isolated processes)...\n`);

let totalPass = 0;
let totalFail = 0;
let totalSkip = 0;
const failedFiles: string[] = [];
const startWall = Date.now();

for (let i = 0; !reportOnly && i < files.length; i++) {
  const f = files[i];
  const coverageFlags = wantCoverage
    ? ['--coverage', '--coverage-reporter=lcov', `--coverage-dir=${path.join(covRoot, String(i))}`]
    : [];
  const proc = Bun.spawnSync({
    cmd: [
      'bun',
      '--conditions=browser',
      'test',
      '--timeout=5000',
      ...coverageFlags,
      ...passthroughFlags,
      f
    ],
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

if (!reportOnly) {
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
}

// ---------------------------------------------------------------------------
// Coverage aggregation + enforcement.
//
// Each child process only loads the modules its one test file imports, so a
// global 100% gate must merge the per-child lcov reports: a line counts as
// covered if ANY child hit it. bun's lcov has no per-function FNDA records,
// so only LINE coverage can be merged across processes — function thresholds
// are unenforceable in this architecture and line coverage is the gate.
// Known false-negative class (bun/V8 data limitation, not fixable here):
// a one-line function definition registers as a covered line at module
// evaluation even if never called, and never-taken branches INSIDE an
// executed function can receive phantom nonzero hits (probe: an untaken
// `if (x<0) { break; }` guard in a loop reported hits on both lines).
// "100% line coverage" therefore does not mean "all branches reached" —
// it catches dead multi-line functions and unloaded modules, not every
// untested branch.
//
// `/* v8 ignore … */` markers (inherited from the vitest era) are honored
// here: `next [N]` (standalone markers also exempt the N following lines;
// markers inline after code exempt only their own line), and
// `start`/`stop` ranges (an unterminated `start` fails the run loudly —
// it would otherwise silently exempt the rest of the file).
// ---------------------------------------------------------------------------

function parseIgnoredLines(file: string, source: string): Set<number> {
  const ignored = new Set<number>();
  const lines = source.split('\n');
  let inBlock = false;
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (inBlock) ignored.add(li + 1);
    if (/v8 ignore start/.test(line)) {
      inBlock = true;
      ignored.add(li + 1);
    } else if (/v8 ignore stop/.test(line)) {
      inBlock = false;
      ignored.add(li + 1);
    } else {
      const next = line.match(/v8 ignore next(?:\s+(\d+))?/);
      if (next) {
        ignored.add(li + 1);
        // A marker inline after code (`x ?? /* v8 ignore next */ 0`) exempts
        // only its own line; a standalone marker line exempts the N
        // following lines. Without the distinction, an inline marker would
        // silently exempt the (unmarked) line after it too. Anchor on the
        // MARKER'S comment opener, not the first '/*' on the line — an
        // unrelated leading block comment must not promote an inline marker
        // to standalone.
        const standalone = line.slice(0, line.search(/\/\*+\s*v8 ignore next/)).trim() === '';
        if (standalone) {
          const span = next[1] ? Number(next[1]) : 1;
          for (let k = 1; k <= span; k++) ignored.add(li + 1 + k);
        }
      }
    }
  }
  if (inBlock) {
    console.error(
      `!! ${file}: '/* v8 ignore start */' without a matching stop — ` +
        `this would silently exempt the rest of the file.`
    );
    process.exit(2);
  }
  return ignored;
}

// bun 1.3.14's lcov emits spurious 0-hit DA records for lines that cannot
// execute — blank lines, comment-only lines, lone braces/parens of multiline
// statements. Treat those as non-executable instead of uncovered. (Verified
// against e.g. guards.ts where the only "uncovered" lines were a comment.)
// Lone `break;`/`continue;` lines are also excluded: V8 attributes the
// branch's execution to the surrounding block lines and reports the jump
// statement itself as 0-hit even when it demonstrably runs (probe: a
// `} else if (…) { break; }` taken 3× reported DA:<break-line>,0 while the
// closing brace line got the 3 hits).
function isNonExecutable(sourceLine: string): boolean {
  const t = sourceLine.trim();
  return (
    t === '' ||
    t.startsWith('//') ||
    t.startsWith('/*') ||
    t.startsWith('*') ||
    /^[)\]}>,;]*$/.test(t) ||
    /^(break|continue);$/.test(t)
  );
}

function compactRanges(nums: number[]): string {
  const sorted = [...nums].sort((a, b) => a - b);
  const parts: string[] = [];
  for (let s = 0; s < sorted.length; ) {
    let e = s;
    while (e + 1 < sorted.length && sorted[e + 1] === sorted[e] + 1) e++;
    parts.push(s === e ? `${sorted[s]}` : `${sorted[s]}-${sorted[e]}`);
    s = e + 1;
  }
  return parts.join(',');
}

if (wantCoverage || reportOnly) {
  if (reportOnly && paths.length > 0) {
    // The raw dirs are keyed by index into the FULL run's file list; a
    // path-filtered replay would misalign indices and merge garbage.
    console.error('!! --coverage-report-only cannot be combined with path arguments.');
    process.exit(2);
  }
  const manifestPath = path.join(covRoot, 'manifest.json');
  if (reportOnly) {
    const recorded = existsSync(manifestPath)
      ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as string[])
      : null;
    if (!recorded || JSON.stringify(recorded) !== JSON.stringify(files)) {
      console.error(
        '!! coverage/raw was produced for a different file list (older commit or subset run) — ' +
          're-run `bun run test:coverage` before replaying.'
      );
      process.exit(2);
    }
  } else {
    // Awaited: an unawaited write followed by an early process.exit (e.g.
    // the bunfig assert below) never lands on disk.
    await Bun.write(manifestPath, JSON.stringify(files));
  }
  // Belt-and-braces: the TOML import is untyped (`any`), so a renamed key
  // would silently yield an empty ignore list.
  const patterns = bunfig.test?.coveragePathIgnorePatterns;
  if (!Array.isArray(patterns) || patterns.length === 0) {
    console.error('!! bunfig.toml [test].coveragePathIgnorePatterns missing or empty.');
    process.exit(2);
  }
  const ignoreGlobs = patterns.map((p: string) => new Bun.Glob(p));
  const isIgnored = (rel: string): boolean => ignoreGlobs.some((g) => g.match(rel));

  // Merge DA records: file -> line -> { max hit count, children reporting
  // the line } across all children, plus how many children reported the file
  // at all. The per-line report count matters because bun/V8 children
  // DISAGREE about which lines are executable: a child that loads a module
  // without executing some function lumps the whole unexecuted function
  // range into 0-hit DA records — including template-literal string content
  // and TypeScript type-annotation lines — while a child that DID execute
  // the function omits exactly those lines as non-executable. (Verified on
  // queries/diversity.ts: the queries.test.ts child emits no DA records for
  // the sql`…` string-interior lines, while children that import the module
  // without running loadDiversityMetrics emit DA:<line>,0 for them.) A line
  // omitted by any child that reported the file is therefore V8 lumping,
  // not real executable source, and is excluded from the gate. Genuinely
  // uncovered executable lines are reported (as 0) by every child.
  const fileCov = new Map<
    string,
    { reports: number; lines: Map<number, { max: number; seen: number }> }
  >();
  for (let i = 0; i < files.length; i++) {
    const lcovPath = path.join(covRoot, String(i), 'lcov.info');
    if (!existsSync(lcovPath)) continue;
    // A block only counts once its end_of_record is seen: a truncated write
    // (crash/disk-full after a green test run) must not register as a
    // "report" — the disagreement rule would otherwise exempt every real
    // 0-hit line in files the truncated child loaded.
    let currentRel: string | null = null;
    let pending: Map<number, number> | null = null;
    for (const line of readFileSync(lcovPath, 'utf8').split('\n')) {
      if (line.startsWith('SF:')) {
        let rel = line.slice(3);
        if (path.isAbsolute(rel)) rel = path.relative(process.cwd(), rel);
        const wanted = rel.startsWith('src/') && !isIgnored(rel);
        currentRel = wanted ? rel : null;
        pending = wanted ? new Map() : null;
      } else if (pending && line.startsWith('DA:')) {
        const [lineNo, count] = line.slice(3).split(',').map(Number);
        pending.set(lineNo, Math.max(pending.get(lineNo) ?? 0, count));
      } else if (line === 'end_of_record' && currentRel && pending) {
        const entry = fileCov.get(currentRel) ?? { reports: 0, lines: new Map() };
        entry.reports += 1;
        for (const [lineNo, count] of pending) {
          const rec = entry.lines.get(lineNo) ?? { max: 0, seen: 0 };
          rec.max = Math.max(rec.max, count);
          rec.seen += 1;
          entry.lines.set(lineNo, rec);
        }
        fileCov.set(currentRel, entry);
        currentRel = null;
        pending = null;
      }
    }
  }

  // Source files no child ever loaded are 0% covered — without this check a
  // file nothing imports would silently pass the gate. Only meaningful when
  // the whole suite ran (a subset run legitimately loads a subset of src/).
  const fullRun = paths.length === 0;
  const neverLoaded: string[] = [];
  if (fullRun)
    (function walkSrc(p: string): void {
      for (const entry of readdirSync(p)) {
        if (entry === 'node_modules' || entry.startsWith('.')) continue;
        const full = path.join(p, entry);
        if (statSync(full).isDirectory()) {
          walkSrc(full);
          continue;
        }
        if (!/\.(ts|svelte)$/.test(entry) || /\.(test|spec|d)\.ts$/.test(entry)) continue;
        const rel = path.relative(process.cwd(), full);
        if (!isIgnored(rel) && !fileCov.has(rel)) neverLoaded.push(rel);
      }
    })('src');

  let totalLines = 0;
  let coveredLines = 0;
  const offenders: { file: string; lines: number[] }[] = [];
  for (const [file, { reports, lines: lineMap }] of [...fileCov.entries()].sort()) {
    // Disputed lines — reported by some children but omitted by at least one
    // child that loaded the file — are V8's unexecuted-function lumping (see
    // the merge comment above), not real executable source. Hit lines stay
    // in regardless: a hit proves the line executes.
    const undisputed = [...lineMap.entries()].filter(([, r]) => r.max > 0 || r.seen === reports);
    const zero = undisputed.filter(([, r]) => r.max === 0).map(([l]) => l);
    let ignoredLines = new Set<number>();
    let sourceLines: string[] = [];
    if (zero.length > 0) {
      const source = readFileSync(file, 'utf8');
      ignoredLines = parseIgnoredLines(file, source);
      sourceLines = source.split('\n');
    }
    // A 0-hit line only counts as uncovered (or counts at all) when it's
    // real executable source: not v8-ignored, not a comment/blank artifact.
    const phantom = (l: number): boolean =>
      ignoredLines.has(l) || isNonExecutable(sourceLines[l - 1] ?? '');
    const uncovered = zero.filter((l) => !phantom(l));
    const counted = undisputed.filter(([l, r]) => r.max > 0 || !phantom(l));
    totalLines += counted.length;
    coveredLines += counted.length - uncovered.length;
    if (uncovered.length > 0) offenders.push({ file, lines: uncovered });
  }

  const pct = totalLines === 0 ? 100 : (coveredLines / totalLines) * 100;
  console.log(
    `\nCoverage (merged lines across ${files.length} isolated runs): ` +
      `${coveredLines}/${totalLines} lines — ${pct.toFixed(2)}%`
  );
  if (offenders.length > 0) {
    console.error(`\n!! Uncovered lines in ${offenders.length} file(s):`);
    for (const o of offenders) console.error(`  ${o.file}: ${compactRanges(o.lines)}`);
  }
  if (neverLoaded.length > 0) {
    console.error(`\n!! Source files never loaded by any test (0% coverage):`);
    for (const f of neverLoaded.sort()) console.error(`  ${f}`);
  }
  if (offenders.length > 0 || neverLoaded.length > 0) {
    console.error(
      `\n!! Coverage gate failed: 100% line coverage required ` +
        `(use /* v8 ignore next [N] */ or /* v8 ignore start|stop */ with a justification, ` +
        `or extend coveragePathIgnorePatterns in bunfig.toml).`
    );
    process.exit(1);
  }
  console.log('Coverage gate: 100% of non-ignored lines covered.');
}

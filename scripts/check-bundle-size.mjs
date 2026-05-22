#!/usr/bin/env node
/**
 * check-bundle-size: fails when the post-build artifact tree exceeds
 * thresholds in scripts/bundle-budget.json.
 *
 *   - Every JS file under .svelte-kit/output/client/_app/immutable/
 *     must be ≤ maxJsChunkBytes.
 *   - Sum of all those JS files must be ≤ maxTotalJsBytes.
 *   - Every file under static/ must be ≤ maxStaticAssetBytes.
 *
 * Run via `npm run check:budget` (which builds first), or directly
 * after `npm run build` via `node scripts/check-bundle-size.mjs`.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const CLIENT_DIR = path.join(ROOT, '.svelte-kit/output/client/_app/immutable');
const STATIC_DIR = path.join(ROOT, 'static');
const BUDGET_PATH = path.join(ROOT, 'scripts/bundle-budget.json');

function kb(bytes) {
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function walk(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, files);
    } else if (entry.isFile()) {
      files.push({ path: full, size: fs.statSync(full).size });
    }
  }
  return files;
}

if (!fs.existsSync(CLIENT_DIR)) {
  console.error(
    `Build output not found at ${CLIENT_DIR}.\n` +
      `Run \`npm run build\` first, or use \`npm run check:budget\` which builds + checks together.`
  );
  process.exit(1);
}

let budget;
try {
  budget = JSON.parse(fs.readFileSync(BUDGET_PATH, 'utf8'));
} catch (err) {
  console.error(`Failed to read ${BUDGET_PATH}: ${err.message}`);
  process.exit(1);
}

const jsFiles = walk(CLIENT_DIR).filter((f) => f.path.endsWith('.js'));
const staticFiles = walk(STATIC_DIR);
const totalJs = jsFiles.reduce((s, f) => s + f.size, 0);

const violations = [];

for (const f of jsFiles) {
  if (f.size > budget.maxJsChunkBytes) {
    const rel = path.relative(ROOT, f.path);
    violations.push(`JS chunk too large: ${rel} (${kb(f.size)} > ${kb(budget.maxJsChunkBytes)})`);
  }
}

if (totalJs > budget.maxTotalJsBytes) {
  violations.push(`Total JS too large: ${kb(totalJs)} > ${kb(budget.maxTotalJsBytes)}`);
}

for (const f of staticFiles) {
  if (f.size > budget.maxStaticAssetBytes) {
    const rel = path.relative(ROOT, f.path);
    violations.push(
      `Static asset too large: ${rel} (${kb(f.size)} > ${kb(budget.maxStaticAssetBytes)})`
    );
  }
}

if (violations.length > 0) {
  console.error(`Bundle budget exceeded (${violations.length} violation(s)):`);
  for (const v of violations) console.error(`  - ${v}`);
  console.error(
    `\nIf the growth is intentional, bump scripts/bundle-budget.json with a\n` +
      `commit message that explains why. Otherwise, find the regression.`
  );
  process.exit(1);
}

console.log(
  `Bundle budget OK (${kb(totalJs)} JS across ${jsFiles.length} chunks; ${staticFiles.length} static assets).`
);

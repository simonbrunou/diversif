#!/usr/bin/env node
/**
 * check-i18n-unused: fails when any key in messages/fr.json is not
 * referenced from src/. A key is "referenced" if any of these patterns
 * matches in a .ts / .js / .svelte file under src/ (excluding generated
 * paraglide output):
 *
 *   1. Direct call:   m.KEY(
 *   2. String literal: 'KEY'  "KEY"  `KEY`
 *   3. Keep directive: // i18n-keep: KEY ...
 *
 * Run via `npm run lint:i18n`.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'src');
const EXCLUDED_DIRS = new Set(['paraglide', 'node_modules']);
const SOURCE_EXT = /\.(ts|js|svelte)$/;
const KEEP_DIRECTIVE = /\/\/\s*i18n-keep:\s*([^\n]+)/g;

const raw = fs.readFileSync(path.join(ROOT, 'messages/fr.json'), 'utf8');
const data = JSON.parse(raw);
const keys = Object.keys(data).filter((k) => k !== '$schema');

const sources = [];
const keepTokens = new Set();

function collectKeepTokens(text) {
  for (const match of text.matchAll(KEEP_DIRECTIVE)) {
    for (const token of match[1].trim().split(/\s+/)) {
      if (token) keepTokens.add(token);
    }
  }
}

function ingestSourceFile(full, name) {
  if (!SOURCE_EXT.test(name)) return;
  const text = fs.readFileSync(full, 'utf8');
  sources.push(text);
  collectKeepTokens(text);
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (entry.isFile()) {
      ingestSourceFile(full, entry.name);
    }
  }
}

walk(SRC);

const haystack = sources.join('\n');

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const dead = [];
for (const key of keys) {
  if (keepTokens.has(key)) continue;
  const k = escapeRegex(key);
  const callRe = new RegExp(`\\bm\\.${k}\\(`);
  const literalRe = new RegExp(`['"\`]${k}['"\`]`);
  if (callRe.test(haystack) || literalRe.test(haystack)) continue;
  dead.push(key);
}

if (dead.length > 0) {
  console.error(`Found ${dead.length} unused i18n key(s) in messages/fr.json:`);
  for (const k of dead) console.error(`  - ${k}`);
  console.error(
    '\nRemove them from messages/fr.json + messages/en.json, or annotate the\n' +
      'dispatch site with `// i18n-keep: <key1> <key2> …`.'
  );
  process.exit(1);
}

console.log(`i18n unused-keys OK (${keys.length} keys, all reachable).`);

#!/usr/bin/env bun
/**
 * check-i18n-unused: fails when any key in messages/fr.json is not
 * referenced from src/. A key is "referenced" if any of these patterns
 * matches in a .ts / .js / .svelte file under src/ (excluding generated
 * paraglide output):
 *
 *   1. Member access: m.KEY with no identifier character after it, so a call
 *      (m.KEY() or a message function handed on (f(raw, m.KEY))
 *   2. String literal: 'KEY'  "KEY"  `KEY`
 *   3. Keep directive: // i18n-keep: KEY ...
 *
 * Run via `bun run lint:i18n`.
 */
import fs from 'node:fs';
import path from 'node:path';

const EXCLUDED_DIRS = new Set(['paraglide', 'node_modules']);
const SOURCE_EXT = /\.(ts|js|svelte)$/;
const KEEP_DIRECTIVE = /\/\/\s*i18n-keep:\s*([^\n]+)/g;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The keys that no source text calls, references, quotes or keeps. */
export function findUnusedKeys(keys: string[], sources: string[]): string[] {
  const keepTokens = new Set<string>();
  for (const text of sources) {
    for (const match of text.matchAll(KEEP_DIRECTIVE)) {
      for (const token of match[1].trim().split(/\s+/)) {
        if (token) keepTokens.add(token);
      }
    }
  }
  const haystack = sources.join('\n');
  return keys.filter((key) => {
    if (keepTokens.has(key)) return false;
    const k = escapeRegex(key);
    // The messages object m itself (not $m or foo.m), then KEY with no
    // identifier character after it (not m.KEYSuffix, a longer key).
    const memberRe = new RegExp(`(?<![\\w$.])m\\.${k}(?![\\w$])`);
    const literalRe = new RegExp(`['"\`]${k}['"\`]`);
    return !(memberRe.test(haystack) || literalRe.test(haystack));
  });
}

function readSources(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...readSources(full));
    } else if (entry.isFile() && SOURCE_EXT.test(entry.name)) {
      out.push(fs.readFileSync(full, 'utf8'));
    }
  }
  return out;
}

if (import.meta.main) {
  const root = process.cwd();
  const data = JSON.parse(fs.readFileSync(path.join(root, 'messages/fr.json'), 'utf8'));
  const keys = Object.keys(data).filter((k) => k !== '$schema');
  const dead = findUnusedKeys(keys, readSources(path.join(root, 'src')));

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
}

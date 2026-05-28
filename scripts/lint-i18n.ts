#!/usr/bin/env node
/**
 * lint-i18n: fails when any French value in messages/fr.json contains a
 * straight (ASCII) apostrophe between two letters. The convention is to use
 * the typographic apostrophe (’) inside words: « l’accueil », « aujourd’hui ».
 *
 * Run via `npm run lint:i18n`.
 */
import fs from 'node:fs';

const raw = fs.readFileSync(new URL('../messages/fr.json', import.meta.url), 'utf8');
const data = JSON.parse(raw);

const IN_WORD_APOSTROPHE = /[a-zà-ÿA-ZÀ-Ÿ]'[a-zà-ÿA-ZÀ-Ÿ]/;

let failures = 0;
for (const [key, value] of Object.entries(data)) {
  if (typeof value !== 'string') continue;
  if (IN_WORD_APOSTROPHE.test(value)) {
    console.error(`Straight apostrophe in ${key}: ${JSON.stringify(value)}`);
    failures += 1;
  }
}

if (failures > 0) {
  console.error(
    `\n${failures} key(s) need typographic apostrophes (run scripts/normalize-fr-apostrophes.py).`
  );
  process.exit(1);
}

console.log('i18n apostrophes OK');

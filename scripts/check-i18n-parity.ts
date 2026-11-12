#!/usr/bin/env bun
/**
 * check-i18n-parity: fails when messages/fr.json (the base locale) and
 * messages/en.json disagree. The paraglide compiler passes each of these
 * without a warning (#723), and the inlang lint rules that caught some of
 * them (missing-translation, empty-pattern) left with paraglide 2:
 *
 *   - a key in one file and not the other: /en pages show the French text,
 *     French pages show the key name;
 *   - a {placeholder} in one locale's value and not the other's: that
 *     locale's text loses the value;
 *   - an empty or whitespace-only value: the page shows an empty label;
 *   - a value that is not a string;
 *   - a { or } outside a {letters} placeholder, the only placeholder form the
 *     files use: this check would read any other form wrongly.
 *
 * The check reads exactly these two files, and first checks that
 * project.inlang/settings.json still points paraglide at them. The $schema
 * entry takes part in no comparison.
 *
 * Run via `bun run lint:i18n`.
 */
import fs from 'node:fs';
import path from 'node:path';

const BASE = 'fr';
const OTHER = 'en';
const SETTINGS_FILE = 'project.inlang/settings.json';
const PATH_PATTERN = './messages/{locale}.json';
const SCHEMA_KEY = '$schema';

const messageFile = (locale: string) => `messages/${locale}.json`;

/** The type JSON.parse gave a value, as JSON names it. */
function jsonType(value: unknown): string {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

const show = (value: unknown) => (value === undefined ? 'missing' : JSON.stringify(value));

/**
 * The problems with the three settings this check relies on. It reads
 * messages/fr.json as the base and messages/en.json, so it fails when the
 * settings say paraglide reads something else.
 */
export function checkSettings(settings: unknown): string[] {
  const s: Record<string, unknown> =
    jsonType(settings) === 'object' ? (settings as Record<string, unknown>) : {};
  const problems: string[] = [];

  if (s.baseLocale !== BASE) {
    problems.push(
      `${SETTINGS_FILE}: baseLocale is ${show(s.baseLocale)}, but this check reads ` +
        `${messageFile(BASE)} as the base and expects "${BASE}".`
    );
  }

  const locales = s.locales;
  const localesMatch =
    Array.isArray(locales) &&
    locales.length === 2 &&
    locales.includes(BASE) &&
    locales.includes(OTHER);
  if (!localesMatch) {
    problems.push(
      `${SETTINGS_FILE}: locales is ${show(locales)}, but this check compares only ` +
        `${messageFile(BASE)} and ${messageFile(OTHER)} and expects exactly "${BASE}" and "${OTHER}".`
    );
  }

  const plugin = s['plugin.inlang.messageFormat'];
  const pathPattern =
    jsonType(plugin) === 'object' ? (plugin as Record<string, unknown>).pathPattern : undefined;
  if (pathPattern !== PATH_PATTERN) {
    problems.push(
      `${SETTINGS_FILE}: plugin.inlang.messageFormat.pathPattern is ${show(pathPattern)}, ` +
        `but this check reads messages/<locale>.json and expects "${PATH_PATTERN}".`
    );
  }

  return problems;
}

/** Parses a JSON file's text, or returns the problem line that names it. */
export function parseJsonFile(
  file: string,
  text: string
): { ok: true; value: unknown } | { ok: false; problem: string } {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error) {
    return { ok: false, problem: `${file}: not valid JSON (${(error as Error).message}).` };
  }
}

// A placeholder is { then ASCII letters then }. Any other brace is a form
// this check cannot read.
const PLACEHOLDER = /\{[A-Za-z]+\}/g;

function placeholders(value: string): Set<string> {
  return new Set(value.match(PLACEHOLDER) ?? []);
}

/** The problems with one locale's own values: type, emptiness, braces. */
function valueProblems(locale: string, key: string, value: unknown): string[] {
  const where = `[${locale}] ${key}`;
  if (typeof value !== 'string') {
    return [`${where}: the value is ${jsonType(value)}, not a string.`];
  }
  if (value === '') return [`${where}: the value is empty.`];
  if (value.trim() === '') return [`${where}: the value is whitespace only.`];
  if (/[{}]/.test(value.replace(PLACEHOLDER, ''))) {
    return [
      `${where}: a { or } outside a {letters} placeholder; ` +
        'this check reads only {letters} placeholders.'
    ];
  }
  return [];
}

/** The placeholders that `locale`'s value lacks and `otherLocale`'s has. */
function missingPlaceholders(
  locale: string,
  key: string,
  value: string,
  otherLocale: string,
  otherValue: string
): string[] {
  const have = placeholders(value);
  return [...placeholders(otherValue)]
    .filter((p) => !have.has(p))
    .map((p) => `[${locale}] ${key}: lacks the placeholder ${p} that ${otherLocale} has.`);
}

/**
 * The parity problems between the base (fr) messages and the other (en)
 * messages, one line per problem, each naming the locale and the key.
 */
export function findParityProblems(base: unknown, other: unknown): string[] {
  const problems: string[] = [];
  const files: [string, unknown][] = [
    [BASE, base],
    [OTHER, other]
  ];
  for (const [locale, data] of files) {
    if (jsonType(data) !== 'object') {
      problems.push(
        `${messageFile(locale)}: the top level is ${jsonType(data)}, not an object of messages.`
      );
    }
  }
  if (problems.length > 0) return problems;

  const fr = base as Record<string, unknown>;
  const en = other as Record<string, unknown>;
  const keys = (data: Record<string, unknown>) => Object.keys(data).filter((k) => k !== SCHEMA_KEY);

  for (const key of keys(fr)) {
    if (!Object.hasOwn(en, key)) {
      problems.push(`[${OTHER}] ${key}: missing (${BASE} has it).`);
    }
  }
  for (const key of keys(en)) {
    if (!Object.hasOwn(fr, key)) {
      problems.push(`[${BASE}] ${key}: missing (${OTHER} has it).`);
    }
  }

  for (const key of keys(fr)) {
    const frProblems = valueProblems(BASE, key, fr[key]);
    const enProblems = Object.hasOwn(en, key) ? valueProblems(OTHER, key, en[key]) : [];
    problems.push(...frProblems, ...enProblems);
    // Placeholders compare only two readable strings.
    if (!Object.hasOwn(en, key) || frProblems.length > 0 || enProblems.length > 0) continue;
    const frValue = fr[key] as string;
    const enValue = en[key] as string;
    problems.push(
      ...missingPlaceholders(OTHER, key, enValue, BASE, frValue),
      ...missingPlaceholders(BASE, key, frValue, OTHER, enValue)
    );
  }
  for (const key of keys(en)) {
    if (!Object.hasOwn(fr, key)) problems.push(...valueProblems(OTHER, key, en[key]));
  }

  return problems;
}

/** Reads and parses a file under root, or returns the problem line. */
function readJson(root: string, file: string) {
  let text: string;
  try {
    text = fs.readFileSync(path.join(root, file), 'utf8');
  } catch (error) {
    return { ok: false as const, problem: `${file}: cannot read (${(error as Error).message}).` };
  }
  return parseJsonFile(file, text);
}

/** Runs the whole check on the files under root. */
export function runParityCheck(root: string): { problems: string[]; keyCount: number } {
  const problems: string[] = [];
  const settings = readJson(root, SETTINGS_FILE);
  if (settings.ok) problems.push(...checkSettings(settings.value));
  else problems.push(settings.problem);

  const base = readJson(root, messageFile(BASE));
  const other = readJson(root, messageFile(OTHER));
  if (!base.ok) problems.push(base.problem);
  if (!other.ok) problems.push(other.problem);
  if (!base.ok || !other.ok) return { problems, keyCount: 0 };

  problems.push(...findParityProblems(base.value, other.value));
  const keyCount =
    jsonType(base.value) === 'object'
      ? Object.keys(base.value as object).filter((k) => k !== SCHEMA_KEY).length
      : 0;
  return { problems, keyCount };
}

if (import.meta.main) {
  const { problems, keyCount } = runParityCheck(process.cwd());
  if (problems.length > 0) {
    console.error(`Found ${problems.length} i18n parity problem(s):`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(`i18n parity OK (${keyCount} keys in fr and en, placeholders match).`);
}

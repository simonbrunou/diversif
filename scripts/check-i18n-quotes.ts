#!/usr/bin/env bun
/**
 * check-i18n-quotes: fails when a message quotes a UI label whose text has
 * changed (#366). #359 renamed the French category chip from « Tous » to
 * « Toutes » and left the empty-category message under it asking the reader
 * to choose « Tous ».
 *
 * scripts/i18n-quote-links.ts says which keys each quoting message refers to
 * (QUOTE_LINKS) and which quoted words name no label (ALLOWED_QUOTES). In
 * messages/fr.json and messages/en.json, each quoted span that holds no
 * {placeholder} must be either an ALLOWED_QUOTES text of its message or the
 * current value, in the same locale, of one of the keys QUOTE_LINKS links to
 * its message. A span in a message with neither entry fails. So does an entry
 * that names a key a file lacks, a link no locale's span matches, and an
 * allowed text no locale's message quotes: a stale entry would let the next
 * rename through. The span's text is compared after trimming the spaces
 * inside the marks, the no-break ones French puts there included.
 *
 * What it reads as a quoted span, in every message of both files:
 *
 * - « … », and “ … ”;
 * - "…", the straight double quotes, paired in order;
 * - '…', straight single quotes that open at the start of the value or after
 *   a space or ( or [, and close before its end, a space or one of . , ; : ! ?
 *   ) ]. An apostrophe inside or after a word (child's, kids') is no quote.
 *
 * These forms fail by name, as quotes it cannot read: an unpaired «, », “ or
 * ”, an odd number of ", a ' that opens a quote and never closes, and the
 * marks ‘ ‹ › „ ‟ ‚. A quote inside another one is read as a span of its own.
 *
 * It does not see a label named without quote marks (the English cookie copy
 * names Log out and My account bare), a span closed by ’, which the French
 * files use as their apostrophe, a quote written in a component's markup
 * rather than in a message, or a value that is not a string (the parity check
 * reports those).
 *
 * Run via `bun run lint:i18n`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ALLOWED_QUOTES, QUOTE_LINKS } from './i18n-quote-links';

const LOCALES = ['fr', 'en'] as const;
const DATA_FILE = 'scripts/i18n-quote-links.ts';
const SCHEMA_KEY = '$schema';

const messageFile = (locale: string) => `messages/${locale}.json`;

export type QuoteSpan = { open: string; close: string; inner: string; text: string };
export type QuoteScan = { spans: QuoteSpan[]; problems: string[] };

const span = (open: string, close: string, inner: string): QuoteSpan => ({
  open,
  close,
  inner,
  text: inner.trim()
});

/** The spans of one pair of distinct marks, or the problem when one is unpaired. */
function pairedSpans(value: string, open: string, close: string): QuoteScan {
  const pattern = new RegExp(`${open}([^${open}${close}]*)${close}`, 'g');
  const spans = [...value.matchAll(pattern)].map((m) => span(open, close, m[1]));
  const rest = value.replace(pattern, '');
  const problems =
    rest.includes(open) || rest.includes(close) ? [`an unpaired ${open} or ${close}`] : [];
  return { spans, problems };
}

function straightDoubleSpans(value: string): QuoteScan {
  const count = value.split('"').length - 1;
  if (count % 2 === 1) return { spans: [], problems: ['an odd number of "'] };
  const spans = [...value.matchAll(/"([^"]*)"/g)].map((m) => span('"', '"', m[1]));
  return { spans, problems: [] };
}

const SINGLE_QUOTE = /(?<=^|[\s([])'([^'\s](?:[^']*[^'\s])?)'(?=$|[\s.,;:!?)\]])/g;
const SINGLE_OPENING = /(?:^|[\s([])'(?=\S)/;

function straightSingleSpans(value: string): QuoteScan {
  const spans = [...value.matchAll(SINGLE_QUOTE)].map((m) => span("'", "'", m[1]));
  const problems = SINGLE_OPENING.test(value.replace(SINGLE_QUOTE, ''))
    ? ["a ' that opens a quote and never closes"]
    : [];
  return { spans, problems };
}

const UNREAD_MARKS = ['‘', '‹', '›', '„', '‟', '‚'];

/** Every quoted span of a message value, and the quote forms it cannot read. */
export function scanQuotes(value: string): QuoteScan {
  const scans = [
    pairedSpans(value, '«', '»'),
    pairedSpans(value, '“', '”'),
    straightDoubleSpans(value),
    straightSingleSpans(value)
  ];
  const unread = UNREAD_MARKS.filter((mark) => value.includes(mark)).map(
    (mark) => `a ${mark} mark, a quote form this check does not read`
  );
  return {
    spans: scans.flatMap((s) => s.spans),
    problems: [...scans.flatMap((s) => s.problems), ...unread]
  };
}

const PLACEHOLDER = /\{[A-Za-z]+\}/;

export type QuoteRules = {
  links: Readonly<Record<string, readonly string[]>>;
  allowed: Readonly<Record<string, readonly string[]>>;
};

type Messages = Record<string, unknown>;

/** What the scan of every message records, for the stale-entry checks. */
type Seen = { usedLinks: Set<string>; usedAllowed: Set<string>; mismatched: Set<string> };

const pairKey = (a: string, b: string) => `${a}\u0000${b}`;
const shown = (s: QuoteSpan) => `${s.open}${s.inner}${s.close}`;

/** The problem with one quoted span of `key`, or null when it passes. */
function spanProblem(
  locale: string,
  key: string,
  quote: QuoteSpan,
  messages: Messages,
  rules: QuoteRules,
  seen: Seen
): string | null {
  if (Object.hasOwn(rules.allowed, key) && rules.allowed[key].includes(quote.text)) {
    seen.usedAllowed.add(pairKey(key, quote.text));
    return null;
  }
  const where = `[${locale}] ${key}`;
  if (!Object.hasOwn(rules.links, key)) {
    return (
      `${where}: quotes ${shown(quote)}, which neither QUOTE_LINKS nor ALLOWED_QUOTES lists ` +
      `for this message. In ${DATA_FILE}, ` +
      'add the key of the label it quotes to QUOTE_LINKS, or the text to ALLOWED_QUOTES ' +
      'when it names no label.'
    );
  }
  const links = rules.links[key];
  const match = links.find((link) => messages[link] === quote.text);
  if (match !== undefined) {
    seen.usedLinks.add(pairKey(key, match));
    return null;
  }
  seen.mismatched.add(key);
  const values = links.map((link) => `${link} reads ${JSON.stringify(messages[link])}`);
  return (
    `${where}: quotes ${shown(quote)}, the text of none of its linked keys (${values.join(', ')}). ` +
    `Requote the label's current text, or fix QUOTE_LINKS in ${DATA_FILE}, or add the text ` +
    'to ALLOWED_QUOTES there when it names no label.'
  );
}

/** The problems of one message value: unreadable quotes, then each span. */
function messageProblems(
  locale: string,
  key: string,
  value: string,
  messages: Messages,
  rules: QuoteRules,
  seen: Seen
): { problems: string[]; spanCount: number } {
  const scan = scanQuotes(value);
  const problems = scan.problems.map((p) => `[${locale}] ${key}: ${p}.`);
  for (const quote of scan.spans) {
    if (PLACEHOLDER.test(quote.text)) continue;
    const problem = spanProblem(locale, key, quote, messages, rules, seen);
    if (problem !== null) problems.push(problem);
  }
  return { problems, spanCount: scan.spans.length };
}

/** The entries of the two maps that name a key one locale's file lacks. */
function missingKeyProblems(locales: Record<string, Messages>, rules: QuoteRules): string[] {
  const named = [
    ...Object.keys(rules.links).map((key) => ['QUOTE_LINKS', key] as const),
    ...Object.values(rules.links).flatMap((links) =>
      links.map((link) => ['QUOTE_LINKS', link] as const)
    ),
    ...Object.keys(rules.allowed).map((key) => ['ALLOWED_QUOTES', key] as const)
  ];
  return Object.entries(locales).flatMap(([locale, messages]) =>
    named
      .filter(([, key]) => !Object.hasOwn(messages, key))
      .map(([map, key]) => `${DATA_FILE}: ${map} names ${key}, which ${messageFile(locale)} lacks.`)
  );
}

/** The links and allowed texts that no locale's message used. */
function staleEntryProblems(rules: QuoteRules, seen: Seen): string[] {
  const links = Object.entries(rules.links)
    .filter(([key]) => !seen.mismatched.has(key))
    .flatMap(([key, linked]) =>
      linked
        .filter((link) => !seen.usedLinks.has(pairKey(key, link)))
        .map(
          (link) =>
            `${DATA_FILE}: QUOTE_LINKS links ${key} to ${link}, but no locale's ${key} ` +
            `quotes ${link}'s text. Remove the link.`
        )
    );
  const allowed = Object.entries(rules.allowed).flatMap(([key, texts]) =>
    texts
      .filter((text) => !seen.usedAllowed.has(pairKey(key, text)))
      .map(
        (text) =>
          `${DATA_FILE}: ALLOWED_QUOTES lets ${key} quote ${JSON.stringify(text)}, but no ` +
          `locale's ${key} quotes it. Remove the text.`
      )
  );
  return [...links, ...allowed];
}

/**
 * The quote problems of the messages of each locale, one line per problem,
 * and the number of quoted spans read.
 */
export function findQuoteProblems(
  locales: Record<string, Messages>,
  rules: QuoteRules = { links: QUOTE_LINKS, allowed: ALLOWED_QUOTES }
): { problems: string[]; spanCount: number } {
  const seen: Seen = { usedLinks: new Set(), usedAllowed: new Set(), mismatched: new Set() };
  const problems: string[] = [];
  let spanCount = 0;
  for (const [locale, messages] of Object.entries(locales)) {
    for (const [key, value] of Object.entries(messages)) {
      if (key === SCHEMA_KEY || typeof value !== 'string') continue;
      const result = messageProblems(locale, key, value, messages, rules, seen);
      problems.push(...result.problems);
      spanCount += result.spanCount;
    }
  }
  const missing = missingKeyProblems(locales, rules);
  // A missing key leaves its links unused; the missing-key line says why.
  const stale = missing.length > 0 ? [] : staleEntryProblems(rules, seen);
  return { problems: [...problems, ...missing, ...stale], spanCount };
}

/** Reads one locale's messages under root, or returns the problem line. */
function readMessages(root: string, locale: string): Messages | string {
  const file = messageFile(locale);
  let data: unknown;
  try {
    data = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  } catch (error) {
    return `${file}: cannot read (${(error as Error).message}).`;
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    return `${file}: the top level is not an object of messages.`;
  }
  return data as Messages;
}

/** Runs the whole check on the message files under root. */
export function runQuoteCheck(
  root: string,
  rules?: QuoteRules
): { problems: string[]; spanCount: number } {
  const locales: Record<string, Messages> = {};
  const problems: string[] = [];
  for (const locale of LOCALES) {
    const messages = readMessages(root, locale);
    if (typeof messages === 'string') problems.push(messages);
    else locales[locale] = messages;
  }
  if (problems.length > 0) return { problems, spanCount: 0 };
  return findQuoteProblems(locales, rules);
}

if (import.meta.main) {
  const { problems, spanCount } = runQuoteCheck(process.cwd());
  if (problems.length > 0) {
    console.error(`Found ${problems.length} i18n quote problem(s):`);
    for (const p of problems) console.error(`  ${p}`);
    process.exit(1);
  }
  console.log(`i18n quotes OK (${spanCount} quoted spans in fr and en).`);
}

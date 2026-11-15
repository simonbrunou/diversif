// What check-i18n-quotes reports when a message quotes a label (#366).
import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { findQuoteProblems, scanQuotes, type QuoteRules } from './check-i18n-quotes';

const SCRIPT = path.join(import.meta.dir, 'check-i18n-quotes.ts');
const REPO = path.join(import.meta.dir, '..');
const DATA = 'scripts/i18n-quote-links.ts';

const readRepoMessages = (locale: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(REPO, `messages/${locale}.json`), 'utf8'));

const texts = (value: string) => scanQuotes(value).spans.map((s) => s.text);

// A matcher for a string that starts with `prefix`, taken literally.
const startingWith = (prefix: string) =>
  expect.stringMatching(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));

describe('scanQuotes', () => {
  it.each([
    ['a plain space', 'Choisissez « Toutes » ici'],
    ['a no-break space', 'Choisissez « Toutes » ici'],
    ['a narrow no-break space', 'Choisissez « Toutes » ici'],
    ['no space', 'Choisissez «Toutes» ici']
  ])('reads « » padded with %s, trimmed', (_name, value) => {
    expect(scanQuotes(value)).toEqual({
      spans: [expect.objectContaining({ open: '«', close: '»', text: 'Toutes' })],
      problems: []
    });
  });

  it('reads every « » span of a value', () => {
    expect(texts('Le bouton « Se déconnecter » depuis « Mon compte ».')).toEqual([
      'Se déconnecter',
      'Mon compte'
    ]);
  });

  it('reads “ ” and straight double quotes', () => {
    expect(texts('Offer “{food}” again')).toEqual(['{food}']);
    expect(texts('Pick "All" or "None".')).toEqual(['All', 'None']);
  });

  it('reads a single-quoted word after a space, a ( or a [ and before punctuation', () => {
    expect(texts("(category 'health', Article 9)")).toEqual(['health']);
    expect(texts("('Log out')")).toEqual(['Log out']);
    expect(texts("['All']")).toEqual(['All']);
    expect(texts("'All' then 'None'.")).toEqual(['All', 'None']);
  });

  it('reads no apostrophe as a quote', () => {
    expect(scanQuotes("This child's journal and the kids' toys. You're offline.")).toEqual({
      spans: [],
      problems: []
    });
    expect(scanQuotes('Le journal de l’enfant n’est plus là.')).toEqual({
      spans: [],
      problems: []
    });
  });

  it('closes a single quote only before a space, punctuation or the end', () => {
    expect(scanQuotes("the 'kid's toy")).toEqual({
      spans: [],
      problems: ["a ' that opens a quote and never closes"]
    });
  });

  it('reads a quote inside another one as a span of its own', () => {
    expect(texts('Choisissez « le "Tout" » ici')).toEqual(['le "Tout"', 'Tout']);
  });

  it.each([
    ['an unpaired «', 'Choisissez « Toutes', 'an unpaired « or »'],
    ['an unpaired »', 'Choisissez Toutes »', 'an unpaired « or »'],
    ['a doubled «', 'Choisissez « « Toutes »', 'an unpaired « or »'],
    ['an unpaired “', 'Pick “All', 'an unpaired “ or ”'],
    ['an unpaired ”', 'Pick All”', 'an unpaired “ or ”'],
    ['an odd number of "', 'Pick "All" or "None', 'an odd number of "'],
    ["a ' that never closes", "Pick 'All or none", "a ' that opens a quote and never closes"]
  ])('fails %s by name', (_name, value, problem) => {
    expect(scanQuotes(value).problems).toEqual([problem]);
  });

  it.each([['‘'], ['‹'], ['›'], ['„'], ['‟'], ['‚']])('fails the %s mark by name', (mark) => {
    expect(scanQuotes(`Pick ${mark}All here`).problems).toEqual([
      `a ${mark} mark, a quote form this check does not read`
    ]);
  });
});

describe('findQuoteProblems', () => {
  const rules = (patch: Partial<QuoteRules> = {}): QuoteRules => ({
    links: { empty: ['filterAll'] },
    allowed: {},
    ...patch
  });
  const fr = (empty: string, extra: Record<string, unknown> = {}) => ({
    $schema: 'x',
    filterAll: 'Toutes',
    empty,
    ...extra
  });

  it('passes a span that equals its linked key’s value', () => {
    expect(findQuoteProblems({ fr: fr('Choisissez « Toutes ».') }, rules())).toEqual({
      problems: [],
      spanCount: 1
    });
  });

  it('fails a span after its linked key’s value changed, naming both keys', () => {
    const messages = { ...fr('Choisissez « Toutes ».'), filterAll: 'Tous' };
    expect(findQuoteProblems({ fr: messages }, rules()).problems).toEqual([
      '[fr] empty: quotes « Toutes », the text of none of its linked keys (filterAll reads "Tous"). ' +
        `Requote the label's current text, or fix QUOTE_LINKS in ${DATA}.`
    ]);
  });

  it('checks each locale against its own values', () => {
    const result = findQuoteProblems(
      {
        fr: { filterAll: 'Toutes', empty: 'Choisissez « All ».' },
        en: { filterAll: 'All', empty: 'Pick "All".' }
      },
      rules()
    );
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toStartWith('[fr] empty: quotes « All »');
  });

  it('passes each span that equals one of several linked keys', () => {
    const messages = {
      logout: 'Se déconnecter',
      account: 'Mon compte',
      cookies: 'Utilisez « Se déconnecter » depuis « Mon compte ».'
    };
    expect(
      findQuoteProblems(
        { fr: messages },
        { links: { cookies: ['logout', 'account'] }, allowed: {} }
      ).problems
    ).toEqual([]);
  });

  it('fails a span in a message no entry covers', () => {
    expect(
      findQuoteProblems({ fr: fr('Choisissez « Toutes ».', { other: 'Voir « Bilan ».' }) }, rules())
        .problems
    ).toEqual([
      '[fr] other: quotes « Bilan », which neither QUOTE_LINKS nor ALLOWED_QUOTES lists for ' +
        `this message. In ${DATA}, add the key of the label it quotes to QUOTE_LINKS, or the ` +
        'text to ALLOWED_QUOTES when it names no label.'
    ]);
  });

  it('fails a span that a message’s allowed texts do not hold', () => {
    const messages = fr('Choisissez « Toutes ».', { consent: 'catégorie « santé » ou « Autre »' });
    expect(
      findQuoteProblems({ fr: messages }, rules({ allowed: { consent: ['santé'] } })).problems
    ).toEqual([
      startingWith(
        '[fr] consent: quotes « Autre », which neither QUOTE_LINKS nor ALLOWED_QUOTES lists'
      )
    ]);
  });

  it('passes an allowed text, in a message with or without links', () => {
    const messages = fr('Choisissez « Toutes » ou « rien ».', { consent: 'catégorie « santé »' });
    expect(
      findQuoteProblems(
        { fr: messages },
        rules({ allowed: { consent: ['santé'], empty: ['rien'] } })
      ).problems
    ).toEqual([]);
  });

  it('allows a text only in its own message', () => {
    const messages = fr('Choisissez « Toutes ».', {
      consent: 'catégorie « santé »',
      other: '« santé »'
    });
    expect(
      findQuoteProblems({ fr: messages }, rules({ allowed: { consent: ['santé'] } })).problems
    ).toEqual([
      startingWith(
        '[fr] other: quotes « santé », which neither QUOTE_LINKS nor ALLOWED_QUOTES lists'
      )
    ]);
  });

  it('never fails a span that holds a placeholder', () => {
    const messages = fr('Choisissez « Toutes ».', {
      a: 'Reproposez « {food} »',
      b: 'Type "{text}" to confirm',
      c: 'Watch “{food} now”'
    });
    expect(findQuoteProblems({ fr: messages }, rules())).toEqual({ problems: [], spanCount: 4 });
  });

  it('reports a quote form it cannot read, with the locale and key', () => {
    expect(
      findQuoteProblems({ fr: fr('Choisissez « Toutes ».', { other: 'Pick ‘All’' }) }, rules())
        .problems
    ).toEqual(['[fr] other: a ‘ mark, a quote form this check does not read.']);
  });

  it('skips $schema and values that are not strings', () => {
    const messages = { ...fr('Choisissez « Toutes ».'), $schema: '« x »', n: 1, o: ['« y »'] };
    expect(findQuoteProblems({ fr: messages }, rules()).problems).toEqual([]);
  });

  it.each([
    [
      'a QUOTE_LINKS message',
      { links: { gone: ['filterAll'], empty: ['filterAll'] } },
      'QUOTE_LINKS names gone'
    ],
    ['a linked key', { links: { empty: ['filterAll', 'gone'] } }, 'QUOTE_LINKS names gone'],
    ['an ALLOWED_QUOTES message', { allowed: { gone: ['x'] } }, 'ALLOWED_QUOTES names gone']
  ])('fails %s that a file lacks', (_name, patch, named) => {
    expect(findQuoteProblems({ fr: fr('Choisissez « Toutes ».') }, rules(patch)).problems).toEqual([
      `${DATA}: ${named}, which messages/fr.json lacks.`
    ]);
  });

  it('fails a link that no locale quotes', () => {
    expect(
      findQuoteProblems(
        { fr: fr('Choisissez « Toutes ».', { none: 'Aucun' }) },
        rules({ links: { empty: ['filterAll', 'none'] } })
      ).problems
    ).toEqual([
      `${DATA}: QUOTE_LINKS links empty to none, but no locale's empty quotes none's text. ` +
        'Remove the link.'
    ]);
  });

  it('passes a link that only one locale quotes', () => {
    expect(
      findQuoteProblems(
        {
          fr: fr('Choisissez « Toutes ».'),
          en: { filterAll: 'All', empty: 'Pick All.' }
        },
        rules()
      ).problems
    ).toEqual([]);
  });

  it('reports no stale link for a message whose span already fails', () => {
    expect(findQuoteProblems({ fr: fr('Choisissez « Tous ».') }, rules()).problems).toEqual([
      startingWith('[fr] empty: quotes « Tous »')
    ]);
  });

  it('fails an allowed text that no locale quotes', () => {
    expect(
      findQuoteProblems(
        { fr: fr('Choisissez « Toutes ».') },
        rules({ allowed: { empty: ['rien'] } })
      ).problems
    ).toEqual([
      `${DATA}: ALLOWED_QUOTES lets empty quote "rien", but no locale's empty quotes it. ` +
        'Remove the text.'
    ]);
  });
});

describe('the repo’s messages and links', () => {
  const repo = () => ({ fr: readRepoMessages('fr'), en: readRepoMessages('en') });

  it('pass', () => {
    expect(findQuoteProblems(repo()).problems).toEqual([]);
  });

  it('fail when the French chip goes back to « Tous », naming the message under it (#359)', () => {
    const locales = repo();
    locales.fr.foodComboboxFilterAll = 'Tous';
    expect(findQuoteProblems(locales).problems).toEqual([
      startingWith(
        '[fr] foodComboboxNoneInCategory: quotes « Toutes », the text of none of its linked keys ' +
          '(foodComboboxFilterAll reads "Tous")'
      )
    ]);
  });

  it('fail on a new « X » in a message no entry covers', () => {
    const locales = repo();
    locales.fr.authAccountHeading = 'Mon « compte »';
    expect(findQuoteProblems(locales).problems).toEqual([
      startingWith(
        '[fr] authAccountHeading: quotes « compte », which neither QUOTE_LINKS nor ALLOWED_QUOTES lists'
      )
    ]);
  });
});

describe('the check-i18n-quotes command', () => {
  let root = '';

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true });
    root = '';
  });

  // A project root holding both message files: the repo's, or the given text.
  function project(files: { fr?: string; en?: string } = {}) {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-quotes-'));
    fs.mkdirSync(path.join(root, 'messages'));
    for (const locale of ['fr', 'en'] as const) {
      const text = files[locale] ?? JSON.stringify(readRepoMessages(locale));
      fs.writeFileSync(path.join(root, `messages/${locale}.json`), text);
    }
  }

  function run() {
    const proc = Bun.spawnSync([process.execPath, SCRIPT], { cwd: root });
    return {
      exitCode: proc.exitCode,
      stdout: proc.stdout.toString(),
      stderr: proc.stderr.toString()
    };
  }

  it('exits 0 and prints the OK line with the span count', () => {
    project();
    const result = run();
    expect(result).toEqual({ exitCode: 0, stdout: expect.any(String), stderr: '' });
    expect(result.stdout).toMatch(/^i18n quotes OK \(\d+ quoted spans in fr and en\)\.\n$/);
  });

  it('exits 1 on a quote problem, one line per problem', () => {
    const fr = readRepoMessages('fr');
    fr.foodComboboxFilterAll = 'Tous';
    project({ fr: JSON.stringify(fr) });
    const result = run();
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toStartWith(
      'Found 1 i18n quote problem(s):\n  [fr] foodComboboxNoneInCategory: quotes « Toutes »'
    );
  });

  it.each([['fr'], ['en']])(
    'exits 1 and names messages/%s.json when it is not valid JSON',
    (locale) => {
      project({ [locale]: '{' });
      const result = run();
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(`  messages/${locale}.json: cannot read (`);
    }
  );

  it('exits 1 and names a message file it cannot find', () => {
    project();
    fs.rmSync(path.join(root, 'messages/en.json'));
    const result = run();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('  messages/en.json: cannot read (');
  });

  it.each([['[]'], ['null'], ['"x"']])(
    'exits 1 on a message file whose top level is %s',
    (text) => {
      project({ fr: text });
      const result = run();
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(
        '  messages/fr.json: the top level is not an object of messages.'
      );
    }
  );
});

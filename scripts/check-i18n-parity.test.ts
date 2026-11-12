// What check-i18n-parity reports between messages/fr.json and messages/en.json (#723).
import { afterEach, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { checkSettings, findParityProblems, parseJsonFile } from './check-i18n-parity';

const SCRIPT = path.join(import.meta.dir, 'check-i18n-parity.ts');

const SETTINGS = {
  $schema: 'https://inlang.com/schema/project-settings',
  baseLocale: 'fr',
  locales: ['fr', 'en'],
  modules: ['./project.inlang/modules/plugin-message-format.js'],
  'plugin.inlang.messageFormat': { pathPattern: './messages/{locale}.json' }
};

describe('findParityProblems', () => {
  it('passes matching files', () => {
    expect(
      findParityProblems(
        { $schema: 'x', a: 'Bonjour {name}', b: 'Oui' },
        { $schema: 'x', a: 'Hello {name}', b: 'Yes' }
      )
    ).toEqual([]);
  });

  it('ignores a $schema entry that only one file has', () => {
    expect(findParityProblems({ $schema: 'x', a: 'Oui' }, { a: 'Yes' })).toEqual([]);
    expect(findParityProblems({ a: 'Oui' }, { $schema: 'x', a: 'Yes' })).toEqual([]);
  });

  it('compares placeholders as sets, so a repeated one is no problem', () => {
    expect(findParityProblems({ a: '{n} et {n}' }, { a: '{n}' })).toEqual([]);
  });

  it('reads a placeholder with capital letters', () => {
    expect(findParityProblems({ a: 'De {userName}' }, { a: 'From {userName}' })).toEqual([]);
  });

  it('reports a key in fr.json missing from en.json', () => {
    expect(findParityProblems({ a: 'Oui', b: 'Non' }, { a: 'Yes' })).toEqual([
      '[en] b: missing (fr has it).'
    ]);
  });

  it('reports a key in en.json missing from fr.json', () => {
    expect(findParityProblems({ a: 'Oui' }, { a: 'Yes', b: 'No' })).toEqual([
      '[fr] b: missing (en has it).'
    ]);
  });

  it('reads key membership as own keys only, not inherited ones', () => {
    expect(findParityProblems({ constructor: 'Oui' }, {})).toEqual([
      '[en] constructor: missing (fr has it).'
    ]);
    expect(findParityProblems({}, { toString: 'Yes' })).toEqual([
      '[fr] toString: missing (en has it).'
    ]);
  });

  it('reports a placeholder in the fr value missing from the en value', () => {
    expect(findParityProblems({ a: 'Il y a {hour} h' }, { a: 'A few hours ago' })).toEqual([
      '[en] a: lacks the placeholder {hour} that fr has.'
    ]);
  });

  it('reports a placeholder in the en value missing from the fr value', () => {
    expect(findParityProblems({ a: 'Bonjour' }, { a: 'Hello {userName}' })).toEqual([
      '[fr] a: lacks the placeholder {userName} that en has.'
    ]);
  });

  it.each([
    ['fr', 'empty', { a: '' }, { a: 'Yes' }],
    ['en', 'empty', { a: 'Oui' }, { a: '' }],
    ['fr', 'whitespace only', { a: ' \t\n' }, { a: 'Yes' }],
    ['en', 'whitespace only', { a: 'Oui' }, { a: '  ' }]
  ])('reports a %s value that is %s', (locale, kind, fr, en) => {
    expect(findParityProblems(fr, en)).toEqual([`[${locale}] a: the value is ${kind}.`]);
  });

  it('reports an empty value of a key the other file lacks', () => {
    expect(findParityProblems({}, { a: '' })).toEqual([
      '[fr] a: missing (en has it).',
      '[en] a: the value is empty.'
    ]);
  });

  it.each([
    ['object', { one: 'Oui' }],
    ['array', ['Oui']],
    ['number', 1],
    ['boolean', true],
    ['null', null]
  ])('reports a value that is a JSON %s', (type, value) => {
    expect(findParityProblems({ a: value }, { a: 'Yes' })).toEqual([
      `[fr] a: the value is ${type}, not a string.`
    ]);
    expect(findParityProblems({ a: 'Oui' }, { a: value })).toEqual([
      `[en] a: the value is ${type}, not a string.`
    ]);
  });

  it.each([['De {name_2}'], ['Le {2}'], ['De { name }'], ['Un { seul'], ['Un } seul']])(
    'reports a brace outside {letters} in %p',
    (value) => {
      const line =
        'a: a { or } outside a {letters} placeholder; this check reads only {letters} placeholders.';
      expect(findParityProblems({ a: value }, { a: 'Yes' })).toEqual([`[fr] ${line}`]);
      expect(findParityProblems({ a: 'Oui' }, { a: value })).toEqual([`[en] ${line}`]);
    }
  );

  it.each([
    ['array', []],
    ['null', null],
    ['string', 'x']
  ])('reports a message file whose top level is %s', (type, value) => {
    expect(findParityProblems(value, {})).toEqual([
      `messages/fr.json: the top level is ${type}, not an object of messages.`
    ]);
    expect(findParityProblems({}, value)).toEqual([
      `messages/en.json: the top level is ${type}, not an object of messages.`
    ]);
  });
});

describe('checkSettings', () => {
  const settings = (patch: Record<string, unknown>) => ({ ...SETTINGS, ...patch });

  it("passes today's settings", () => {
    expect(checkSettings(SETTINGS)).toEqual([]);
  });

  it('passes the two locales in either order', () => {
    expect(checkSettings(settings({ locales: ['en', 'fr'] }))).toEqual([]);
  });

  it('reports a changed baseLocale', () => {
    expect(checkSettings(settings({ baseLocale: 'en' }))).toEqual([
      'project.inlang/settings.json: baseLocale is "en", but this check reads messages/fr.json as the base and expects "fr".'
    ]);
  });

  const localesLine = (shown: string) =>
    `project.inlang/settings.json: locales is ${shown}, but this check compares only messages/fr.json and messages/en.json and expects exactly "fr" and "en".`;

  it.each([
    ['an extra locale', ['fr', 'en', 'de'], '["fr","en","de"]'],
    ['a missing locale', ['fr'], '["fr"]'],
    ['another locale in place of en', ['fr', 'de'], '["fr","de"]'],
    ['a locale twice', ['fr', 'fr'], '["fr","fr"]'],
    ['a string', 'fr,en', '"fr,en"'],
    ['no locales', undefined, 'missing']
  ])('reports locales with %s', (_name, locales, shown) => {
    expect(checkSettings(settings({ locales }))).toEqual([localesLine(shown)]);
  });

  it.each([
    ['a changed pathPattern', { pathPattern: './i18n/{locale}.json' }, '"./i18n/{locale}.json"'],
    ['no plugin settings', undefined, 'missing']
  ])('reports %s', (_name, plugin, shown) => {
    expect(checkSettings(settings({ 'plugin.inlang.messageFormat': plugin }))).toEqual([
      `project.inlang/settings.json: plugin.inlang.messageFormat.pathPattern is ${shown}, but this check reads messages/<locale>.json and expects "./messages/{locale}.json".`
    ]);
  });

  it('reports all three settings when the file is not an object', () => {
    expect(checkSettings([])).toHaveLength(3);
  });
});

describe('parseJsonFile', () => {
  it('returns the parsed value', () => {
    expect(parseJsonFile('messages/en.json', '{"a":"Yes"}')).toEqual({
      ok: true,
      value: { a: 'Yes' }
    });
  });

  it('names the file that is not valid JSON', () => {
    const result = parseJsonFile('messages/en.json', '{"a": "Yes",}');
    expect(result.ok).toBe(false);
    expect(!result.ok && result.problem).toStartWith('messages/en.json: not valid JSON (');
  });
});

describe('the check-i18n-parity command', () => {
  let root = '';

  afterEach(() => {
    if (root) fs.rmSync(root, { recursive: true, force: true });
    root = '';
  });

  // A project root holding the settings and both message files, as text.
  function project(files: { settings?: string; fr?: string; en?: string }) {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'i18n-parity-'));
    fs.mkdirSync(path.join(root, 'project.inlang'));
    fs.mkdirSync(path.join(root, 'messages'));
    const write = (file: string, text: string | undefined) => {
      if (text !== undefined) fs.writeFileSync(path.join(root, file), text);
    };
    write('project.inlang/settings.json', files.settings ?? JSON.stringify(SETTINGS));
    write('messages/fr.json', files.fr ?? '{"$schema":"x","a":"Oui {n}","b":"Non"}');
    write('messages/en.json', files.en ?? '{"$schema":"x","a":"Yes {n}","b":"No"}');
  }

  function run() {
    const proc = Bun.spawnSync([process.execPath, SCRIPT], { cwd: root });
    return {
      exitCode: proc.exitCode,
      stdout: proc.stdout.toString(),
      stderr: proc.stderr.toString()
    };
  }

  it('exits 0 and prints the OK line with the key count', () => {
    project({});
    expect(run()).toEqual({
      exitCode: 0,
      stdout: 'i18n parity OK (2 keys in fr and en, placeholders match).\n',
      stderr: ''
    });
  });

  it('exits 1 on a parity problem, one line per problem', () => {
    project({ en: '{"a":"Yes"}' });
    expect(run()).toEqual({
      exitCode: 1,
      stdout: '',
      stderr:
        'Found 2 i18n parity problem(s):\n' +
        '  [en] b: missing (fr has it).\n' +
        '  [en] a: lacks the placeholder {n} that fr has.\n'
    });
  });

  it('exits 1 on a settings problem', () => {
    project({ settings: JSON.stringify({ ...SETTINGS, baseLocale: 'en' }) });
    const result = run();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('  project.inlang/settings.json: baseLocale is "en"');
  });

  it.each([['messages/fr.json'], ['messages/en.json'], ['project.inlang/settings.json']])(
    'exits 1 and names %s when it is not valid JSON',
    (file) => {
      project({
        settings: file.startsWith('project') ? '{' : undefined,
        fr: file === 'messages/fr.json' ? '{' : undefined,
        en: file === 'messages/en.json' ? '{' : undefined
      });
      const result = run();
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain(`  ${file}: not valid JSON (`);
    }
  );

  it('exits 1 and names a message file it cannot read', () => {
    project({});
    fs.rmSync(path.join(root, 'messages/en.json'));
    const result = run();
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('  messages/en.json: cannot read (');
  });
});

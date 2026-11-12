import { describe, expect, it } from 'bun:test';
import { ESLint, RuleTester } from 'eslint';
import ts from 'typescript-eslint';
import e2e from './e2e.js';

RuleTester.describe = describe;
RuleTester.it = it;

/** @param {number} column */
const substring = (column) => [{ messageId: 'substring', column }];

/**
 * The column of the last `.getBy…` method in the code, the one a chained
 * case reports on.
 * @param {string} code
 */
const last = (code) => ({ code, errors: substring(code.lastIndexOf('.getBy') + 2) });

// The four methods that take a text first, as getByText does.
const textMethods = ['getByLabel', 'getByPlaceholder', 'getByTitle', 'getByAltText'];

/**
 * The getByText cases for access forms, wrappers, spreads and chains, run for
 * each of the four.
 * @param {string} m
 */
const textValid = (m) => [
  `page.${m}('a', { exact: true });`,
  `page.${m}(label, { exact: true });`,
  `page.${m}(/a/i);`,
  `page.${m}('a', { 'exact': true });`,
  `page.${m}('a', { [\`exact\`]: true });`,
  `page.${m}('a', { ...options, exact: true });`,
  `page.${m}('a', { exact: false, exact: true });`,
  `page['${m}']('a', { exact: true });`,
  `page[\`${m}\`]('a', { exact: true });`,
  `page?.${m}('a', { exact: true });`,
  `page.${m}('a', { exact: true } as const);`,
  `page.${m}('a', { exact: true } satisfies { exact: boolean });`,
  `page.${m}!('a', { exact: true });`,
  `page.${m}(/a/ as RegExp);`,
  `page.${m}(...['a', { exact: true }]);`,
  `page.${m}(...['a'], { exact: true });`,
  `page.${m}('a', { exact: true }, ...rest);`,
  `page.locator('form').${m}('a', { exact: true }).click();`
];

/** @param {string} m */
const textInvalid = (m) => [
  { code: `page.${m}('a');`, errors: substring(6) },
  { code: `page.${m}('a', { exact: false });`, errors: substring(6) },
  { code: `page.${m}(LABEL);`, errors: substring(6) },
  { code: `page.${m}(text, options);`, errors: substring(6) },
  { code: `page.${m}(\`a\`);`, errors: substring(6) },
  { code: `page.${m}('a', {});`, errors: substring(6) },
  { code: `page.${m}('a', { exact: true, ...options });`, errors: substring(6) },
  { code: `page.${m}('a', { exact: true, [key]: false });`, errors: substring(6) },
  { code: `page.${m}('a', { exact: false } as const);`, errors: substring(6) },
  { code: `page.${m}(new RegExp(a));`, errors: substring(6) },
  { code: `page.${m}(...args);`, errors: substring(6) },
  { code: `page.${m}('a', ...rest);`, errors: substring(6) },
  { code: `page.${m}(...['a', { exact: false }], { exact: true });`, errors: substring(6) },
  { code: `page['${m}']('a');`, errors: substring(6) },
  { code: `page[\`${m}\`]('a');`, errors: substring(6) },
  { code: `page?.${m}('a');`, errors: substring(7) },
  { code: `(page?.${m})('a');`, errors: substring(8) },
  { code: `page.${m}!('a');`, errors: substring(6) },
  { code: `(page.${m} as typeof page.${m})('a');`, errors: substring(7) },
  // The options of a call earlier in the chain are not this call's.
  last(`page.${m}('a', { exact: true }).${m}('b');`),
  last(`page.getByRole('dialog', { name: 'a', exact: true }).${m}('b');`)
];

/**
 * @param {string} risk
 * @param {string} issue
 */
const message = (risk, issue) =>
  `${risk}, ignoring case (${issue}). Pass { exact: true }, or a regex for a pattern, or disable this rule on the line with the reason the test needs a substring.`;

new RuleTester({ languageOptions: { parser: ts.parser } }).run(
  'e2e/exact-locator',
  e2e.rules['exact-locator'],
  {
    valid: [
      "page.getByText('Clé enregistrée.', { exact: true });",
      'page.getByText(label, { exact: true });',
      'page.getByText(/enregistrée/i);',
      "page.getByText('a', { 'exact': true });",
      "page.getByText('a', { ['exact']: true });",
      "page.getByText('a', { ...options, exact: true });",
      "page.getByText('a', { exact: false, exact: true });",
      "page.getByText('a', { exact: true, name: 'b' });",
      "page.locator('fieldset').getByText('a', { exact: true }).click();",
      "page?.getByText('a', { exact: true });",
      "page.getByText('a', { [`exact`]: true });",
      // TypeScript wrappers leave the value they hold unchanged at run time.
      "page.getByText('a', { exact: true } as const);",
      "page.getByText('a', { exact: true } satisfies { exact: boolean });",
      "page.getByText('a', { exact: true as const });",
      'page.getByText(/a/ as RegExp);',
      "page.getByText!('a', { exact: true });",
      // A spread of an array literal puts its values where the source shows.
      "page.getByText(...['a'], { exact: true });",
      "page.getByText(...['a', { exact: true }]);",
      "page.getByText(...[...['a']], { exact: true });",
      'page.getByText(...[/a/]);',
      "page.getByText('a', { exact: true }, ...rest);",
      'page.getByText(/a/, ...rest);',
      // Not Playwright's method, or a method name only run time knows.
      "getByText('a');",
      "page[method]('a');",
      // getByRole with no options, or options that set no name, matches by
      // role alone.
      "page['getByRole']('a');",
      "page.getByRole('button');",
      "page.getByRole!('button');",
      "page.getByRole(...['button']);",
      "page.getByRole('button', {});",
      "page.getByRole('checkbox', { checked: true });",
      "page.getByRole('heading', { level: 2 } as const);",
      "page.getByRole('heading', { level: 2 }).getByText('a', { exact: true });",
      // Playwright ignores `exact` for a regex name.
      "page.getByRole('button', { name: /a/ });",
      "page.getByRole('button', { name: /a/, exact: false });",
      "page.getByRole('button', { name: /a/ as RegExp });",
      "page.getByRole('button', { 'name': /a/ });",
      "page.getByRole('button', { ['name']: /a/ });",
      "page.getByRole('button', { name: 'a', name: /b/ });",
      "page.getByRole('button', { ...options, name: /a/ });",
      "page.getByRole(...['button', { name: /a/ }]);",
      // Any other name matches exactly with `exact: true`.
      "page.getByRole('button', { name: 'a', exact: true });",
      "page.getByRole('button', { name: label, exact: true });",
      "page.getByRole('button', { name, exact: true });",
      "page.getByRole('button', { name: new RegExp(a), exact: true });",
      "page.getByRole('button', { ...options, exact: true });",
      "page.getByRole('button', { name: 'a', ...options, exact: true });",
      "page.getByRole('button', { [key]: 'a', exact: true });",
      "page.getByRole('button', { name: 'a', exact: true } as const);",
      "page.getByRole('button', { name: 'a', exact: true }, ...rest);",
      "page.getByRole(...['button', { name: 'a', exact: true }]);",
      "page['getByRole']('button', { name: 'a', exact: true });",
      "page[`getByRole`]('button', { name: 'a', exact: true });",
      "page?.getByRole('button', { name: 'a', exact: true });",
      ...textMethods.flatMap(textValid)
    ],
    invalid: [
      { code: "page.getByText('a');", errors: substring(6) },
      { code: "page.getByText('a', { exact: false });", errors: substring(6) },
      { code: 'page.getByText(BANNER_TEXT);', errors: substring(6) },
      { code: 'page.getByText(text, options);', errors: substring(6) },
      { code: 'page.getByText(`a`);', errors: substring(6) },
      { code: "page.getByText('a', {});", errors: substring(6) },
      { code: "page.getByText('a', { exact: 'true' });", errors: substring(6) },
      { code: "page.getByText('a', { exact: !0 });", errors: substring(6) },
      { code: "page.getByText('a', { exact: true, ...options });", errors: substring(6) },
      { code: "page.getByText('a', { exact: true, [key]: false });", errors: substring(6) },
      { code: "page.getByText('a', { exact: true, exact: false });", errors: substring(6) },
      { code: "page.getByText('a', { [exact]: true });", errors: substring(6) },
      { code: "page.getByText('a', { get exact() { return true; } });", errors: substring(6) },
      { code: "page.getByText('a', { exact: false } as const);", errors: substring(6) },
      { code: "page.getByText('a', { exact: false as true });", errors: substring(6) },
      { code: "(page.getByText as typeof page.getByText)('a');", errors: substring(7) },
      { code: "page.getByText!('a');", errors: substring(6) },
      { code: "(page?.getByText)('a');", errors: substring(8) },
      { code: 'page.getByText(new RegExp(a));', errors: substring(6) },
      { code: "page.getByText(f('a', { exact: true }));", errors: substring(6) },
      { code: 'page.getByText(...args);', errors: substring(6) },
      // The spread can hold the options too, and they land second.
      {
        code: "page.getByText(...['a', { exact: false }], { exact: true });",
        errors: substring(6)
      },
      { code: "page.getByText('a', ...rest);", errors: substring(6) },
      { code: "page.getByText(...['a'], ...rest);", errors: substring(6) },
      { code: 'page.getByText(...[...args], { exact: true });', errors: substring(6) },
      { code: "page.getByText(...[...args, 'a'], { exact: true });", errors: substring(6) },
      { code: "page.getByText(...[, 'a'], { exact: true });", errors: substring(6) },
      { code: "page['getByText']('a');", errors: substring(6) },
      { code: "page[`getByText`]('a');", errors: substring(6) },
      { code: "page?.getByText('a');", errors: substring(7) },
      // The options of a call earlier in the chain are not this call's.
      {
        code: "page.getByRole('dialog', { name: 'a', exact: true }).getByText('b');",
        errors: substring(54)
      },
      {
        code: "page.getByText('a', { exact: true }).getByText('b');",
        errors: substring(38)
      },
      // Reported on the method name, so a disable comment sits right above it.
      {
        code: "page\n  .locator('main')\n  .getByText('a');",
        errors: [{ messageId: 'substring', line: 3, column: 4 }]
      },
      // getByRole with a name that is not a regex literal.
      { code: "page.getByRole('button', { name: 'a' });", errors: substring(6) },
      { code: "page.getByRole('button', { name: 'a', exact: false });", errors: substring(6) },
      { code: "page.getByRole('button', { name: `a` });", errors: substring(6) },
      { code: "page.getByRole('button', { name: label });", errors: substring(6) },
      { code: "page.getByRole('button', { name });", errors: substring(6) },
      { code: "page.getByRole('button', { name: new RegExp(a) });", errors: substring(6) },
      { code: "page.getByRole('button', { 'name': 'a' });", errors: substring(6) },
      { code: "page.getByRole('button', { ['name']: 'a' });", errors: substring(6) },
      {
        code: "page.getByRole('button', { get name() { return 'a'; } });",
        errors: substring(6)
      },
      { code: "page.getByRole('button', { name: /a/, name: 'b' });", errors: substring(6) },
      { code: "page.getByRole('button', { name: 'a' } as const);", errors: substring(6) },
      // A regex role is no regex name.
      { code: "page.getByRole(/button/, { name: 'a' });", errors: substring(6) },
      {
        code: "page.getByRole('button', { name: 'a', exact: true, ...options });",
        errors: substring(6)
      },
      // Options or a name only run time knows.
      { code: "page.getByRole('button', options);", errors: substring(6) },
      { code: "page.getByRole('button', { ...options });", errors: substring(6) },
      { code: "page.getByRole('button', { name: /a/, ...options });", errors: substring(6) },
      { code: "page.getByRole('button', { [key]: 'a' });", errors: substring(6) },
      { code: "page.getByRole('button', { name: /a/, [key]: 'b' });", errors: substring(6) },
      { code: "page.getByRole('button', ...rest);", errors: substring(6) },
      { code: "page.getByRole('button', { name: 'a' }, ...rest);", errors: substring(6) },
      { code: 'page.getByRole(...args);', errors: substring(6) },
      { code: "page.getByRole(...['button'], ...rest);", errors: substring(6) },
      {
        code: "page.getByRole(...['button', { name: 'a' }], { name: 'b', exact: true });",
        errors: substring(6)
      },
      // The access forms and wrappers getByText gets.
      { code: "page['getByRole']('button', { name: 'a' });", errors: substring(6) },
      { code: "page[`getByRole`]('button', { name: 'a' });", errors: substring(6) },
      { code: "page?.getByRole('button', { name: 'a' });", errors: substring(7) },
      { code: "(page?.getByRole)('button', { name: 'a' });", errors: substring(8) },
      { code: "page.getByRole!('button', { name: 'a' });", errors: substring(6) },
      {
        code: "(page.getByRole as typeof page.getByRole)('button', { name: 'a' });",
        errors: substring(7)
      },
      last(
        "page.getByRole('dialog', { name: 'a', exact: true }).getByRole('button', { name: 'b' });"
      ),
      last("page.getByRole('dialog').getByRole('button', { name: 'b' });"),
      ...textMethods.flatMap(textInvalid),
      // Each method's message names what its substring can match. RuleTester
      // refuses a case whose code repeats another's, hence the 'b'.
      {
        code: "page.getByText('b');",
        errors: [
          {
            message: message(
              'getByText with a string matches any element whose text contains it',
              '#509'
            )
          }
        ]
      },
      {
        code: "page.getByLabel('b');",
        errors: [
          {
            message: message(
              'getByLabel with a string matches any element whose label or aria-label contains it',
              '#265'
            )
          }
        ]
      },
      {
        code: "page.getByPlaceholder('b');",
        errors: [
          {
            message: message(
              'getByPlaceholder with a string matches any field whose placeholder contains it',
              '#604'
            )
          }
        ]
      },
      {
        code: "page.getByTitle('b');",
        errors: [
          {
            message: message(
              'getByTitle with a string matches any element whose title contains it',
              '#604'
            )
          }
        ]
      },
      {
        code: "page.getByAltText('b');",
        errors: [
          {
            message: message(
              'getByAltText with a string matches any element whose alt text contains it',
              '#604'
            )
          }
        ]
      },
      {
        code: "page.getByRole('button', { name: 'b' });",
        errors: [
          {
            message: message(
              'getByRole with a string name, or a name the rule cannot read, matches any element of that role whose accessible name contains it',
              '#604'
            )
          }
        ]
      }
    ]
  }
);

// The rule runs as an error on every TypeScript file under e2e/, the helpers
// file included, through eslint.config.js.
describe('eslint.config.js', () => {
  const eslint = new ESLint({ cwd: new URL('..', import.meta.url).pathname });
  /**
   * @param {string} code
   * @param {string} filePath
   */
  const lint = async (code, filePath) => {
    const [result] = await eslint.lintText(`${code}\n`, { filePath });
    return result.messages.map(({ ruleId, line, severity }) => ({ ruleId, line, severity }));
  };
  const reported = [{ ruleId: 'e2e/exact-locator', line: 1, severity: /** @type {const} */ (2) }];

  it.each(['e2e/probe.spec.ts', 'e2e/_helpers.ts'])('reports a substring call in %s', async (f) => {
    expect(await lint("page.getByLabel('a');", f)).toEqual(reported);
  });

  it('honours a disable comment on the next line', async () => {
    const disable = '// eslint-disable-next-line e2e/exact-locator -- a probe';
    expect(await lint(`${disable}\npage.getByLabel('a');`, 'e2e/probe.spec.ts')).toEqual([]);
  });

  it('leaves a test outside e2e/ alone', async () => {
    expect(await lint("page.getByLabel('a');", 'src/lib/probe.test.ts')).toEqual([]);
  });
});

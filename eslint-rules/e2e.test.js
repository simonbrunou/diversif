import { describe, it } from 'bun:test';
import { RuleTester } from 'eslint';
import ts from 'typescript-eslint';
import e2e from './e2e.js';

RuleTester.describe = describe;
RuleTester.it = it;

const substring = (column) => [{ messageId: 'substring', column }];

new RuleTester({ languageOptions: { parser: ts.parser } }).run(
  'e2e/exact-get-by-text',
  e2e.rules['exact-get-by-text'],
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
      "page.getByRole('button', { name: 'a' });",
      // Not Playwright's method, or a method name only run time knows.
      "getByText('a');",
      "page[method]('a');",
      "page['getByRole']('a');"
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
      }
    ]
  }
);

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
      { code: "page.getByText('a', { exact: true } as const);", errors: substring(6) },
      { code: 'page.getByText(new RegExp(a));', errors: substring(6) },
      { code: "page.getByText(f('a', { exact: true }));", errors: substring(6) },
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

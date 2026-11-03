import { describe, expect, it } from 'bun:test';
import { ESLint, RuleTester } from 'eslint';
import svelte from 'eslint-plugin-svelte';
import ts from 'typescript-eslint';
import i18n from './i18n.js';

RuleTester.describe = describe;
RuleTester.it = it;

// The parser eslint.config.js lints components with, through the Svelte
// plugin's own config.
const svelteParser = svelte.configs['flat/recommended'].find((c) => c.languageOptions?.parser)
  .languageOptions.parser;

const component = (code) => ({ code, filename: 'Component.svelte' });
const separator = (column, line = 1) => [{ messageId: 'separator', line, column }];

// Each invalid form, again with U+00A0 and U+202F before the colon, written
// as themselves and as entities.
const spaces = [' ', ' ', ' '];
const spacedForms = spaces.flatMap((space) => [
  { code: `<p>{a}${space}: {b}</p>`, errors: separator(7) },
  { code: `<p><strong>{a}</strong>${space}: {b}</p>`, errors: separator(24) },
  { code: `<p title="{a}${space}: {b}"></p>`, errors: separator(14) },
  { code: `<p>{\`\${a}${space}: \${b}\`}</p>`, errors: separator(9) },
  { code: `<script>const t = \`\${a}${space}: \${b}\`;</script>`, errors: separator(23) }
]);

new RuleTester({
  languageOptions: { parser: svelteParser, parserOptions: { parser: ts.parser } }
}).run('i18n/no-literal-colon-separator', i18n.rules['no-literal-colon-separator'], {
  valid: [
    // A ternary's colon is code.
    '<p>{a ? b : c}</p>',
    '<p>{`${a ? b : c}`}</p>',
    '<script>const t = `${a ? b : c}`;</script>',
    '<p title="{a ? b : c}"></p>',
    // No whitespace before the colon.
    '<p>{a}: {b}</p>',
    '<p><strong>{a}</strong>: {b}</p>',
    '<p title="{a}: {b}"></p>',
    '<script>const t = `${a}: ${b}`;</script>',
    // Static content on one side.
    '<p>Label : {b}</p>',
    '<p>{a} : Texte</p>',
    '<p><strong>Libellé</strong> : {b}</p>',
    '<p>{a} : <strong>Texte</strong></p>',
    '<p title="Label : {b}"></p>',
    '<p title="{a} : texte"></p>',
    '<p title="a : b"></p>',
    '<script>const t = `Label : ${b}`;</script>',
    '<script>const t = `${a} : texte`;</script>',
    '<script>const t = `a : b`;</script>',
    // Static text before the colon, between two dynamic parts: the form of
    // the French-only privacy page.
    '<p><a href="mailto:{e}">{e}</a>. Adresse postale : {b}.</p>',
    '<p>{a} : ({b})</p>',
    '<p title="{a}, adresse : {b}"></p>',
    '<script>const t = `${a}, adresse : ${b}`;</script>',
    // A tagged template with an invalid escape has no cooked text.
    '<script>const t = tag`${a} \\u : ${b}`;</script>',
    // An element with no `{…}` tag inside is static.
    '<p><Icon /> : {b}</p>',
    // A space with no colon.
    '<p>{a} {b}</p>',
    // A reported line under a disable comment. RuleTester names the rule
    // rule-to-test/<name>. A markup comment needs eslint-plugin-svelte's
    // processor, which RuleTester leaves out: the config test below covers it.
    '<script>\n  // eslint-disable-next-line rule-to-test/i18n/no-literal-colon-separator -- French-only content\n  const t = `${a} : ${b}`;\n</script>'
  ].map(component),
  invalid: [
    ...spacedForms,
    { code: '<p>{a}&nbsp;: {b}</p>', errors: separator(7) },
    { code: '<p>{a}&#8239;: {b}</p>', errors: separator(7) },
    { code: '<p title="{a}&nbsp;: {b}"></p>', errors: separator(14) },
    // A component or a block that holds a `{…}` tag is dynamic too.
    { code: '<p><Label>{a}</Label> : {b}</p>', errors: separator(22) },
    { code: '{#if x}<span>{a}</span>{/if} : {b}', errors: separator(29) },
    // Text at the top level of the component.
    { code: '{a} : {b}', errors: separator(4) },
    { code: '<p>{@html a} : {b}</p>', errors: separator(13) },
    // A newline before the colon renders as a space.
    { code: '<p>\n  {a}\n  : {b}\n</p>', errors: separator(6, 2) },
    // Each separator of a longer chain.
    {
      code: '<p>{a} : {b} : {c}</p>',
      errors: [
        { messageId: 'separator', column: 7 },
        { messageId: 'separator', column: 13 }
      ]
    },
    {
      code: '<script>const t = `${a} : ${b} : ${c}`;</script>',
      errors: [
        { messageId: 'separator', column: 23 },
        { messageId: 'separator', column: 30 }
      ]
    },
    { code: '<p style:content="{a} : {b}"></p>', errors: separator(22) },
    // A colon with no space after it is still the French form.
    { code: '<p>{a} :{b}</p>', errors: separator(7) }
  ].map(({ code, errors }) => ({ ...component(code), errors }))
});

// The repo's config turns the rule on for components, and the markup form of
// a disable comment, which French-only content uses, turns it off.
describe('eslint.config.js', () => {
  const eslint = new ESLint({ cwd: new URL('..', import.meta.url).pathname });
  const script =
    '<script lang="ts">\n  let { a, b }: { a: string; b: string } = $props();\n</script>\n';
  const lint = async (markup) => {
    const [result] = await eslint.lintText(`${script}${markup}\n`, {
      filePath: 'src/lib/components/Probe.svelte'
    });
    return result.messages.map(({ ruleId, line, severity }) => ({ ruleId, line, severity }));
  };

  it('reports a separator in a component as an error', async () => {
    expect(await lint('<p>{a} : {b}</p>')).toEqual([
      { ruleId: 'i18n/no-literal-colon-separator', line: 4, severity: 2 }
    ]);
  });

  it('honours a markup disable comment on the next line', async () => {
    const disable =
      '<!-- eslint-disable-next-line i18n/no-literal-colon-separator -- French-only content -->';
    expect(await lint(`${disable}\n<p>{a} : {b}</p>`)).toEqual([]);
  });
});

// eslint.config.js bans a type annotation or a cast on a route's load: either
// types its result as Record<string, any>, so the fields a test reads are any
// (#554). `satisfies` keeps the result type.
import { describe, expect, it } from 'bun:test';
import { ESLint } from 'eslint';

const eslint = new ESLint({ cwd: new URL('..', import.meta.url).pathname });

/** @param {string} code */
const lint = async (code, filePath = 'src/routes/probe/+page.server.ts') => {
  const [result] = await eslint.lintText(`${code}\n`, { filePath });
  // Other rules (prefer-const on `export let`) do not concern this ban.
  return result.messages
    .filter(({ ruleId }) => ruleId === 'no-restricted-syntax')
    .map(({ ruleId, line, severity, message }) => ({
      ruleId,
      line,
      severity,
      message
    }));
};

/** @param {number} line */
const banned = (line) => ({
  ruleId: 'no-restricted-syntax',
  line,
  severity: /** @type {const} */ (2),
  message: expect.stringMatching(
    /^Declare the load as .* satisfies PageServerLoad;`: .*\(#554\)\.$/
  )
});

describe('eslint.config.js', () => {
  it.each([
    ['+page.server.ts', 'PageServerLoad'],
    ['+layout.server.ts', 'LayoutServerLoad'],
    ['+page.ts', 'PageLoad'],
    ['+layout.ts', 'LayoutLoad']
  ])('reports an annotated load in %s', async (file, type) => {
    const code = `export const load: ${type} = async () => ({ a: 1 });`;
    expect(await lint(code, `src/routes/probe/${file}`)).toEqual([banned(1)]);
  });

  it.each([
    ['exported with let', 'export let load: PageServerLoad = async () => ({ a: 1 });', 1],
    [
      'declared, then exported',
      'const load: PageServerLoad = async () => ({ a: 1 });\nexport { load };',
      1
    ],
    ['cast with as', 'export const load = (async () => ({ a: 1 })) as PageServerLoad;', 1],
    ['cast with <T>', 'export const load = <PageServerLoad>(async () => ({ a: 1 }));', 1]
  ])('reports a load %s', async (_, code, line) => {
    expect(await lint(code)).toEqual([banned(line)]);
  });

  it('honours a disable comment on the next line', async () => {
    const disable = '// eslint-disable-next-line no-restricted-syntax -- a probe';
    const code = 'export const load: PageServerLoad = async () => ({ a: 1 });';
    expect(await lint(`${disable}\n${code}`)).toEqual([]);
  });

  it.each([
    [
      'a load that uses satisfies',
      'export const load = (async () => ({ a: 1 })) satisfies PageServerLoad;',
      'src/routes/probe/+page.server.ts'
    ],
    [
      'a load declared as a function',
      'export async function load() {\n  return { a: 1 };\n}',
      'src/routes/probe/+page.server.ts'
    ],
    [
      'a load inside a function',
      'export function f() {\n  const load: () => number = () => 1;\n  return load();\n}',
      'src/routes/probe/+page.server.ts'
    ],
    [
      'annotated actions',
      'export const actions: Actions = { default: async () => {} };',
      'src/routes/probe/+page.server.ts'
    ],
    [
      'a module of src/routes that SvelteKit does not load',
      'export const load: PageServerLoad = async () => ({ a: 1 });',
      'src/routes/probe/helpers.ts'
    ],
    [
      'a file outside src/routes',
      'export const load: PageServerLoad = async () => ({ a: 1 });',
      'src/lib/probe/+page.server.ts'
    ]
  ])('leaves %s alone', async (_, code, filePath) => {
    expect(await lint(code, filePath)).toEqual([]);
  });
});

// eslint.config.js bans a type annotation or a cast on a route's load: either
// types its result as Record<string, any>, so the fields a test reads are any
// (#554). `satisfies` keeps the result type. It also bans a load that takes
// another binding's value or name, which could hide an annotated function.
import { describe, expect, it } from 'bun:test';
import { ESLint } from 'eslint';

const eslint = new ESLint({ cwd: new URL('..', import.meta.url).pathname });

/** @param {string} code */
const lint = async (code, filePath = 'src/routes/probe/+page.server.ts') => {
  const [result] = await eslint.lintText(`${code}\n`, { filePath });
  // Other rules (prefer-const on `export let`) do not concern this ban. A
  // parse error has no rule and stays, so a probe that does not parse fails.
  return result.messages
    .filter(({ ruleId, fatal }) => fatal || ruleId === 'no-restricted-syntax')
    .map(({ ruleId, line, severity, message }) => ({
      ruleId,
      line,
      severity,
      message
    }));
};

/**
 * @param {number} line
 * @param {string} type
 */
const banned = (line, type = 'PageServerLoad') => ({
  ruleId: 'no-restricted-syntax',
  line,
  severity: /** @type {const} */ (2),
  message: expect.stringMatching(
    new RegExp(`^Declare the load in place as .* satisfies ${type};\`: .*\\(#554\\)\\.$`)
  )
});

const FILES = [
  ['+page.server.ts', 'PageServerLoad'],
  ['+layout.server.ts', 'LayoutServerLoad'],
  ['+page.ts', 'PageLoad'],
  ['+layout.ts', 'LayoutLoad']
];

describe('eslint.config.js', () => {
  // The root of src/routes, one folder down and two folders down.
  it.each(
    FILES.flatMap(([file, type]) =>
      ['src/routes/', 'src/routes/probe/', 'src/routes/a/[id]/'].map((dir) => [
        `${dir}${file}`,
        type
      ])
    )
  )('reports an annotated load in %s, naming %s', async (filePath, type) => {
    const code = `export const load: ${type} = async () => ({ a: 1 });`;
    expect(await lint(code, filePath)).toEqual([banned(1, type)]);
  });

  it.each([
    ['exported with let', 'export let load: PageServerLoad = async () => ({ a: 1 });', 1],
    [
      'declared, then exported',
      'const load: PageServerLoad = async () => ({ a: 1 });\nexport { load };',
      1
    ],
    ['cast with as', 'export const load = (async () => ({ a: 1 })) as PageServerLoad;', 1],
    ['cast with <T>', 'export const load = <PageServerLoad>(async () => ({ a: 1 }));', 1],
    [
      'cast with as, then exported',
      'const load = (async () => ({ a: 1 })) as PageServerLoad;\nexport { load };',
      1
    ],
    [
      'cast with <T>, then exported',
      'const load = <PageServerLoad>(async () => ({ a: 1 }));\nexport { load };',
      1
    ],
    ['set to another binding', 'const f = async () => ({ a: 1 });\nexport const load = f;', 2],
    [
      'set to another binding, then exported',
      'const f = async () => ({ a: 1 });\nconst load = f;\nexport { load };',
      2
    ],
    [
      'exported under another name',
      'const f: PageServerLoad = async () => ({ a: 1 });\nexport { f as load };',
      2
    ],
    [
      'exported under a string name',
      "const f: PageServerLoad = async () => ({ a: 1 });\nexport { f as 'load' };",
      2
    ],
    ['re-exported under another name', "export { f as load } from './f';", 1]
  ])('reports a load %s', async (_, code, line) => {
    expect(await lint(code)).toEqual([banned(line)]);
  });

  it('honours a disable comment on the next line', async () => {
    const disable = '// eslint-disable-next-line no-restricted-syntax -- a probe';
    const code = 'export const load: PageServerLoad = async () => ({ a: 1 });';
    expect(await lint(`${disable}\n${code}`)).toEqual([]);
  });

  it('keeps a parse error, so a probe that does not parse fails', async () => {
    expect(await lint('export const load = (;')).toEqual([
      expect.objectContaining({ ruleId: null, severity: 2 })
    ]);
  });

  it.each([
    [
      'a load that uses satisfies',
      'export const load = (async () => ({ a: 1 })) satisfies PageServerLoad;',
      'src/routes/probe/+page.server.ts'
    ],
    [
      'a load that uses satisfies, then exported',
      'const load = (async () => ({ a: 1 })) satisfies PageServerLoad;\nexport { load };',
      'src/routes/probe/+page.server.ts'
    ],
    [
      'a load with neither annotation nor cast',
      'export const load = async () => ({ a: 1 });',
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
      'another binding exported under its own name',
      'const f: () => number = () => 1;\nexport { f };',
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

// eslint.config.js lets a route file export its load in two forms only:
// `export const load = (<function>) satisfies <type>;` and a function
// declaration. An annotation or a cast types the load's result as
// Record<string, any>, so the fields a test reads are any (#554), and the
// other forms of export can hide one.
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
    new RegExp(`^Export the load in place as .* satisfies ${type};\`.*\\(#554\\)\\.$`)
  )
});

const FILES = [
  ['+page.server.ts', 'PageServerLoad'],
  ['+layout.server.ts', 'LayoutServerLoad'],
  ['+page.ts', 'PageLoad'],
  ['+layout.ts', 'LayoutLoad']
];

// The root of src/routes, one folder down and two folders down.
const DIRS = ['src/routes/', 'src/routes/probe/', 'src/routes/a/[id]/'];

describe('eslint.config.js', () => {
  it.each(FILES.flatMap(([file, type]) => DIRS.map((dir) => [`${dir}${file}`, type])))(
    'reports an annotated load in %s, naming %s',
    async (filePath, type) => {
      const code = `export const load: ${type} = async () => ({ a: 1 });`;
      expect(await lint(code, filePath)).toEqual([banned(1, type)]);
    }
  );

  it.each([
    [
      'annotated, with satisfies',
      'export const load: PageServerLoad = (async () => ({ a: 1 })) satisfies PageServerLoad;',
      1
    ],
    ['with neither annotation nor satisfies', 'export const load = async () => ({ a: 1 });', 1],
    ['cast with as', 'export const load = (async () => ({ a: 1 })) as PageServerLoad;', 1],
    ['cast with <T>', 'export const load = <PageServerLoad>(async () => ({ a: 1 }));', 1],
    ['set to another binding', 'const f = async () => ({ a: 1 });\nexport const load = f;', 2],
    [
      'set to another binding with satisfies',
      'const f: PageServerLoad = async () => ({ a: 1 });\nexport const load = f satisfies PageServerLoad;',
      2
    ],
    ['set to a member', 'export const load = m.load;', 1],
    [
      'set to a call with satisfies',
      'export const load = wrap(async () => ({ a: 1 })) satisfies PageServerLoad;',
      1
    ],
    [
      'with a return type on the function',
      'export const load = (async (): Promise<Record<string, any>> => ({ a: 1 })) satisfies PageServerLoad;',
      1
    ],
    [
      'declared as a function with a return type',
      'export async function load(): ReturnType<PageServerLoad> {\n  return { a: 1 };\n}',
      1
    ],
    ['declared with no value', 'export let load;', 1],
    [
      'declared with let',
      'export let load = (async () => ({ a: 1 })) satisfies PageServerLoad;',
      1
    ],
    [
      'declared with var',
      'export var load = (async () => ({ a: 1 })) satisfies PageServerLoad;',
      1
    ],
    ['declared as a class', 'export class load {}', 1],
    ['declared without a body', 'export declare function load(): Promise<{ a: number }>;', 1],
    ['imported with import =', 'export import load = M.load;', 1],
    [
      'declared, then exported',
      'const load = (async () => ({ a: 1 })) satisfies PageServerLoad;\nexport { load };',
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
    ['re-exported', "export { load } from './f';", 1],
    ['imported, then exported', "import { load } from './f';\nexport { load };", 2],
    ['destructured from an object', 'export const { load } = m;', 1],
    ['destructured from an array', 'export const [load] = m;', 1],
    ['exported with export *', "export * from './f';", 1],
    ['exported with export * as', "export * as load from './f';", 1]
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

  it.each(FILES.flatMap(([file, type]) => DIRS.map((dir) => [`${dir}${file}`, type])))(
    'leaves a load that uses satisfies alone in %s',
    async (filePath, type) => {
      const code = `export const load = (async () => ({ a: 1 })) satisfies ${type};`;
      expect(await lint(code, filePath)).toEqual([]);
    }
  );

  it.each([
    [
      'a function expression that uses satisfies',
      'export const load = async function () {\n  return { a: 1 };\n} satisfies PageServerLoad;',
      'src/routes/probe/+page.server.ts'
    ],
    [
      'a load declared as a function',
      'export async function load() {\n  return { a: 1 };\n}',
      'src/routes/probe/+page.server.ts'
    ],
    [
      'a let load that is not exported',
      'let load = (async () => ({ a: 1 })) satisfies PageServerLoad;\nexport const n = load;',
      'src/routes/probe/+page.server.ts'
    ],
    [
      'a destructure that is not exported',
      'const { a } = m;\nexport const n = a;',
      'src/routes/probe/+page.server.ts'
    ],
    [
      'another function with a return type',
      'export function f(): number {\n  return 1;\n}',
      'src/routes/probe/+page.server.ts'
    ],
    [
      'an annotated load that is not exported',
      'const load: () => number = () => 1;\nexport const n = load();',
      'src/routes/probe/+page.server.ts'
    ],
    [
      'another binding exported in a list',
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

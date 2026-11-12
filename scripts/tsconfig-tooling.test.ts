// Tests tsconfig.tooling.json and the `bun run check` step that runs it
// (#658). Before them, no tsconfig included the repo's lint rules under
// eslint-rules/ or the bun test preloads, so a type error there shipped.
import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const repo = path.join(import.meta.dir, '..');
const config = ts.getParsedCommandLineOfConfigFile(
  path.join(repo, 'tsconfig.tooling.json'),
  undefined,
  {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    }
  }
);
if (!config) throw new Error('tsconfig.tooling.json did not parse');
const { options, fileNames, errors } = config;

// The files every `bun test` process loads first, in bunfig.toml's order.
const bunfig = Bun.TOML.parse(readFileSync(path.join(repo, 'bunfig.toml'), 'utf8')) as {
  test?: { preload?: string[] };
};
const preloads = bunfig.test?.preload ?? [];

describe('tsconfig.tooling.json', () => {
  it('runs in bun run check, which the Lint + typecheck job runs', () => {
    const pkg = JSON.parse(readFileSync(path.join(repo, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.check.split(' && ')).toContain(
      'bun --bun node_modules/typescript/bin/tsc -p tsconfig.tooling.json'
    );
  });

  it('includes every file under eslint-rules/ and every preload in bunfig.toml', () => {
    const rules = [...new Bun.Glob('eslint-rules/**/*').scanSync({ cwd: repo })];
    expect(rules).toContain('eslint-rules/ast.js');
    expect(preloads).toContain('./bunfig.preload.ts');
    const expected = [...rules, ...preloads].map((file) => path.join(repo, file));
    expect(errors).toEqual([]);
    expect(fileNames).toEqual(expect.arrayContaining(expected));
  });

  // Including a .js file checks it only under checkJs, and the preloads
  // read Bun's globals, which only the "bun" entry in `types` loads: any
  // other error in the program fails the test too. The probe appends a type
  // error to one file of each kind in the program check builds, JSDoc in
  // the rule and TypeScript in the preload, and reads both errors back.
  // About 2 s locally: the 30 s budget leaves room for a busy runner.
  it('reports a type error in a rule file and in a preload', () => {
    const probes = new Map(
      Object.entries({
        'eslint-rules/ast.js': '/** @type {number} */\nexport const typeProbe = "not a number";',
        'bunfig.preload.ts': 'export const typeProbe: number = "not a number";'
      }).map(([file, probe]) => [path.join(repo, file), probe])
    );
    const host = ts.createCompilerHost(options);
    const { getSourceFile } = host;
    host.getSourceFile = (file, languageVersion, ...rest) => {
      const probe = probes.get(file);
      return probe === undefined
        ? getSourceFile.call(host, file, languageVersion, ...rest)
        : ts.createSourceFile(file, `${readFileSync(file, 'utf8')}\n${probe}\n`, languageVersion);
    };
    const program = ts.createProgram(fileNames, options, host);
    const reported = ts.getPreEmitDiagnostics(program).map(({ file, code, messageText }) => ({
      file: file && path.relative(repo, file.fileName),
      code,
      message: ts.flattenDiagnosticMessageText(messageText, '\n')
    }));
    const typeError = {
      code: 2322,
      message: "Type 'string' is not assignable to type 'number'."
    };
    expect(reported).toEqual([
      { file: 'bunfig.preload.ts', ...typeError },
      { file: 'eslint-rules/ast.js', ...typeError }
    ]);
  }, 30_000);
});

// tsconfig.e2e.json and the `bun run check` step that runs it (#363 retro).
// Before them, no tsconfig included e2e/ or playwright.config.ts. A spec that
// called a helper it never imported passed lint and check, then failed with a
// ReferenceError in each test that called it.
import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const repo = path.join(import.meta.dir, '..');
const helpersPath = path.join(repo, 'e2e/_helpers.ts');
const config = ts.getParsedCommandLineOfConfigFile(
  path.join(repo, 'tsconfig.e2e.json'),
  undefined,
  {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (diagnostic) => {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'));
    }
  }
);
if (!config) throw new Error('tsconfig.e2e.json did not parse');
const { options, fileNames, errors } = config;

describe('tsconfig.e2e.json', () => {
  it('runs in bun run check, which the Lint + typecheck job runs', () => {
    const pkg = JSON.parse(readFileSync(path.join(repo, 'package.json'), 'utf8')) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts.check.split(' && ')).toContain(
      'bun --bun node_modules/typescript/bin/tsc -p tsconfig.e2e.json'
    );
  });

  it('includes every TypeScript file under e2e/ and playwright.config.ts', () => {
    const expected = [
      ...new Bun.Glob('e2e/**/*.ts').scanSync({ cwd: repo }),
      'playwright.config.ts'
    ].map((file) => path.join(repo, file));
    expect(errors).toEqual([]);
    expect(expected).toContain(helpersPath);
    expect(fileNames).toEqual(expect.arrayContaining(expected));
  });

  // A helper named like a global of the e2e program (DOM's open or name, for
  // instance) would resolve to that global in a spec that forgets to import
  // it, and check would pass.
  it('reports each helper a spec uses without importing it', () => {
    const host = ts.createCompilerHost(options);
    const helpersProgram = ts.createProgram([helpersPath], options, host);
    const checker = helpersProgram.getTypeChecker();
    const helpersModule = checker.getSymbolAtLocation(helpersProgram.getSourceFile(helpersPath)!)!;
    const helpers = checker
      .getExportsOfModule(helpersModule)
      .filter((symbol) => symbol.flags & ts.SymbolFlags.Value)
      .map((symbol) => symbol.name)
      .sort();
    expect(helpers).toContain('logRepas');

    const probePath = path.join(repo, 'e2e/unimported-helpers.probe.ts');
    const probe = `export {};\n${helpers.map((name) => `void ${name};`).join('\n')}\n`;
    const { fileExists, getSourceFile } = host;
    host.fileExists = (file) => file === probePath || fileExists.call(host, file);
    host.getSourceFile = (file, languageVersion, ...rest) =>
      file === probePath
        ? ts.createSourceFile(file, probe, languageVersion)
        : getSourceFile.call(host, file, languageVersion, ...rest);
    const program = ts.createProgram([probePath], options, host, helpersProgram);
    const unresolved = ts
      .getPreEmitDiagnostics(program, program.getSourceFile(probePath))
      .filter((diagnostic) => diagnostic.code === 2304) // Cannot find name '…'.
      .map(
        (diagnostic) =>
          /'(.+)'/.exec(ts.flattenDiagnosticMessageText(diagnostic.messageText, ''))?.[1]
      )
      .sort();
    expect(unresolved).toEqual(helpers);
  }, 30_000);
});

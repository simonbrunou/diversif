// Tests tsconfig.e2e.json and the `bun run check` step that runs it (#363
// retro). Before them, no tsconfig included e2e/ or playwright.config.ts. A
// spec that called a helper it never imported passed lint and check, then
// failed with a ReferenceError in each test that called it.
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

// The name a spec calls an export of e2e/_helpers.ts by. Undefined when the
// export holds no value, or when it is a default export with no name of its
// own (`export default function () {}`, `export default 42`).
function specName(checker: ts.TypeChecker, symbol: ts.Symbol): string | undefined {
  const declaration = symbol.declarations?.[0];
  // `export type { X }` and `export { type X }` export no value.
  if (!declaration || ts.isTypeOnlyImportOrExportDeclaration(declaration)) return undefined;
  // `export { open }` and `export default logRepas` give alias symbols: read
  // the value each one names.
  const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
  if (!(target.flags & ts.SymbolFlags.Value)) return undefined;
  if (symbol.name !== ts.InternalSymbolName.Default) return symbol.name;
  // A spec imports a default export under the name the export statement or
  // the declaration gives it.
  if (ts.isExportSpecifier(declaration)) return (declaration.propertyName ?? declaration.name).text;
  const name = ts.isExportAssignment(declaration)
    ? declaration.expression
    : ts.getNameOfDeclaration(declaration);
  return name && ts.isIdentifier(name) ? name.text : undefined;
}

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

  // A helper can share its name with a global of the e2e program, such as
  // DOM's open, or with a global that a declaration file under e2e/ adds. A
  // spec that uses it without an import then resolves to that global, and
  // check passes. The probe runs in the program check builds, so it sees the
  // same globals.
  it('leaves each helper unresolved in a spec that does not import it', () => {
    const host = ts.createCompilerHost(options);
    const checkProgram = ts.createProgram(fileNames, options, host);
    const checker = checkProgram.getTypeChecker();
    const helpersModule = checker.getSymbolAtLocation(checkProgram.getSourceFile(helpersPath)!)!;
    const helpers = [
      ...new Set(
        checker
          .getExportsOfModule(helpersModule)
          .map((symbol) => specName(checker, symbol))
          .filter((name) => name !== undefined)
      )
    ];
    expect(helpers).toContain('logRepas');

    const probePath = path.join(repo, 'e2e/unimported-helpers.probe.ts');
    const probe = `export {};\n${helpers.map((name) => `void ${name};`).join('\n')}\n`;
    const { fileExists, getSourceFile } = host;
    host.fileExists = (file) => file === probePath || fileExists.call(host, file);
    host.getSourceFile = (file, languageVersion, ...rest) =>
      file === probePath
        ? ts.createSourceFile(file, probe, languageVersion)
        : getSourceFile.call(host, file, languageVersion, ...rest);
    const program = ts.createProgram([...fileNames, probePath], options, host, checkProgram);
    const probeChecker = program.getTypeChecker();
    const probed = program
      .getSourceFile(probePath)!
      .statements.filter(ts.isExpressionStatement)
      .map((statement) => (statement.expression as ts.VoidExpression).expression as ts.Identifier);
    expect(probed.map((identifier) => identifier.text)).toEqual(helpers);
    const resolved = probed
      .filter((identifier) => probeChecker.getSymbolAtLocation(identifier) !== undefined)
      .map((identifier) => identifier.text);
    expect(resolved).toEqual([]);
  }, 30_000);
});

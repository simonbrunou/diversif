// eslint.config.js bans process.stdout.write and process.stderr.write in the
// scripts under scripts/: Bun drops what such a write has not handed the pipe
// yet when process.exit runs (#683).
import { describe, expect, it } from 'bun:test';
import { ESLint } from 'eslint';

const eslint = new ESLint({ cwd: new URL('..', import.meta.url).pathname });

/** @param {string} code */
const lint = async (code, filePath = 'scripts/probe.ts') => {
  const [result] = await eslint.lintText(`${code}\n`, { filePath });
  return result.messages.map(({ ruleId, line, severity, message }) => ({
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
  message: expect.stringMatching(/^Print with console\.log or console\.error: .*\(#683\)\.$/)
});

describe('eslint.config.js', () => {
  it.each(['stdout', 'stderr'])('reports process.%s.write in a script', async (stream) => {
    expect(await lint(`process.${stream}.write('a');`)).toEqual([banned(1)]);
  });

  it.each([
    ['imported from node:process', "import { stderr } from 'node:process';\nstderr.write('a');", 2],
    ['destructured from process', "const { stdout } = process;\nstdout.write('a');", 2],
    ['taken without a call', "const write = process.stderr.write;\nwrite('a');", 1]
  ])('reports a write on a stream %s', async (_, code, line) => {
    expect(await lint(code)).toEqual([banned(line)]);
  });

  it('honours a disable comment on the next line', async () => {
    const disable = '// eslint-disable-next-line no-restricted-syntax -- a probe';
    expect(await lint(`${disable}\nprocess.stdout.write('a');`)).toEqual([]);
  });

  it.each([
    ['console.log and console.error', "console.log('a');\nconsole.error('a');", 'scripts/probe.ts'],
    ['another property of a stream', 'console.log(process.stdout.isTTY);', 'scripts/probe.ts'],
    [
      "a child process's stdin",
      "Bun.spawn(['cat'], { stdin: 'pipe' }).stdin.write('a');",
      'scripts/probe.ts'
    ],
    ['a file outside scripts/', "process.stdout.write('a');", 'src/lib/probe.ts']
  ])('leaves %s alone', async (_, code, filePath) => {
    expect(await lint(code, filePath)).toEqual([]);
  });
});

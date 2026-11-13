// knip.json fails knip on any configuration hint (#736). Knip exits 0 on a
// hint unless `treatConfigHintsAsErrors` is on, so before #736 three hints
// sat in CI's Knip job output with nothing reporting them. Each case below
// runs knip on a copy of knip.json that brings back one of those hints and
// expects exit 1. `--max-issues` keeps ordinary findings (the four
// stylesheet packages knip reports unused once it stops reading .css files)
// from setting the exit code, so only the hint can. Knip needs the files
// that `bun run test` generates first (paraglide's messages, SvelteKit's
// $types). One run takes about 1.5 s locally: the 30 s budget leaves room
// for a busy runner.
import { afterAll, describe, expect, it } from 'bun:test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const repo = path.join(import.meta.dir, '..');
const KNIP = path.join(repo, 'node_modules/knip/bin/knip-bun.js');
const TIMEOUT = 30_000;

type KnipConfig = {
  treatConfigHintsAsErrors?: boolean;
  entry: string[];
  project: string[];
  ignoreDependencies: string[];
};

const config = JSON.parse(fs.readFileSync(path.join(repo, 'knip.json'), 'utf8')) as KnipConfig;
const PROJECT = 'src/**/*.{ts,js,svelte,css}!';

const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'knip-config-'));
afterAll(() => fs.rmSync(scratch, { recursive: true, force: true }));

// FORCE_COLOR=1 in the caller's environment wraps knip's table header in
// escape codes, which the header match below would miss.
const env: Record<string, string | undefined> = { ...process.env, NO_COLOR: '1' };
delete env.FORCE_COLOR;

/** Runs knip from the repo root on `variant` of knip.json. */
function knip(name: string, variant: KnipConfig): { exitCode: number; output: string } {
  const file = path.join(scratch, `${name}.json`);
  fs.writeFileSync(file, JSON.stringify(variant));
  const proc = Bun.spawnSync(
    [process.execPath, KNIP, '--config', file, '--max-issues', '1000', '--no-progress'],
    { cwd: repo, env }
  );
  return { exitCode: proc.exitCode, output: `${proc.stdout}${proc.stderr}` };
}

describe('knip.json', () => {
  // Each case below differs from knip.json by its one change only while
  // these hold.
  it('sets treatConfigHintsAsErrors and reads .css files under src/', () => {
    expect(config.treatConfigHintsAsErrors).toBe(true);
    expect(config.project).toEqual([PROJECT]);
  });

  // The control: with `--max-issues` set high, exit 0 means no hint. Other
  // findings fail CI's Knip job, not this test.
  it(
    'gives no hint as it stands',
    () => {
      const { exitCode, output } = knip('as-is', config);
      expect(output).not.toContain('Configuration hints');
      expect(exitCode).toBe(0);
    },
    TIMEOUT
  );

  // Knip's hint table cuts long cells short, so each case asserts on the
  // hint's identifier, the first column of a row under the table's
  // header, not on its message.
  it.each([
    [
      'svelte-check in ignoreDependencies',
      'svelte-check',
      { ...config, ignoreDependencies: [...config.ignoreDependencies, 'svelte-check'] }
    ],
    [
      'src/hooks.ts! in entry, which the SvelteKit plugin already adds',
      'src/hooks.ts!',
      { ...config, entry: [...config.entry, 'src/hooks.ts!'] }
    ],
    [
      'a project pattern without css',
      '.css',
      { ...config, project: [PROJECT.replace(',css}', '}')] }
    ]
  ])(
    'exits 1 on the hint for %s',
    (_name, identifier, variant) => {
      const { exitCode, output } = knip(identifier.replace(/\W/g, '_'), variant);
      const [, table] = output.split(/^Configuration hints \(\d+\)$/m);
      expect(table?.split('\n').map((row) => row.split(' ')[0])).toContain(identifier);
      expect(exitCode).toBe(1);
    },
    TIMEOUT
  );
});

// railpack.json against the Railpack behaviour that keeps devDependencies out
// of the production image (#529). With RAILPACK_PRUNE_DEPS=true on the Coolify
// app, Railpack's `prune` step reinstalls node_modules with
// `bun install --production`. A config step with no `deployOutputs` adds its
// whole /app as the last deploy layer, though, and the `install` step's /app
// holds every devDependency, so that layer would land on top of the pruned
// node_modules. `deployOutputs: []` keeps it out. JSON holds no comments, so
// this test carries the reason: docs/agents/deploy.md ("Build") has the rest.
import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const repo = path.resolve(import.meta.dir, '..');
const config = JSON.parse(readFileSync(path.join(repo, 'railpack.json'), 'utf8'));

describe('railpack.json', () => {
  it('adds no deploy layer from the install step, so the pruned node_modules ship', () => {
    expect(config.steps?.install?.deployOutputs).toEqual([]);
  });

  it('keeps HUSKY=0 on the install step', () => {
    expect(config.steps?.install?.variables?.HUSKY).toBe('0');
  });
});

import { describe, expect, it, mock } from 'bun:test';

const startReplay = mock(() => {});
mock.module('$lib/sentry-replay', () => ({ startReplay }));

const { loadReplay } = await import('./sentry-replay-loader');

describe('loadReplay', () => {
  it('starts Replay once however many callers wait on it', async () => {
    // hooks.client.ts at startup and a problem report can both ask.
    await Promise.all([loadReplay(), loadReplay()]);
    await loadReplay();
    expect(startReplay).toHaveBeenCalledTimes(1);
  });
});

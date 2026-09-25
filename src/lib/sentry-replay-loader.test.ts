import { describe, expect, it, mock } from 'bun:test';

let failNext = false;
const startReplay = mock(() => {
  if (failNext) {
    failNext = false;
    throw new Error('Failed to fetch dynamically imported module');
  }
});
mock.module('$lib/sentry-replay', () => ({ startReplay }));

const { loadReplay } = await import('./sentry-replay-loader');

// Order matters: the module caches a successful load for the page's lifetime.
describe('loadReplay', () => {
  it('resolves after a failed load and tries again on the next call', async () => {
    failNext = true;
    await loadReplay();
    expect(startReplay).toHaveBeenCalledTimes(1);

    await loadReplay();
    expect(startReplay).toHaveBeenCalledTimes(2);
  });

  it('starts Replay once however many callers wait on it after a success', async () => {
    // hooks.client.ts at startup and a problem report can both ask.
    await Promise.all([loadReplay(), loadReplay()]);
    await loadReplay();
    expect(startReplay).toHaveBeenCalledTimes(2);
  });
});

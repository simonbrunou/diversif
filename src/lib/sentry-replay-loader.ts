let loading: Promise<void> | undefined;

/**
 * Load and start Session Replay once. The recorder (~100 KB) is code-split out
 * of the entry chunk: hooks.client.ts starts the load right after init, and a
 * problem report awaits the same promise so Replay cannot begin buffering
 * mid-report. Never rejects: a failed load (e.g. the chunk request dropped
 * offline) just means no replay for now, and the next call tries again.
 */
export function loadReplay(): Promise<void> {
  loading ??= import('$lib/sentry-replay')
    .then(({ startReplay }) => startReplay())
    .catch(() => {
      loading = undefined;
    });
  return loading;
}

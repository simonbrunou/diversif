let loading: Promise<void> | undefined;

/**
 * Load and start Session Replay once. The recorder (~100 KB) is code-split out
 * of the entry chunk: hooks.client.ts starts the load right after init, and a
 * problem report awaits the same promise so Replay cannot begin buffering
 * mid-report. Never rejects — a failed chunk load just means no replay.
 */
export function loadReplay(): Promise<void> {
  loading ??= import('$lib/sentry-replay').then(
    ({ startReplay }) => startReplay(),
    () => {}
  );
  return loading;
}

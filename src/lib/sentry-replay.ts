import * as Sentry from '@sentry/sveltekit';
import { replayOptions } from '#lib/sentry-policy.js';

/**
 * Add Session Replay to the already-initialised browser SDK. Reached only
 * through a dynamic import in hooks.client.ts, which keeps the recorder
 * (~100 KB) out of the entry chunk; what it masks and scrubs is
 * #lib/sentry-policy.ts's replayOptions, and the sample rates it obeys are
 * the `replays*SampleRate` options passed to Sentry.init.
 */
export function startReplay(): void {
  Sentry.addIntegration(Sentry.replayIntegration(replayOptions));
}

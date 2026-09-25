import * as Sentry from '@sentry/sveltekit';
import { scrubRecordingEvent } from '$lib/sentry';

/**
 * Add Session Replay to the already-initialised browser SDK. Reached only
 * through a dynamic import in hooks.client.ts, which keeps the recorder
 * (~100 KB) out of the entry chunk; the sample rates it obeys are the
 * `replays*SampleRate` options passed to Sentry.init there.
 */
export function startReplay(): void {
  Sentry.addIntegration(
    Sentry.replayIntegration({
      // The SDK defaults, restated because they are the privacy contract:
      // every text node, input value and image/SVG is masked or blocked.
      maskAllText: true,
      maskAllInputs: true,
      blockAllMedia: true,
      // Default masked attributes plus the ones that carry child/entry ids,
      // dates or food names in this app's markup.
      maskAttributes: [
        'title',
        'placeholder',
        'aria-label',
        'alt',
        'href',
        'action',
        'value',
        'datetime'
      ],
      // Keep the replay session in memory only — nothing is written to
      // sessionStorage, so the three strictly-necessary cookies stay the only
      // client-side storage (see /cookies).
      stickySession: false,
      // networkDetailAllowUrls stays at its empty default: no request or
      // response bodies/headers are recorded.
      beforeAddRecordingEvent: scrubRecordingEvent
    })
  );
}

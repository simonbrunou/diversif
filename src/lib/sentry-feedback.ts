import * as Sentry from '@sentry/sveltekit';
import { loadReplay } from '$lib/sentry-replay-loader';

/**
 * Send a « Signaler un problème » report to Sentry as user feedback: the
 * message the parent typed, the page URL (scrubbed by scrubEvent's feedback
 * branch) and `tags` — e.g. the errorId shown on the error page, which links
 * the report to the matching Sentry issue. Resolves once Sentry accepted it;
 * rejects otherwise.
 *
 * The form is our own (ProblemReportDialog) rather than Sentry's widget,
 * because Replay uploads its buffered recording whenever that widget opens
 * and whenever any feedback event is processed. The privacy policy promises
 * that only an error triggers a recording, so a Replay that is merely
 * buffering (no error yet) is stopped — its buffer discarded, nothing sent —
 * while the report goes out, then buffering resumes. A recording an error
 * already started keeps running and the report is linked to it.
 */
export async function sendProblemReport(
  message: string,
  tags: Record<string, string> = {}
): Promise<void> {
  // Replay is code-split; wait for it so it cannot start buffering mid-report.
  await loadReplay();
  const replay = Sentry.getReplay();
  const bufferingReplay = replay?.getRecordingMode() === 'buffer' ? replay : undefined;
  await bufferingReplay?.stop({ flush: false });
  try {
    // captureFeedback puts `tags` on the feedback event itself; sendFeedback
    // also copies them onto the current scope, where they would tag every
    // later event on the page. It runs in a forked scope, synchronously — an
    // async callback would keep that scope current until the send settles.
    let sending: Promise<unknown> = Promise.resolve();
    Sentry.withScope(() => {
      sending = Sentry.sendFeedback({ message, tags }, { includeReplay: false });
    });
    await sending;
  } finally {
    bufferingReplay?.startBuffering();
  }
}

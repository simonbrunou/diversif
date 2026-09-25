import * as Sentry from '@sentry/sveltekit';
import * as m from '$lib/paraglide/messages';

/**
 * Open Sentry's user-feedback dialog (« Signaler un problème »).
 *
 * Only ever reached through a dynamic import from the UI, so the widget's code
 * is fetched the first time a parent opens it rather than shipping in every
 * page's bundle.
 *
 * Privacy: the name/e-mail fields and screenshots are disabled, so a report
 * carries the message the parent chose to type, the scrubbed page route (see
 * scrubEvent's feedback branch) and `tags` — e.g. the errorId shown on the
 * error page, which links the report to the matching Sentry issue.
 *
 * Replay's own event processor sends its buffered recording along with any
 * feedback event and then records the rest of the page view. The privacy
 * policy promises that only an error triggers a recording, so while Replay is
 * merely buffering (no error yet) it is stopped for as long as the dialog is
 * open — the buffer is discarded, nothing is sent — and buffering resumes once
 * the dialog is dismissed or the report has been sent. A recording an error
 * already started keeps running, and the report is linked to it.
 */
export async function openFeedbackForm(tags: Record<string, string> = {}): Promise<void> {
  const replay = Sentry.getReplay();
  const bufferingReplay = replay?.getRecordingMode() === 'buffer' ? replay : undefined;
  await bufferingReplay?.stop({ flush: false });
  const resumeReplay = () => bufferingReplay?.startBuffering();

  let feedback = Sentry.getFeedback();
  if (!feedback) {
    feedback = Sentry.feedbackIntegration({
      autoInject: false,
      showBranding: false,
      showName: false,
      showEmail: false,
      enableScreenshot: false,
      // The dialog is themed from app.css through the widget's --dialog-* /
      // --button-* / --input-* variables, which already follow the app's own
      // light/dark switch; 'light' just stops the widget's prefers-color-scheme
      // defaults from fighting it.
      colorScheme: 'light'
    });
    Sentry.addIntegration(feedback);
  }

  const genericError = m.feedbackErrorGeneric();
  const form = await feedback.createForm({
    tags,
    formTitle: m.feedbackReportProblem(),
    messageLabel: m.feedbackMessageLabel(),
    messagePlaceholder: m.feedbackMessagePlaceholder(),
    isRequiredLabel: m.feedbackRequiredLabel(),
    submitButtonLabel: m.feedbackSubmit(),
    cancelButtonLabel: m.commonCancel(),
    successMessageText: m.feedbackSuccess(),
    errorEmptyMessageText: m.feedbackErrorEmpty(),
    errorTimeoutText: genericError,
    errorForbiddenText: genericError,
    errorNoClientText: genericError,
    errorGenericText: genericError,
    // A fresh dialog is built per opening (labels follow the current locale);
    // drop it from the DOM once dismissed or sent. Both callbacks run after
    // the feedback event has been processed and sent.
    onFormClose: () => {
      form.removeFromDom();
      resumeReplay();
    },
    onFormSubmitted: () => {
      form.removeFromDom();
      resumeReplay();
    }
  });
  form.appendToDom();
  form.open();
}

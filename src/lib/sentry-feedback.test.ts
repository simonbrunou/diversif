import { beforeEach, describe, expect, it, mock } from 'bun:test';
import * as m from '$lib/paraglide/messages';

type FormOptions = Record<string, unknown> & {
  onFormClose: () => void;
  onFormSubmitted: () => void;
};

// Ordered record of the side effects the privacy contract depends on.
const log: string[] = [];
const form = {
  appendToDom: mock(),
  open: mock(() => log.push('open')),
  removeFromDom: mock()
};
const createForm = mock(async (_options: FormOptions) => form);
const feedbackIntegration = mock((_options: Record<string, unknown>) => ({ createForm }));
let installed: { createForm: typeof createForm } | undefined;
const addIntegration = mock((integration: { createForm: typeof createForm }) => {
  installed = integration;
});
let recordingMode: 'buffer' | 'session' | undefined;
const replay = {
  getRecordingMode: () => recordingMode,
  stop: mock(async (_options: { flush: boolean }) => {
    log.push('replay.stop');
  }),
  startBuffering: mock(() => {
    log.push('replay.startBuffering');
  })
};
let replayInstalled = false;

// Registered before sentry-feedback.ts is first loaded so the stand-in is the
// whole module; a static import would be hoisted above mock.module.
mock.module('@sentry/sveltekit', () => ({
  getFeedback: () => installed,
  getReplay: () => (replayInstalled ? replay : undefined),
  feedbackIntegration,
  addIntegration
}));

const { openFeedbackForm } = await import('./sentry-feedback');

beforeEach(() => {
  installed = undefined;
  replayInstalled = false;
  recordingMode = undefined;
  log.length = 0;
  for (const fn of [
    createForm,
    feedbackIntegration,
    addIntegration,
    form.appendToDom,
    form.open,
    form.removeFromDom,
    replay.stop,
    replay.startBuffering
  ]) {
    fn.mockClear();
  }
});

describe('openFeedbackForm', () => {
  it('installs the widget without name, e-mail or screenshot fields', async () => {
    await openFeedbackForm();
    expect(feedbackIntegration).toHaveBeenCalledWith(
      expect.objectContaining({
        autoInject: false,
        showName: false,
        showEmail: false,
        enableScreenshot: false
      })
    );
    expect(addIntegration).toHaveBeenCalledTimes(1);
  });

  it('opens a French dialog tagged with the error it reports', async () => {
    await openFeedbackForm({ errorId: 'abcd1234' });
    expect(createForm).toHaveBeenCalledWith(
      expect.objectContaining({
        tags: { errorId: 'abcd1234' },
        formTitle: m.feedbackReportProblem(),
        submitButtonLabel: m.feedbackSubmit(),
        cancelButtonLabel: m.commonCancel()
      })
    );
    expect(form.appendToDom).toHaveBeenCalledTimes(1);
    expect(form.open).toHaveBeenCalledTimes(1);
  });

  it('reuses the installed widget on later openings', async () => {
    await openFeedbackForm();
    await openFeedbackForm();
    expect(feedbackIntegration).toHaveBeenCalledTimes(1);
    expect(addIntegration).toHaveBeenCalledTimes(1);
    expect(createForm).toHaveBeenCalledTimes(2);
  });

  it('takes the dialog out of the DOM once it is dismissed', async () => {
    await openFeedbackForm();
    createForm.mock.calls[0][0].onFormClose();
    expect(form.removeFromDom).toHaveBeenCalledTimes(1);
  });

  for (const callback of ['onFormClose', 'onFormSubmitted'] as const) {
    it(`discards a buffering replay while open and resumes it after ${callback}`, async () => {
      replayInstalled = true;
      recordingMode = 'buffer';
      await openFeedbackForm();
      // Stopped without flushing before the dialog shows, so the feedback
      // event cannot carry the pre-report recording to Sentry.
      expect(replay.stop).toHaveBeenCalledWith({ flush: false });
      expect(log).toEqual(['replay.stop', 'open']);

      createForm.mock.calls[0][0][callback]();
      expect(log).toEqual(['replay.stop', 'open', 'replay.startBuffering']);
    });
  }

  it('leaves a replay that an error already started recording untouched', async () => {
    replayInstalled = true;
    recordingMode = 'session';
    await openFeedbackForm();
    createForm.mock.calls[0][0].onFormSubmitted();
    expect(replay.stop).not.toHaveBeenCalled();
    expect(replay.startBuffering).not.toHaveBeenCalled();
  });
});

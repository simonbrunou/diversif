import { beforeEach, describe, expect, it, mock } from 'bun:test';

// Ordered record of the side effects the privacy contract depends on.
const log: string[] = [];
let sendFails = false;
const sendFeedback = mock(async (_params: unknown, _hint: unknown) => {
  log.push('sendFeedback');
  if (sendFails) throw new Error('Unable to send feedback');
  return 'event-id';
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

// Registered before sentry-feedback.ts is first loaded so the stand-ins are
// the whole modules; a static import would be hoisted above mock.module.
mock.module('@sentry/sveltekit', () => ({
  getReplay: () => (replayInstalled ? replay : undefined),
  withScope: <T>(callback: () => T) => callback(),
  sendFeedback
}));
mock.module('$lib/sentry-replay-loader', () => ({
  loadReplay: async () => {
    log.push('loadReplay');
  }
}));

const { sendProblemReport } = await import('./sentry-feedback');

beforeEach(() => {
  log.length = 0;
  sendFails = false;
  replayInstalled = false;
  recordingMode = undefined;
  for (const fn of [sendFeedback, replay.stop, replay.startBuffering]) fn.mockClear();
});

describe('sendProblemReport', () => {
  it('sends the message and tags as feedback without asking for a replay', async () => {
    await sendProblemReport('Le bouton ne répond pas', { errorId: 'abcd1234' });
    expect(sendFeedback).toHaveBeenCalledWith(
      { message: 'Le bouton ne répond pas', tags: { errorId: 'abcd1234' } },
      { includeReplay: false }
    );
  });

  it('discards a buffering replay while the report is sent, then resumes buffering', async () => {
    replayInstalled = true;
    recordingMode = 'buffer';
    await sendProblemReport('x');
    expect(replay.stop).toHaveBeenCalledWith({ flush: false });
    // Replay finished loading first, so it cannot start buffering mid-report.
    expect(log).toEqual(['loadReplay', 'replay.stop', 'sendFeedback', 'replay.startBuffering']);
  });

  it('resumes buffering and rejects when sending fails', async () => {
    replayInstalled = true;
    recordingMode = 'buffer';
    sendFails = true;
    await expect(sendProblemReport('x')).rejects.toThrow('Unable to send feedback');
    expect(log.at(-1)).toBe('replay.startBuffering');
  });

  it('leaves a replay that an error already started recording untouched', async () => {
    replayInstalled = true;
    recordingMode = 'session';
    await sendProblemReport('x');
    expect(replay.stop).not.toHaveBeenCalled();
    expect(replay.startBuffering).not.toHaveBeenCalled();
  });
});

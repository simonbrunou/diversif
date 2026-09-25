import { expect, it, mock } from 'bun:test';
import * as Sentry from '@sentry/sveltekit';

// Against the real browser SDK (sentry-feedback.test.ts stubs it): whether
// tags leak depends on how the SDK's scope stack treats withScope callbacks.
mock.module('$lib/sentry-replay-loader', () => ({ loadReplay: async () => {} }));

type Sent = { type: string; tags?: Record<string, string> };

it('keeps a report’s errorId off events captured while the report is in flight', async () => {
  const sent: Sent[] = [];
  const { promise: feedbackAtTransport, resolve: feedbackArrived } = Promise.withResolvers<void>();
  const { promise: eventAtTransport, resolve: eventArrived } = Promise.withResolvers<void>();
  const { promise: feedbackAccepted, resolve: acceptFeedback } = Promise.withResolvers<void>();
  Sentry.init({
    dsn: 'https://key@o1.ingest.sentry.io/1',
    defaultIntegrations: false,
    transport: () => ({
      send: async (envelope) => {
        for (const [header, payload] of envelope[1]) {
          const { tags } = payload as { tags?: Record<string, string> };
          sent.push({ type: header.type, tags });
          if (header.type === 'feedback') {
            feedbackArrived();
            // Hold the response so the report stays in flight.
            await feedbackAccepted;
          } else {
            eventArrived();
          }
        }
        return { statusCode: 200 };
      },
      flush: async () => true
    })
  });
  const { sendProblemReport } = await import('./sentry-feedback');

  const report = sendProblemReport('Écran blanc', { errorId: 'abcd1234' });
  await feedbackAtTransport;
  Sentry.captureMessage('unrelated');
  await eventAtTransport;
  acceptFeedback();
  await report;

  expect(sent).toEqual([
    { type: 'feedback', tags: { errorId: 'abcd1234' } },
    { type: 'event', tags: undefined }
  ]);
});

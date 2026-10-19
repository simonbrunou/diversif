import { describe, expect, it, mock } from 'bun:test';

const recoverFromFailedBootMock = mock();

// hooks.client.ts calls Sentry.init at import, so the stand-ins must be
// registered before it loads; a static import would be hoisted above
// mock.module, hence the dynamic import below. No DSN: Replay stays off. What
// the SDK reports is tested in src/lib/sentry-policy.client.sdk.test.ts.
mock.module('@sentry/sveltekit', () => ({
  init: mock(),
  browserTracingIntegration: mock(() => ({})),
  withStaticSpan: <T>(callback: T) => callback
}));
mock.module('$app/env/public', () => ({
  PUBLIC_SENTRY_DSN: '',
  PUBLIC_SENTRY_ENVIRONMENT: '',
  PUBLIC_SENTRY_TRACES_SAMPLE_RATE: '',
  PUBLIC_SENTRY_REPLAYS_SESSION_SAMPLE_RATE: '',
  PUBLIC_SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: ''
}));
mock.module('#lib/boot-recovery.js', () => ({ recoverFromFailedBoot: recoverFromFailedBootMock }));

await import('./hooks.client');

describe('client unhandledrejection listener', () => {
  it('hands every rejection reason to boot recovery, which picks the network failures', () => {
    const reasons = [
      new TypeError('Failed to fetch dynamically imported module: …/nodes/0.x.js'),
      new RangeError('Invalid time value'),
      'not even an Error'
    ];

    for (const reason of reasons) {
      window.dispatchEvent(Object.assign(new Event('unhandledrejection'), { reason }));
    }

    expect(recoverFromFailedBootMock.mock.calls).toEqual(reasons.map((reason) => [reason]));
  });
});

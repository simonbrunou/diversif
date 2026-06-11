import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../../test/db';
import { captureFlow, makeRouteEvent } from '../../../../test/route';

mock.module('$lib/server/db', () => ({ db: testDb }));

const mocks = {
  generateRegistrationOptions: mock(),
  verifyRegistrationResponse: mock(),
  generateAuthenticationOptions: mock(),
  verifyAuthenticationResponse: mock()
};
mock.module('@simplewebauthn/server', () => mocks);

import { POST } from './+server';
import { webauthnChallenges } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import {
  PASSKEY_CHALLENGE_AUTOFILL_COOKIE,
  PASSKEY_CHALLENGE_COOKIE,
  RP_ID
} from '$lib/server/passkeys';
import { _clearAllRateLimits } from '$lib/server/rate-limit';

beforeEach(async () => {
  await resetTestDb();
  mocks.generateAuthenticationOptions.mockReset();
  _clearAllRateLimits();
});

describe('POST /passkeys/authentication/options', () => {
  function makeModalEvent() {
    return makeRouteEvent({
      url: 'https://diversif.app/passkeys/authentication/options'
    });
  }

  it('errors 500 when the request origin is outside the RP ID scope', async () => {
    const event = makeRouteEvent({ url: 'https://evil.example/passkeys/authentication/options' });
    const r = await captureFlow(
      () => POST(event as unknown as Parameters<typeof POST>[0]) as unknown as Promise<Response>
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.status).toBe(500);
    expect(await testDb.select().from(webauthnChallenges)).toHaveLength(0);
  });

  it('issues anonymous options and stores the challenge', async () => {
    mocks.generateAuthenticationOptions.mockResolvedValue({ challenge: 'sign-me' });
    const event = makeModalEvent();
    const res = (await POST(event as unknown as Parameters<typeof POST>[0])) as unknown as Response;
    const body = await res.json();
    expect(body.challenge).toBe('sign-me');
    expect(event.cookies.set).toHaveBeenCalled();
    const [name, token] = event.cookies.set.mock.calls[0];
    expect(name).toBe(PASSKEY_CHALLENGE_COOKIE);
    const stored = (
      await testDb
        .select()
        .from(webauthnChallenges)
        .where(eq(webauthnChallenges.token, token as string))
        .limit(1)
    )[0];
    expect(stored?.purpose).toBe('authentication');
    expect(stored?.userId).toBeNull();
    expect(mocks.generateAuthenticationOptions.mock.calls[0][0].rpID).toBe(RP_ID);
  });

  it('marks the cookie secure in production', async () => {
    mocks.generateAuthenticationOptions.mockResolvedValue({ challenge: 'x' });
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const event = makeModalEvent();
      await POST(event as unknown as Parameters<typeof POST>[0]);
      const opts = event.cookies.set.mock.calls[0][2] as { secure: boolean };
      expect(opts.secure).toBe(true);
    } finally {
      process.env.NODE_ENV = orig;
    }
  });

  it('returns 429 when the per-IP rate limit is exceeded', async () => {
    mocks.generateAuthenticationOptions.mockResolvedValue({ challenge: 'x' });
    // Saturate the passkey-auth-options bucket (limit 20 per 5 minutes).
    for (let i = 0; i < 20; i++) {
      const event = makeModalEvent();
      await POST(event as unknown as Parameters<typeof POST>[0]);
    }
    const event = makeModalEvent();
    const r = await captureFlow(
      () => POST(event as unknown as Parameters<typeof POST>[0]) as unknown as Promise<Response>
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.status).toBe(429);
  });

  function makeAutofillEvent() {
    const event = makeRouteEvent({
      url: 'https://diversif.app/passkeys/authentication/options'
    });
    (event as { request: Request }).request = new Request(event.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: 'autofill' })
    });
    return event;
  }

  it('writes to the autofill cookie when mode=autofill', async () => {
    mocks.generateAuthenticationOptions.mockResolvedValue({ challenge: 'auto' });
    const event = makeAutofillEvent();
    const res = (await POST(event as unknown as Parameters<typeof POST>[0])) as unknown as Response;
    expect(res.status).toBe(200);
    const cookieNames = event.cookies.set.mock.calls.map((c) => c[0]);
    expect(cookieNames).toContain(PASSKEY_CHALLENGE_AUTOFILL_COOKIE);
    expect(cookieNames).not.toContain(PASSKEY_CHALLENGE_COOKIE);
    const token = event.cookies.set.mock.calls.find(
      (c) => c[0] === PASSKEY_CHALLENGE_AUTOFILL_COOKIE
    )?.[1] as string;
    const stored = (
      await testDb
        .select()
        .from(webauthnChallenges)
        .where(eq(webauthnChallenges.token, token))
        .limit(1)
    )[0];
    expect(stored?.purpose).toBe('authentication');
  });

  it('autofill mode has its own rate-limit bucket', async () => {
    mocks.generateAuthenticationOptions.mockResolvedValue({ challenge: 'x' });
    // Saturate the modal bucket (limit 20 per 5 minutes).
    for (let i = 0; i < 20; i++) {
      const event = makeModalEvent();
      await POST(event as unknown as Parameters<typeof POST>[0]);
    }
    // Autofill must still succeed despite the modal bucket being full.
    const event = makeAutofillEvent();
    const res = (await POST(event as unknown as Parameters<typeof POST>[0])) as unknown as Response;
    expect(res.status).toBe(200);
  });

  it('falls back to modal cookie when the JSON body is malformed', async () => {
    mocks.generateAuthenticationOptions.mockResolvedValue({ challenge: 'x' });
    const event = makeRouteEvent({
      url: 'https://diversif.app/passkeys/authentication/options'
    });
    (event as { request: Request }).request = new Request(event.url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json'
    });
    const res = (await POST(event as unknown as Parameters<typeof POST>[0])) as unknown as Response;
    expect(res.status).toBe(200);
    const cookieNames = event.cookies.set.mock.calls.map((c) => c[0]);
    expect(cookieNames).toContain(PASSKEY_CHALLENGE_COOKIE);
    expect(cookieNames).not.toContain(PASSKEY_CHALLENGE_AUTOFILL_COOKIE);
  });
});

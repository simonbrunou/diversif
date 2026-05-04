import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../../../test/db';
import { makeRouteEvent } from '../../../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

const mocks = vi.hoisted(() => ({
  generateRegistrationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyAuthenticationResponse: vi.fn()
}));
vi.mock('@simplewebauthn/server', () => mocks);

import { POST } from './+server';
import { webauthnChallenges } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { PASSKEY_CHALLENGE_COOKIE } from '$lib/server/passkeys';

beforeEach(() => {
  resetTestDb();
  mocks.generateAuthenticationOptions.mockReset();
});

describe('POST /passkeys/authentication/options', () => {
  it('issues anonymous options and stores the challenge', async () => {
    mocks.generateAuthenticationOptions.mockResolvedValue({ challenge: 'sign-me' });
    const event = makeRouteEvent({
      url: 'https://app.example.com/passkeys/authentication/options'
    });
    const res = (await POST(event as unknown as Parameters<typeof POST>[0])) as unknown as Response;
    const body = await res.json();
    expect(body.challenge).toBe('sign-me');
    expect(event.cookies.set).toHaveBeenCalled();
    const [name, token] = event.cookies.set.mock.calls[0];
    expect(name).toBe(PASSKEY_CHALLENGE_COOKIE);
    const stored = testDb
      .select()
      .from(webauthnChallenges)
      .where(eq(webauthnChallenges.token, token as string))
      .get();
    expect(stored?.purpose).toBe('authentication');
    expect(stored?.userId).toBeNull();
    expect(mocks.generateAuthenticationOptions.mock.calls[0][0].rpID).toBe('app.example.com');
  });

  it('marks the cookie secure in production', async () => {
    mocks.generateAuthenticationOptions.mockResolvedValue({ challenge: 'x' });
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const event = makeRouteEvent();
      await POST(event as unknown as Parameters<typeof POST>[0]);
      const opts = event.cookies.set.mock.calls[0][2] as { secure: boolean };
      expect(opts.secure).toBe(true);
    } finally {
      process.env.NODE_ENV = orig;
    }
  });

  it('honours the ORIGIN env override', async () => {
    mocks.generateAuthenticationOptions.mockResolvedValue({ challenge: 'x' });
    const orig = process.env.ORIGIN;
    process.env.ORIGIN = 'https://from-env.test';
    try {
      const event = makeRouteEvent();
      await POST(event as unknown as Parameters<typeof POST>[0]);
      expect(mocks.generateAuthenticationOptions.mock.calls[0][0].rpID).toBe('from-env.test');
    } finally {
      if (orig === undefined) delete process.env.ORIGIN;
      else process.env.ORIGIN = orig;
    }
  });
});

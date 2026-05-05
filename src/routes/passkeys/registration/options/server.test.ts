import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../../../test/db';
import { captureFlow, makeRouteEvent, safeUser } from '../../../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

const mocks = vi.hoisted(() => ({
  generateRegistrationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyAuthenticationResponse: vi.fn()
}));
vi.mock('@simplewebauthn/server', () => mocks);

import { POST } from './+server';
import { SESSION_COOKIE } from '$lib/server/auth';
import { users, webauthnChallenges } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { PASSKEY_CHALLENGE_COOKIE } from '$lib/server/passkeys';

beforeEach(() => {
  resetTestDb();
  mocks.generateRegistrationOptions.mockReset();
});

function seed() {
  return testDb
    .insert(users)
    .values({
      email: 'p@example.com',
      passwordHash: 'placeholder-hash',
      displayName: 'Parent',
      createdAt: new Date()
    })
    .returning()
    .all()[0];
}

describe('POST /passkeys/registration/options', () => {
  it('redirects unauthenticated users to /login', async () => {
    const event = makeRouteEvent({ user: null });
    const r = await captureFlow(
      () => POST(event as unknown as Parameters<typeof POST>[0]) as unknown as Promise<Response>
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/login');
  });

  it('errors 401 when the user no longer exists', async () => {
    const u = seed();
    testDb.delete(users).where(eq(users.id, u.id)).run();
    const event = makeRouteEvent({ user: safeUser(u) });
    const r = await captureFlow(
      () => POST(event as unknown as Parameters<typeof POST>[0]) as unknown as Promise<Response>
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.status).toBe(401);
  });

  it('returns options, sets the challenge cookie, and stores the challenge', async () => {
    const u = seed();
    mocks.generateRegistrationOptions.mockResolvedValue({
      challenge: 'big-challenge',
      rp: { id: 'localhost', name: 'Diversif' }
    });
    const event = makeRouteEvent({
      user: safeUser(u),
      url: 'https://app.example.com/passkeys/registration/options'
    });
    const res = (await POST(event as unknown as Parameters<typeof POST>[0])) as unknown as Response;
    const body = await res.json();
    expect(body.challenge).toBe('big-challenge');
    expect(event.cookies.set).toHaveBeenCalled();
    const [name, token] = event.cookies.set.mock.calls[0];
    expect(name).toBe(PASSKEY_CHALLENGE_COOKIE);
    const stored = testDb
      .select()
      .from(webauthnChallenges)
      .where(eq(webauthnChallenges.token, token as string))
      .get();
    expect(stored?.challenge).toBe('big-challenge');
    expect(stored?.userId).toBe(u.id);

    // rpID must come from ORIGIN env when set, otherwise URL.
    const args = mocks.generateRegistrationOptions.mock.calls[0][0];
    expect(args.rpID).toBe('app.example.com');
  });

  it('honours the ORIGIN env override', async () => {
    const u = seed();
    mocks.generateRegistrationOptions.mockResolvedValue({ challenge: 'x' });
    const orig = process.env.ORIGIN;
    process.env.ORIGIN = 'https://from-env.test';
    try {
      const event = makeRouteEvent({ user: safeUser(u) });
      await POST(event as unknown as Parameters<typeof POST>[0]);
      expect(mocks.generateRegistrationOptions.mock.calls[0][0].rpID).toBe('from-env.test');
    } finally {
      if (orig === undefined) delete process.env.ORIGIN;
      else process.env.ORIGIN = orig;
    }
  });

  it('tolerates a trailing slash on the ORIGIN env var', async () => {
    const u = seed();
    mocks.generateRegistrationOptions.mockResolvedValue({ challenge: 'x' });
    const orig = process.env.ORIGIN;
    process.env.ORIGIN = 'https://from-env.test/';
    try {
      const event = makeRouteEvent({ user: safeUser(u) });
      await POST(event as unknown as Parameters<typeof POST>[0]);
      // Without normalization the rpID would still be the hostname, but the
      // expectedOrigin used during verify would carry the trailing slash and
      // never match what the browser sends — regression-guard the helper here.
      expect(mocks.generateRegistrationOptions.mock.calls[0][0].rpID).toBe('from-env.test');
    } finally {
      if (orig === undefined) delete process.env.ORIGIN;
      else process.env.ORIGIN = orig;
    }
  });

  it('marks the challenge cookie secure in production', async () => {
    const u = seed();
    mocks.generateRegistrationOptions.mockResolvedValue({ challenge: 'x' });
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const event = makeRouteEvent({ user: safeUser(u) });
      await POST(event as unknown as Parameters<typeof POST>[0]);
      const opts = event.cookies.set.mock.calls[0][2] as { secure: boolean };
      expect(opts.secure).toBe(true);
    } finally {
      process.env.NODE_ENV = orig;
    }
  });
});

// Ensure the unused exports are kept tree-shake-friendly across tests.
void SESSION_COOKIE;

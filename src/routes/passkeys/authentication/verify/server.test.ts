import { describe, it, expect, beforeEach, vi } from 'vitest';
import { testDb, resetTestDb } from '../../../../test/db';
import { captureFlow, makeRouteEvent } from '../../../../test/route';

vi.mock('$lib/server/db', () => ({ db: testDb }));

const mocks = vi.hoisted(() => ({
  generateRegistrationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyAuthenticationResponse: vi.fn()
}));
vi.mock('@simplewebauthn/server', () => mocks);

import { POST } from './+server';
import { hashPassword, SESSION_COOKIE, validateSession } from '$lib/server/auth';
import { passkeys, sessions, users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { PASSKEY_CHALLENGE_COOKIE, createChallenge } from '$lib/server/passkeys';

beforeEach(() => {
  resetTestDb();
  mocks.verifyAuthenticationResponse.mockReset();
});

async function seedUserAndKey() {
  const passwordHash = await hashPassword('hunter2!');
  const u = testDb
    .insert(users)
    .values({
      email: 'p@example.com',
      passwordHash,
      displayName: 'Parent',
      createdAt: new Date()
    })
    .returning()
    .all()[0];
  testDb
    .insert(passkeys)
    .values({
      id: 'cred-id',
      userId: u.id,
      publicKey: 'cHVi',
      counter: 0,
      transports: '[]',
      deviceType: 'singleDevice',
      backedUp: false,
      name: 'Test',
      createdAt: new Date(),
      lastUsedAt: null
    })
    .run();
  return u;
}

function makeReq(opts: { body?: unknown; cookieToken?: string }) {
  const url = new URL('https://app.example.com/passkeys/authentication/verify');
  const event = makeRouteEvent();
  if (opts.cookieToken) event.cookies.set(PASSKEY_CHALLENGE_COOKIE, opts.cookieToken);
  (event as { request: Request }).request = new Request(url, {
    method: 'POST',
    body: typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body ?? {})
  });
  event.cookies.set.mockClear();
  event.cookies.delete.mockClear();
  return event;
}

describe('POST /passkeys/authentication/verify', () => {
  it('errors 400 on invalid JSON', async () => {
    const event = makeReq({ body: 'not json' });
    const r = await captureFlow(
      () => POST(event as unknown as Parameters<typeof POST>[0]) as unknown as Promise<Response>
    );
    expect(r.kind).toBe('error');
  });

  it('errors 400 on missing response', async () => {
    const event = makeReq({ body: {} });
    const r = await captureFlow(
      () => POST(event as unknown as Parameters<typeof POST>[0]) as unknown as Promise<Response>
    );
    expect(r.kind).toBe('error');
  });

  it('errors 400 when the challenge is missing', async () => {
    const event = makeReq({ body: { response: { id: 'x' } } });
    const r = await captureFlow(
      () => POST(event as unknown as Parameters<typeof POST>[0]) as unknown as Promise<Response>
    );
    expect(r.kind).toBe('error');
  });

  it('returns 400 when verification fails', async () => {
    await seedUserAndKey();
    const c = createChallenge({ challenge: 'ch', purpose: 'authentication' });
    mocks.verifyAuthenticationResponse.mockResolvedValue({ verified: false });
    const event = makeReq({
      body: { response: { id: 'cred-id' } },
      cookieToken: c.token
    });
    const res = (await POST(event as unknown as Parameters<typeof POST>[0])) as unknown as Response;
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    // No session cookie was issued.
    expect(event.cookies.set).not.toHaveBeenCalledWith(
      SESSION_COOKIE,
      expect.anything(),
      expect.anything()
    );
  });

  it('issues a session cookie on success', async () => {
    const u = await seedUserAndKey();
    const c = createChallenge({ challenge: 'ch', purpose: 'authentication' });
    mocks.verifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: {
        credentialID: 'cred-id',
        newCounter: 5,
        userVerified: true,
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: false,
        origin: 'https://app.example.com',
        rpID: 'app.example.com'
      }
    });
    const event = makeReq({
      body: { response: { id: 'cred-id' } },
      cookieToken: c.token
    });
    const res = (await POST(event as unknown as Parameters<typeof POST>[0])) as unknown as Response;
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    // A session row was created and a cookie set.
    const setCalls = event.cookies.set.mock.calls.filter((args) => args[0] === SESSION_COOKIE);
    expect(setCalls.length).toBe(1);
    const sessionToken = setCalls[0][1] as string;
    const validated = validateSession(sessionToken);
    expect(validated?.user.id).toBe(u.id);

    // Counter was bumped on the passkey.
    const updated = testDb.select().from(passkeys).where(eq(passkeys.id, 'cred-id')).get();
    expect(updated?.counter).toBe(5);

    // Sanity check session row exists.
    const row = testDb.select().from(sessions).where(eq(sessions.id, sessionToken)).get();
    expect(row?.userId).toBe(u.id);
  });

  it('marks the session cookie secure in production', async () => {
    await seedUserAndKey();
    const c = createChallenge({ challenge: 'ch', purpose: 'authentication' });
    mocks.verifyAuthenticationResponse.mockResolvedValue({
      verified: true,
      authenticationInfo: {
        credentialID: 'cred-id',
        newCounter: 1,
        userVerified: true,
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: false,
        origin: 'https://app.example.com',
        rpID: 'app.example.com'
      }
    });
    const orig = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const event = makeReq({
        body: { response: { id: 'cred-id' } },
        cookieToken: c.token
      });
      await POST(event as unknown as Parameters<typeof POST>[0]);
      const sessionCall = event.cookies.set.mock.calls.find((args) => args[0] === SESSION_COOKIE);
      expect((sessionCall?.[2] as { secure: boolean }).secure).toBe(true);
    } finally {
      process.env.NODE_ENV = orig;
    }
  });
});

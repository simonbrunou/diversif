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
import { users, webauthnChallenges, passkeys } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { PASSKEY_CHALLENGE_COOKIE, createChallenge } from '$lib/server/passkeys';

beforeEach(async () => {
  await resetTestDb();
  mocks.verifyRegistrationResponse.mockReset();
});

async function seedUser() {
  return (
    await testDb
      .insert(users)
      .values({
        email: 'p@example.com',
        passwordHash: 'placeholder-hash',
        displayName: 'Parent',
        createdAt: new Date()
      })
      .returning()
  )[0];
}

function makeReq(opts: {
  user?: ReturnType<typeof safeUser> | null;
  body?: unknown;
  cookieToken?: string;
}) {
  const url = new URL('https://app.example.com/passkeys/registration/verify');
  const cookieValues: Record<string, string> = {};
  if (opts.cookieToken) cookieValues[PASSKEY_CHALLENGE_COOKIE] = opts.cookieToken;
  const event = makeRouteEvent({ user: opts.user ?? null });
  // Override request with JSON body and cookies.
  (event as { request: Request }).request = new Request(url, {
    method: 'POST',
    body: typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body ?? {})
  });
  for (const [k, v] of Object.entries(cookieValues)) {
    event.cookies.set(k, v);
  }
  // Make subsequent set/delete calls observable from the assertion.
  event.cookies.set.mockClear();
  event.cookies.delete.mockClear();
  return event;
}

describe('POST /passkeys/registration/verify', () => {
  it('redirects guests to /login', async () => {
    const event = makeReq({ user: null });
    const r = await captureFlow(
      () => POST(event as unknown as Parameters<typeof POST>[0]) as unknown as Promise<Response>
    );
    expect(r.kind).toBe('redirect');
  });

  it('errors 400 on invalid JSON', async () => {
    const u = await seedUser();
    const event = makeReq({ user: safeUser(u), body: 'not json' });
    const r = await captureFlow(
      () => POST(event as unknown as Parameters<typeof POST>[0]) as unknown as Promise<Response>
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.status).toBe(400);
  });

  it('errors 400 when the response body is missing', async () => {
    const u = await seedUser();
    const event = makeReq({ user: safeUser(u), body: { name: 'X' } });
    const r = await captureFlow(
      () => POST(event as unknown as Parameters<typeof POST>[0]) as unknown as Promise<Response>
    );
    expect(r.kind).toBe('error');
    if (r.kind === 'error') expect(r.status).toBe(400);
  });

  it('errors 400 when the challenge cookie is missing', async () => {
    const u = await seedUser();
    const event = makeReq({
      user: safeUser(u),
      body: { response: { id: 'cred' } }
    });
    const r = await captureFlow(
      () => POST(event as unknown as Parameters<typeof POST>[0]) as unknown as Promise<Response>
    );
    expect(r.kind).toBe('error');
  });

  it('errors 400 when the challenge belongs to a different user', async () => {
    const u = await seedUser();
    const other = await testDb
      .insert(users)
      .values({
        email: 'b@example.com',
        passwordHash: 'h',
        displayName: 'B',
        createdAt: new Date()
      })
      .returning();
    const c = await createChallenge({
      challenge: 'ch',
      purpose: 'registration',
      userId: other[0].id
    });
    const event = makeReq({
      user: safeUser(u),
      body: { response: { id: 'cred' } },
      cookieToken: c.token
    });
    const r = await captureFlow(
      () => POST(event as unknown as Parameters<typeof POST>[0]) as unknown as Promise<Response>
    );
    expect(r.kind).toBe('error');
  });

  it('returns ok with the public passkey on success', async () => {
    const u = await seedUser();
    const c = await createChallenge({ challenge: 'ch', purpose: 'registration', userId: u.id });
    mocks.verifyRegistrationResponse.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: { id: 'new-cred', publicKey: new Uint8Array([1, 2]), counter: 1 },
        credentialDeviceType: 'multiDevice',
        credentialBackedUp: true
      }
    });
    const event = makeReq({
      user: safeUser(u),
      cookieToken: c.token,
      body: { response: { id: 'new-cred', response: {} }, name: 'My Phone' }
    });
    const res = (await POST(event as unknown as Parameters<typeof POST>[0])) as unknown as Response;
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.passkey.id).toBe('new-cred');
    expect(body.passkey.deviceType).toBe('multiDevice');
    const stored = (
      await testDb.select().from(passkeys).where(eq(passkeys.id, 'new-cred')).limit(1)
    )[0];
    expect(stored?.userId).toBe(u.id);
    // Challenge cookie was cleared.
    expect(event.cookies.delete).toHaveBeenCalled();
  });

  it('returns 400 when verification fails', async () => {
    const u = await seedUser();
    const c = await createChallenge({ challenge: 'ch', purpose: 'registration', userId: u.id });
    mocks.verifyRegistrationResponse.mockResolvedValue({ verified: false });
    const event = makeReq({
      user: safeUser(u),
      cookieToken: c.token,
      body: { response: { id: 'x', response: {} } }
    });
    const res = (await POST(event as unknown as Parameters<typeof POST>[0])) as unknown as Response;
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  it('removes the cookie on failure as well', async () => {
    const u = await seedUser();
    const c = await createChallenge({ challenge: 'ch', purpose: 'registration', userId: u.id });
    mocks.verifyRegistrationResponse.mockResolvedValue({ verified: false });
    const event = makeReq({
      user: safeUser(u),
      cookieToken: c.token,
      body: { response: { id: 'x', response: {} } }
    });
    await POST(event as unknown as Parameters<typeof POST>[0]);
    expect(event.cookies.delete).toHaveBeenCalledWith(PASSKEY_CHALLENGE_COOKIE, { path: '/' });
    const stillThere = (
      await testDb
        .select()
        .from(webauthnChallenges)
        .where(eq(webauthnChallenges.token, c.token))
        .limit(1)
    )[0];
    expect(stillThere).toBeUndefined();
  });

  it('falls back to a default name when none is provided', async () => {
    const u = await seedUser();
    const c = await createChallenge({ challenge: 'ch', purpose: 'registration', userId: u.id });
    mocks.verifyRegistrationResponse.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: { id: 'cred-1', publicKey: new Uint8Array([1]), counter: 0 },
        credentialDeviceType: 'singleDevice',
        credentialBackedUp: false
      }
    });
    const event = makeReq({
      user: safeUser(u),
      cookieToken: c.token,
      body: { response: { id: 'cred-1', response: {} } }
    });
    await POST(event as unknown as Parameters<typeof POST>[0]);
    const stored = (
      await testDb.select().from(passkeys).where(eq(passkeys.id, 'cred-1')).limit(1)
    )[0];
    expect(stored?.name).toBe('Passkey');
  });
});

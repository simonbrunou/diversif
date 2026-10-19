import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../test/db';
import { captureFlow, makeRouteEvent, safeUser, seedUser } from '../../test/route';
import { _clearAllRateLimits } from './rate-limit';

mock.module('#lib/server/db/index.js', () => ({ db: testDb }));

const { requireFreshAuth } = await import('./fresh-auth');
const { hashPassword } = await import('./auth');

import { eq } from 'drizzle-orm';
import { users } from './db/schema';

const PASSWORD = 'correct-password-123';

beforeEach(async () => {
  await resetTestDb();
});

afterEach(() => {
  _clearAllRateLimits();
});

async function signedIn(opts: { email?: string; locale?: 'fr' | 'en' } = {}) {
  const u = await seedUser({ email: opts.email, passwordHash: await hashPassword(PASSWORD) });
  return { u, locals: makeRouteEvent({ user: safeUser(u), locale: opts.locale }).locals };
}

describe('requireFreshAuth', () => {
  it('passes with the current password', async () => {
    const { locals } = await signedIn();
    expect(await requireFreshAuth(locals, PASSWORD, 'passwordErrorKey')).toEqual({ ok: true });
  });

  it('fails with 400 and the incorrect-password key under the given field', async () => {
    const { locals } = await signedIn();
    const result = await requireFreshAuth(locals, 'wrong-password', 'deleteErrorKey');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.status).toBe(400);
      expect(result.failure.data).toEqual({ deleteErrorKey: 'errorsAccountPasswordIncorrect' });
    }
  });

  it('refuses a 6th attempt within 5 minutes, even with the right password', async () => {
    const { locals } = await signedIn();
    for (let i = 0; i < 5; i++) await requireFreshAuth(locals, 'wrong', 'errorKey');

    const result = await requireFreshAuth(locals, PASSWORD, 'errorKey');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.status).toBe(429);
      expect(result.failure.data).toEqual({ errorKey: 'errorsAuthRateLimited' });
    }
  });

  it("keeps each user's attempt budget separate", async () => {
    const a = await signedIn({ email: 'a@example.com' });
    const b = await signedIn({ email: 'b@example.com' });
    for (let i = 0; i < 5; i++) await requireFreshAuth(a.locals, 'wrong', 'errorKey');

    expect(await requireFreshAuth(b.locals, PASSWORD, 'errorKey')).toEqual({ ok: true });
  });

  it('redirects to the localized /login when the user row vanished mid-session', async () => {
    const { u, locals } = await signedIn({ locale: 'en' });
    await testDb.delete(users).where(eq(users.id, u.id));

    const r = await captureFlow(() => requireFreshAuth(locals, PASSWORD, 'errorKey'));
    expect(r).toEqual({ kind: 'redirect', status: 303, location: '/en/login' });
  });

  it('redirects to /login when nobody is signed in', async () => {
    const { locals } = makeRouteEvent({ user: null });
    const r = await captureFlow(() => requireFreshAuth(locals, PASSWORD, 'errorKey'));
    expect(r).toEqual({ kind: 'redirect', status: 303, location: '/login' });
  });
});

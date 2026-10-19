import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../../test/db';
import { captureFlow, copyCookies, makeRouteEvent, safeUser, seedUser } from '../../../test/route';

mock.module('#lib/server/db/index.js', () => ({ db: testDb }));

const auditSpy = mock();
import * as actualAudit from '#lib/server/audit.js';
mock.module('#lib/server/audit.js', () => ({
  ...actualAudit,
  audit: (...args: Parameters<typeof actualAudit.audit>) => auditSpy(...args)
}));

import { hashPassword } from '#lib/server/auth.js';
import { resumeSession, startSession } from '#lib/server/session.js';
import { actions, load } from './+page.server';

beforeEach(async () => {
  await resetTestDb();
  auditSpy.mockClear();
});

async function seed() {
  return seedUser({
    email: 'p@example.com',
    passwordHash: await hashPassword('current-password-12')
  });
}

describe('account/sessions load', () => {
  it('redirects unauthenticated users to /login', async () => {
    const r = await captureFlow(() =>
      load(makeRouteEvent({ user: null }) as unknown as Parameters<typeof load>[0])
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/login');
  });

  it('returns empty data for authenticated users', async () => {
    const u = await seed();
    const out = await load(
      makeRouteEvent({ user: safeUser(u) }) as unknown as Parameters<typeof load>[0]
    );
    expect(out).toEqual({});
  });
});

describe('account/sessions logoutEverywhere', () => {
  it('ends every session of the user, clears site data, redirects', async () => {
    const u = await seed();
    const otherDevice = makeRouteEvent();
    await startSession(otherDevice, u.id);
    const event = makeRouteEvent({ user: safeUser(u) });
    await startSession(event, u.id);
    const copy = makeRouteEvent({ cookies: copyCookies(event.cookies) });
    const r = await captureFlow(() =>
      actions.logoutEverywhere!(
        event as unknown as Parameters<NonNullable<typeof actions.logoutEverywhere>>[0]
      )
    );
    expect(r.kind).toBe('redirect');
    if (r.kind === 'redirect') expect(r.location).toBe('/login');
    expect(await resumeSession(otherDevice)).toBeNull();
    expect(await resumeSession(copy)).toBeNull();
    expect(auditSpy).toHaveBeenCalledWith({ type: 'account.sessions_revoked', userId: u.id });
    // Same Clear-Site-Data contract as POST /logout : the redirect response
    // must instruct the browser to wipe CacheStorage + storage.
    expect(event.setHeaders).toHaveBeenCalledWith({ 'Clear-Site-Data': '"cache", "storage"' });
  });
});

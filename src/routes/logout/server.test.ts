import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { testDb, resetTestDb } from '../../test/db';
import { captureFlow, copyCookies, makeRouteEvent, safeUser, seedUser } from '../../test/route';

mock.module('#lib/server/db/index.js', () => ({ db: testDb }));

const auditSpy = mock();
import * as actualAudit from '#lib/server/audit.js';
mock.module('#lib/server/audit.js', () => ({
  ...actualAudit,
  audit: (...args: Parameters<typeof actualAudit.audit>) => auditSpy(...args)
}));

import { resumeSession, startSession } from '#lib/server/session.js';
import { POST } from './+server';

beforeEach(async () => {
  await resetTestDb();
  auditSpy.mockClear();
});

describe('logout POST', () => {
  it('ends the session, clears site data and redirects to /login', async () => {
    const u = await seedUser();
    const event = makeRouteEvent({ user: safeUser(u) });
    await startSession(event, u.id);
    const copy = makeRouteEvent({ cookies: copyCookies(event.cookies) });

    const result = await captureFlow(() => POST(event as unknown as Parameters<typeof POST>[0]));
    expect(result.kind).toBe('redirect');
    if (result.kind === 'redirect') expect(result.location).toBe('/login');
    expect(await resumeSession(copy)).toBeNull();
    expect(copyCookies(event.cookies)).toEqual({});
    // The 303 must carry Clear-Site-Data so Chromium/Firefox wipe the SW
    // 'pages' cache + IndexedDB even when JS (the client-side purge) is off.
    expect(event.setHeaders).toHaveBeenCalledWith({ 'Clear-Site-Data': '"cache", "storage"' });
    expect(auditSpy).toHaveBeenCalledWith({ type: 'auth.logout', userId: u.id });
  });

  it('still clears site data, without an audit entry, when no one is signed in', async () => {
    const event = makeRouteEvent({ user: null });
    const result = await captureFlow(() => POST(event as unknown as Parameters<typeof POST>[0]));
    expect(result.kind).toBe('redirect');
    expect(event.setHeaders).toHaveBeenCalledWith({ 'Clear-Site-Data': '"cache", "storage"' });
    expect(auditSpy).not.toHaveBeenCalled();
  });
});

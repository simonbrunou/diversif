import { afterEach, describe, expect, it } from 'bun:test';
import * as m from '#lib/paraglide/messages.js';
import { baseLocale, overwriteGetLocale } from '#lib/paraglide/runtime.js';
import {
  parseChildIdParam,
  parseIntParam,
  requireChildContext,
  requireUser,
  requireGuest,
  requireMembership,
  requireOwnership
} from './guards';
import type { SafeUser, Membership } from '#lib/types.js';

const fakeUser: SafeUser = {
  id: 1,
  email: 'a@example.com',
  displayName: 'A',
  createdAt: new Date('2024-01-01T00:00:00Z')
};

function makeLocals(opts: { user?: SafeUser | null; memberships?: Membership[] }): App.Locals {
  return {
    user: opts.user ?? null,
    memberships: opts.memberships ?? []
  } as App.Locals;
}

function expectRedirect(fn: () => unknown, status: number, location: string) {
  try {
    fn();
  } catch (e) {
    const err = e as { status?: number; location?: string };
    expect(err.status).toBe(status);
    expect(err.location).toBe(location);
    return;
  }
  throw new Error('expected fn to throw a redirect');
}

function expectError(fn: () => unknown, status: number) {
  try {
    fn();
  } catch (e) {
    const err = e as { status?: number; body?: { message?: string } };
    expect(err.status).toBe(status);
    return err;
  }
  throw new Error('expected fn to throw an HTTP error');
}

describe('requireUser', () => {
  it('returns the user when present', () => {
    expect(requireUser(makeLocals({ user: fakeUser }))).toBe(fakeUser);
  });

  it('redirects to /login when missing', () => {
    expectRedirect(() => requireUser(makeLocals({})), 303, '/login');
  });
});

describe('requireGuest', () => {
  it('does nothing when no user', () => {
    expect(() => requireGuest(makeLocals({}))).not.toThrow();
  });

  it('redirects to / when user is logged in', () => {
    expectRedirect(() => requireGuest(makeLocals({ user: fakeUser })), 303, '/');
  });
});

describe('requireMembership', () => {
  it('returns the user and membership when present', () => {
    const m: Membership = {
      userId: 1,
      childId: 7,
      role: 'member',
      createdAt: new Date()
    };
    const result = requireMembership(makeLocals({ user: fakeUser, memberships: [m] }), 7);
    expect(result.membership).toBe(m);
    expect(result.user).toBe(fakeUser);
  });

  it('redirects unauthenticated users to login first', () => {
    expectRedirect(() => requireMembership(makeLocals({}), 7), 303, '/login');
  });

  it('throws 403 when user has no matching membership', () => {
    expectError(() => requireMembership(makeLocals({ user: fakeUser }), 7), 403);
  });
});

describe('parseChildIdParam', () => {
  it('returns the integer id for valid numeric strings', () => {
    expect(parseChildIdParam({ id: '42' })).toBe(42);
  });

  it('throws 404 on non-numeric strings', () => {
    expectError(() => parseChildIdParam({ id: 'abc' }), 404);
  });

  it('throws 404 on negative or zero ids', () => {
    expectError(() => parseChildIdParam({ id: '0' }), 404);
    expectError(() => parseChildIdParam({ id: '-3' }), 404);
  });

  it('throws 404 on fractional ids', () => {
    expectError(() => parseChildIdParam({ id: '1.5' }), 404);
  });

  it('throws 404 when id is missing', () => {
    expectError(() => parseChildIdParam({}), 404);
  });
});

describe('parseIntParam', () => {
  it('returns the parsed integer for a valid positive string', () => {
    expect(parseIntParam('5', m.errorsEntryIdInvalid)).toBe(5);
    expect(parseIntParam('100', m.errorsEntryIdInvalid)).toBe(100);
  });

  it('throws 400 when the raw value is undefined', () => {
    expectError(() => parseIntParam(undefined, m.errorsEntryIdInvalid), 400);
  });

  it('throws 400 on non-numeric strings', () => {
    expectError(() => parseIntParam('abc', m.errorsEntryIdInvalid), 400);
  });

  it('throws 400 on zero', () => {
    expectError(() => parseIntParam('0', m.errorsEntryIdInvalid), 400);
  });

  it('throws 400 on negative values', () => {
    expectError(() => parseIntParam('-1', m.errorsEntryIdInvalid), 400);
  });

  it('throws 400 on fractional values', () => {
    expectError(() => parseIntParam('1.5', m.errorsEntryIdInvalid), 400);
  });

  it('uses the message key for a missing and an invalid value', () => {
    for (const raw of [undefined, 'abc']) {
      const err = expectError(() => parseIntParam(raw, m.errorsEntryIdInvalid), 400);
      expect(err.body?.message).toBe('Identifiant d’entrée invalide.');
    }
  });
});

describe('requireChildContext', () => {
  const m: Membership = {
    userId: 1,
    childId: 7,
    role: 'member',
    createdAt: new Date()
  };

  it('returns user, childId and membership on happy path', () => {
    const result = requireChildContext(makeLocals({ user: fakeUser, memberships: [m] }), {
      id: '7'
    });
    expect(result.childId).toBe(7);
    expect(result.user).toBe(fakeUser);
    expect(result.membership).toBe(m);
  });

  it('throws 404 when id param is missing', () => {
    expectError(
      () => requireChildContext(makeLocals({ user: fakeUser, memberships: [m] }), {}),
      404
    );
  });

  it('redirects to /login when not authenticated', () => {
    expectRedirect(() => requireChildContext(makeLocals({}), { id: '7' }), 303, '/login');
  });

  it('throws 403 when user has no membership for that child', () => {
    expectError(
      () => requireChildContext(makeLocals({ user: fakeUser, memberships: [] }), { id: '7' }),
      403
    );
  });
});

describe('requireOwnership', () => {
  it('returns user and membership when role is owner', () => {
    const m: Membership = {
      userId: 1,
      childId: 7,
      role: 'owner',
      createdAt: new Date()
    };
    const result = requireOwnership(makeLocals({ user: fakeUser, memberships: [m] }), 7);
    expect(result.membership).toBe(m);
    expect(result.user).toBe(fakeUser);
  });

  it('throws 403 when role is member', () => {
    const m: Membership = {
      userId: 1,
      childId: 7,
      role: 'member',
      createdAt: new Date()
    };
    expectError(() => requireOwnership(makeLocals({ user: fakeUser, memberships: [m] }), 7), 403);
  });
});

// Each refusal's body is the error page's description, so it follows the
// request's locale. Literal strings, not m.key() under the same locale: that
// comparison would pass even if a guard ignored the locale.
describe('guard refusal bodies follow the locale', () => {
  afterEach(() => {
    overwriteGetLocale(() => baseLocale);
  });

  const member: Membership = { userId: 1, childId: 7, role: 'member', createdAt: new Date() };
  const refusals = [
    {
      name: 'parseChildIdParam 404',
      status: 404,
      run: () => parseChildIdParam({ id: 'abc' }),
      fr: 'Enfant introuvable.',
      en: 'Child not found.'
    },
    {
      name: 'requireMembership 403',
      status: 403,
      run: () => requireMembership(makeLocals({ user: fakeUser }), 7),
      fr: 'Accès refusé.',
      en: 'Access denied.'
    },
    {
      name: 'requireOwnership 403',
      status: 403,
      run: () => requireOwnership(makeLocals({ user: fakeUser, memberships: [member] }), 7),
      fr: 'Action réservée au créateur.',
      en: 'Only the creator can do this.'
    },
    {
      name: 'parseIntParam 400',
      status: 400,
      run: () => parseIntParam('abc', m.errorsEntryIdInvalid),
      fr: 'Identifiant d’entrée invalide.',
      en: 'Invalid entry ID.'
    }
  ];

  for (const locale of ['fr', 'en'] as const) {
    it.each(refusals)(`$name reads in ${locale}`, (refusal) => {
      overwriteGetLocale(() => locale);
      const err = expectError(refusal.run, refusal.status);
      expect(err.body?.message).toBe(refusal[locale]);
    });

    it(`parseChildIdParam's 404 equals errorsChildNotFound in ${locale}`, () => {
      overwriteGetLocale(() => locale);
      const err = expectError(() => parseChildIdParam({}), 404);
      expect(err.body?.message).toBe(m.errorsChildNotFound());
    });
  }
});

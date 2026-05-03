import { describe, it, expect } from 'vitest';
import { requireUser, requireGuest, requireMembership, requireOwnership } from './guards';
import type { SafeUser, Membership } from '$lib/types';

const fakeUser: SafeUser = {
  id: 1,
  email: 'a@example.com',
  displayName: 'A',
  createdAt: new Date('2024-01-01T00:00:00Z')
};

function makeLocals(opts: { user?: SafeUser | null; memberships?: Membership[] }): App.Locals {
  return {
    user: opts.user ?? null,
    sessionId: opts.user ? 'sess' : null,
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
  it('returns the membership when present', () => {
    const m: Membership = {
      userId: 1,
      childId: 7,
      role: 'member',
      createdAt: new Date()
    };
    const result = requireMembership(makeLocals({ user: fakeUser, memberships: [m] }), 7);
    expect(result).toBe(m);
  });

  it('redirects unauthenticated users to login first', () => {
    expectRedirect(() => requireMembership(makeLocals({}), 7), 303, '/login');
  });

  it('throws 403 when user has no matching membership', () => {
    expectError(() => requireMembership(makeLocals({ user: fakeUser }), 7), 403);
  });
});

describe('requireOwnership', () => {
  it('returns membership when role is owner', () => {
    const m: Membership = {
      userId: 1,
      childId: 7,
      role: 'owner',
      createdAt: new Date()
    };
    expect(requireOwnership(makeLocals({ user: fakeUser, memberships: [m] }), 7)).toBe(m);
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

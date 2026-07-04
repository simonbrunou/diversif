import { expect, mock } from 'bun:test';
import { testDb, schema } from './db';
import type { SafeUser } from '$lib/types';

type Membership = typeof schema.memberships.$inferSelect;

type CookieRecord = { value: string; opts: Record<string, unknown> };

function makeCookies(initial: Record<string, string> = {}) {
  const store = new Map<string, CookieRecord>();
  for (const [k, v] of Object.entries(initial)) store.set(k, { value: v, opts: {} });

  const get = mock((name: string) => store.get(name)?.value ?? null);
  const set = mock((name: string, value: string, opts: Record<string, unknown> = {}) => {
    store.set(name, { value, opts });
  });
  const del = mock((name: string, _opts: Record<string, unknown> = {}) => {
    store.delete(name);
  });
  return { get, set, delete: del, _store: store };
}

export type RouteEventOptions = {
  user?: SafeUser | null;
  memberships?: Membership[];
  sessionId?: string | null;
  /** Initial request cookies (e.g. the raw session token for logout flows). */
  cookies?: Record<string, string>;
  params?: Record<string, string>;
  url?: string; // full URL
  formData?: Record<string, string>;
  headers?: Record<string, string>;
  parent?: () => Promise<unknown>;
  locale?: 'fr' | 'en';
};

export function makeRouteEvent(opts: RouteEventOptions = {}) {
  const url = new URL(opts.url ?? 'http://localhost/');
  const cookies = makeCookies(opts.cookies);
  const formData = new FormData();
  if (opts.formData) {
    for (const [k, v] of Object.entries(opts.formData)) formData.append(k, v);
  }
  const request = new Request(url, {
    method: 'POST',
    body: opts.formData ? formData : undefined,
    headers: opts.headers
  });

  const event = {
    cookies,
    locals: {
      user: opts.user ?? null,
      memberships: opts.memberships ?? [],
      sessionId: opts.sessionId ?? (opts.user ? 'sess-id' : null),
      locale: opts.locale ?? 'fr'
    },
    params: opts.params ?? {},
    url,
    request,
    parent: opts.parent ?? (async () => ({})),
    getClientAddress: () => '127.0.0.1',
    // Mirrors event.setHeaders: headers accumulated here are merged onto the
    // final response by SvelteKit (including thrown-redirect responses).
    setHeaders: mock((_headers: Record<string, string>) => {})
  };
  return event;
}

/**
 * Run a SvelteKit-style action and capture its outcome : either:
 *  - a `redirect`: returns `{ kind: 'redirect', status, location }`
 *  - an `error`:   returns `{ kind: 'error', status, message }`
 *  - a regular return value (incl. `fail()`): returns `{ kind: 'return', value }`
 */
export async function captureFlow<T>(
  fn: () => Promise<T> | T
): Promise<
  | { kind: 'redirect'; status: number; location: string }
  | { kind: 'error'; status: number; message: string }
  | { kind: 'return'; value: T }
> {
  try {
    const value = await fn();
    return { kind: 'return', value };
  } catch (e) {
    const err = e as { status?: number; location?: string; body?: { message?: string } };
    if (typeof err.status === 'number' && typeof err.location === 'string') {
      return { kind: 'redirect', status: err.status, location: err.location };
    }
    if (typeof err.status === 'number') {
      return { kind: 'error', status: err.status, message: err.body?.message ?? '' };
    }
    throw e;
  }
}

/**
 * Shared assertion for the "wrong child" isolation contract: a load/action
 * call must reject with a 403, never fall through to a value carrying
 * another child's data. Centralizing this (rather than repeating
 * `captureFlow` + the two-line status check at every call site) keeps
 * per-handler isolation tests both consistent and free of copy-pasted
 * boilerplate as more of them get added.
 */
export async function expectForbidden(fn: () => unknown): Promise<void> {
  const r = await captureFlow(fn);
  expect(r.kind).toBe('error');
  if (r.kind === 'error') expect(r.status).toBe(403);
}

export async function seedUser(
  opts: {
    email?: string;
    displayName?: string;
    passwordHash?: string;
  } = {}
) {
  return (
    await testDb
      .insert(schema.users)
      .values({
        email: (opts.email ?? 'parent@example.com').toLowerCase(),
        passwordHash: opts.passwordHash ?? 'placeholder-hash',
        displayName: opts.displayName ?? 'Parent',
        createdAt: new Date()
      })
      .returning()
  )[0];
}

export async function seedChild(opts: { name?: string; birthDate?: string; createdBy: number }) {
  return (
    await testDb
      .insert(schema.children)
      .values({
        name: opts.name ?? 'Bébé',
        birthDate: opts.birthDate ?? '2024-01-01',
        createdBy: opts.createdBy,
        createdAt: new Date()
      })
      .returning()
  )[0];
}

export async function seedMembership(opts: {
  userId: number;
  childId: number;
  role?: 'owner' | 'member';
}): Promise<Membership> {
  return (
    await testDb
      .insert(schema.memberships)
      .values({
        userId: opts.userId,
        childId: opts.childId,
        role: opts.role ?? 'owner',
        createdAt: new Date()
      })
      .returning()
  )[0];
}

export function safeUser(u: Omit<typeof schema.users.$inferSelect, 'passwordHash'>): SafeUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    createdAt: u.createdAt,
    tosAcceptedAt: u.tosAcceptedAt ?? null,
    privacyAcceptedAt: u.privacyAcceptedAt ?? null,
    ageConfirmedAt: u.ageConfirmedAt ?? null,
    lastLoginAt: u.lastLoginAt ?? null,
    lastExportAt: u.lastExportAt ?? null
  };
}

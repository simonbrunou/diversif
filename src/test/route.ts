import { vi } from 'vitest';
import { testDb, schema } from './db';
import type { SafeUser } from '$lib/types';

type Membership = typeof schema.memberships.$inferSelect;

type CookieRecord = { value: string; opts: Record<string, unknown> };

export type FakeCookies = ReturnType<typeof makeCookies>;

export function makeCookies(initial: Record<string, string> = {}) {
  const store = new Map<string, CookieRecord>();
  for (const [k, v] of Object.entries(initial)) store.set(k, { value: v, opts: {} });

  const get = vi.fn((name: string) => store.get(name)?.value ?? null);
  const set = vi.fn((name: string, value: string, opts: Record<string, unknown> = {}) => {
    store.set(name, { value, opts });
  });
  const del = vi.fn((name: string, _opts: Record<string, unknown> = {}) => {
    store.delete(name);
  });
  return { get, set, delete: del, _store: store };
}

export type RouteEventOptions = {
  user?: SafeUser | null;
  memberships?: Membership[];
  sessionId?: string | null;
  params?: Record<string, string>;
  url?: string; // full URL
  formData?: Record<string, string>;
  parent?: () => Promise<unknown>;
};

export function makeRouteEvent(opts: RouteEventOptions = {}) {
  const url = new URL(opts.url ?? 'http://localhost/');
  const cookies = makeCookies();
  const formData = new FormData();
  if (opts.formData) {
    for (const [k, v] of Object.entries(opts.formData)) formData.append(k, v);
  }
  const request = new Request(url, {
    method: 'POST',
    body: opts.formData ? formData : undefined
  });

  const event = {
    cookies,
    locals: {
      user: opts.user ?? null,
      memberships: opts.memberships ?? [],
      sessionId: opts.sessionId ?? (opts.user ? 'sess-id' : null)
    },
    params: opts.params ?? {},
    url,
    request,
    parent: opts.parent ?? (async () => ({}))
  };
  return event;
}

/**
 * Run a SvelteKit-style action and capture its outcome — either:
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

export async function seedUser(
  opts: {
    email?: string;
    displayName?: string;
    passwordHash?: string;
  } = {}
) {
  return testDb
    .insert(schema.users)
    .values({
      email: (opts.email ?? 'parent@example.com').toLowerCase(),
      passwordHash: opts.passwordHash ?? 'placeholder-hash',
      displayName: opts.displayName ?? 'Parent',
      createdAt: new Date()
    })
    .returning()
    .all()[0];
}

export function seedChild(opts: { name?: string; birthDate?: string; createdBy: number }) {
  return testDb
    .insert(schema.children)
    .values({
      name: opts.name ?? 'Bébé',
      birthDate: opts.birthDate ?? '2024-01-01',
      createdBy: opts.createdBy,
      createdAt: new Date()
    })
    .returning()
    .all()[0];
}

export function seedMembership(opts: {
  userId: number;
  childId: number;
  role?: 'owner' | 'member';
}): Membership {
  return testDb
    .insert(schema.memberships)
    .values({
      userId: opts.userId,
      childId: opts.childId,
      role: opts.role ?? 'owner',
      createdAt: new Date()
    })
    .returning()
    .all()[0];
}

export function safeUser(u: Omit<typeof schema.users.$inferSelect, 'passwordHash'>): SafeUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    createdAt: u.createdAt
  };
}

/**
 * SvelteKit's generated `PageServerLoad` infers a return type of
 * `void | <data>` because `parent()` may resolve to nothing. In tests we
 * always return data, so this helper narrows the union for ergonomic
 * downstream assertions.
 */
export async function callLoad<T>(
  loadFn: (e: never) => Promise<T> | T,
  event: unknown
): Promise<NonNullable<Awaited<T>>> {
  const out = await loadFn(event as never);
  return out as NonNullable<Awaited<T>>;
}

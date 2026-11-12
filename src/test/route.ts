import { expect, mock, type Mock } from 'bun:test';
import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { testDb, schema } from './db';
import type { SafeUser } from '#lib/types.js';

type Membership = typeof schema.memberships.$inferSelect;

type CookieOptions = NonNullable<Parameters<Cookies['set']>[2]>;
type CookieRecord = { value: string; opts: CookieOptions };

/**
 * A cookie jar that satisfies SvelteKit's `Cookies`, with `get`, `set` and
 * `delete` kept as mocks so tests can read their calls, and `_store` holding
 * each cookie's value and options.
 */
export type FakeCookies = Cookies & {
  get: Mock<(name: string) => string | undefined>;
  set: Mock<(name: string, value: string, opts?: CookieOptions) => void>;
  delete: Mock<(name: string, opts?: CookieOptions) => void>;
  _store: Map<string, CookieRecord>;
};

function makeCookies(initial: Record<string, string> = {}): FakeCookies {
  const store = new Map<string, CookieRecord>();
  for (const [k, v] of Object.entries(initial)) store.set(k, { value: v, opts: {} });

  const get = mock((name: string) => store.get(name)?.value);
  const set = mock((name: string, value: string, opts: CookieOptions = {}) => {
    store.set(name, { value, opts });
  });
  const del = mock((name: string, _opts?: CookieOptions) => {
    store.delete(name);
  });
  const notFaked = (method: string) => () => {
    throw new Error(`the fake cookie jar does not implement cookies.${method}`);
  };
  return {
    get,
    getAll: () => [...store].map(([name, { value }]) => ({ name, value })),
    set,
    delete: del,
    parse: notFaked('parse'),
    serialize: notFaked('serialize'),
    _store: store
  };
}

/**
 * Snapshot of a fake cookie jar's current values, to seed another
 * makeRouteEvent: a second browser replaying a copied cookie. Sign-out tests
 * need it because the signed-out jar has already dropped its own cookie, so
 * only a copy proves the session was revoked server-side.
 */
export function copyCookies(jar: FakeCookies): Record<string, string> {
  return Object.fromEntries([...jar._store].map(([name, { value }]) => [name, value]));
}

export type RouteEventOptions = {
  user?: SafeUser | null;
  memberships?: Membership[];
  /** Initial request cookies (e.g. the raw session token for logout flows). */
  cookies?: Record<string, string>;
  params?: Record<string, string>;
  url?: string; // full URL
  formData?: Record<string, string | string[]>;
  headers?: Record<string, string>;
  parent?: () => Promise<unknown>;
  locale?: 'fr' | 'en';
};

function appendFormValue(formData: FormData, key: string, value: string | string[]) {
  if (Array.isArray(value)) {
    for (const item of value) formData.append(key, item);
  } else {
    formData.append(key, value);
  }
}

/** The parts of a fake event whose fake type tests read beyond the real one. */
type FakeEventParts = {
  cookies: FakeCookies;
  setHeaders: Mock<(headers: Record<string, string>) => void>;
};

/**
 * A fake SvelteKit event for a handler under test. Its type is the event the
 * handler expects: TypeScript infers `E` from the argument's place, so
 * `load(makeRouteEvent({ ... }))` type-checks against that route's
 * `PageServerLoadEvent`. Outside an argument, `E` is a plain `RequestEvent`.
 * The fake fills only the fields listed below; a handler that reads another
 * one gets `undefined` at run time, whatever the type says.
 */
export function makeRouteEvent<E extends object = RequestEvent>(
  opts: RouteEventOptions = {}
): E & FakeEventParts {
  const url = new URL(opts.url ?? 'http://localhost/');
  const cookies = makeCookies(opts.cookies);
  const formData = new FormData();
  if (opts.formData) {
    for (const [k, v] of Object.entries(opts.formData)) appendFormValue(formData, k, v);
  }
  const request = new Request(url, {
    method: 'POST',
    body: opts.formData ? formData : undefined,
    headers: opts.headers
  });
  const headersSet = new Set<string>();

  const event = {
    cookies,
    locals: {
      user: opts.user ?? null,
      memberships: opts.memberships ?? [],
      locale: opts.locale ?? 'fr'
    },
    params: opts.params ?? {},
    url,
    request,
    parent: opts.parent ?? (async () => ({})),
    getClientAddress: () => '127.0.0.1',
    // Mirrors event.setHeaders: headers accumulated here are merged onto the
    // final response by SvelteKit (including thrown-redirect responses), and
    // setting the same header twice throws, as SvelteKit's respond.js does.
    setHeaders: mock((headers: Record<string, string>) => {
      for (const name of Object.keys(headers)) {
        if (headersSet.has(name.toLowerCase())) throw new Error(`"${name}" header is already set`);
        headersSet.add(name.toLowerCase());
      }
    })
  };
  return event as unknown as E & FakeEventParts;
}

/**
 * The data a load returned, failing the test when it returned nothing. A
 * load's generated type is `void | PageData`, since a load may end without a
 * return; narrowing here keeps each test's reads typed against `PageData`.
 */
export function loadData<T>(result: T): Exclude<T, void> {
  if (result === undefined) throw new Error('load returned nothing');
  return result as Exclude<T, void>;
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

type UserRow = typeof schema.users.$inferSelect;

/** The SafeUser of a user row; a fake user may leave out the nullable dates. */
export function safeUser(
  u: Pick<UserRow, 'id' | 'email' | 'displayName' | 'createdAt'> &
    Partial<Omit<UserRow, 'passwordHash'>>
): SafeUser {
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

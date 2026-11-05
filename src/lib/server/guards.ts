import { error } from '@sveltejs/kit';
import { localizedRedirect } from './redirect';
import * as m from '#lib/paraglide/messages.js';
import type { Membership, SafeUser } from '#lib/types.js';

// error() bodies render verbatim as the error page's description, so every
// guard resolves a message key at the moment it throws: inside the request,
// paraglide's per-request locale is in effect (same as the child layout).

/**
 * Generic integer param parser. Throws a 400 HTTP error when the raw value is
 * missing, non-integer, or non-positive. `invalid` is the message function
 * (e.g. `() => m.errorsEntryIdInvalid()`), called only when it throws. A missing value
 * shares it: a route param is never undefined, so that branch only keeps the
 * 400 contract.
 */
export function parseIntParam(raw: string | undefined, invalid: () => string): number {
  if (raw === undefined) throw error(400, invalid());
  const n = Number.parseInt(raw, 10);
  // Reject floats like "1.5": parseInt truncates them to 1 which passes
  // isInteger, so we also guard that the string is a bare integer literal.
  if (!Number.isInteger(n) || n <= 0 || String(n) !== raw.trim()) {
    throw error(400, invalid());
  }
  return n;
}

/**
 * Non-throwing variant for callers that render with or without a child
 * context (the root layout shell) instead of 404ing.
 */
export function parseChildIdParamOrNull(params: Partial<Record<string, string>>): number | null {
  const raw = params.id;
  const n = raw === undefined ? NaN : Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function parseChildIdParam(params: Partial<Record<string, string>>): number {
  const n = parseChildIdParamOrNull(params);
  if (n === null) throw error(404, m.errorsChildNotFound());
  return n;
}

export function requireUser(locals: App.Locals): SafeUser {
  if (!locals.user) {
    throw localizedRedirect(locals.locale, 303, '/login');
  }
  return locals.user;
}

export function requireGuest(locals: App.Locals): void {
  if (locals.user) {
    throw localizedRedirect(locals.locale, 303, '/');
  }
}

export function requireMembership(
  locals: App.Locals,
  childId: number
): { user: SafeUser; membership: Membership } {
  const user = requireUser(locals);
  const membership = locals.memberships.find((m) => m.childId === childId && m.userId === user.id);
  if (!membership) {
    throw error(403, m.errorsChildAccessDenied());
  }
  return { user, membership };
}

export function requireOwnership(
  locals: App.Locals,
  childId: number
): { user: SafeUser; membership: Membership } {
  const result = requireMembership(locals, childId);
  if (result.membership.role !== 'owner') {
    throw error(403, m.errorsChildOwnerOnly());
  }
  return result;
}

/**
 * One-stop child-context guard for routes under `child/[id]/*`.
 * Resolves: authenticated user, validated child id, and membership.
 * Throws/redirects on any failure via the underlying guards.
 *
 * Order matters: requireUser is called BEFORE parseChildIdParam so a guest
 * hitting a malformed id (e.g. /child/abc) gets redirected to /login rather
 * than a 404. This matches the documented prelude order across the app.
 *
 * Usage:
 *   const { user, childId, membership } = requireChildContext(locals, params);
 */
export function requireChildContext(
  locals: App.Locals,
  params: Partial<Record<string, string>>
): { user: SafeUser; childId: number; membership: Membership } {
  requireUser(locals);
  const childId = parseChildIdParam(params);
  const { user, membership } = requireMembership(locals, childId);
  return { user, childId, membership };
}

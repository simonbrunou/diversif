import { error } from '@sveltejs/kit';
import { localizedRedirect } from './redirect';
import type { Membership, SafeUser } from '$lib/types';

/**
 * Generic integer param parser. Throws a 400 HTTP error with a French message
 * when the raw value is missing, non-integer, or non-positive.
 */
export function parseIntParam(raw: string | undefined, kind: string): number {
  if (raw === undefined) throw error(400, `${kind} manquant`);
  const n = Number.parseInt(raw, 10);
  // Reject floats like "1.5": parseInt truncates them to 1 which passes
  // isInteger, so we also guard that the string is a bare integer literal.
  if (!Number.isInteger(n) || n <= 0 || String(n) !== raw.trim()) {
    throw error(400, `${kind} invalide`);
  }
  return n;
}

export function parseChildIdParam(params: Partial<Record<string, string>>): number {
  const raw = params.id;
  const n = raw === undefined ? NaN : Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw error(404, 'Enfant introuvable');
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
    throw error(403, 'Accès refusé');
  }
  return { user, membership };
}

export function requireOwnership(
  locals: App.Locals,
  childId: number
): { user: SafeUser; membership: Membership } {
  const result = requireMembership(locals, childId);
  if (result.membership.role !== 'owner') {
    throw error(403, 'Action réservée au créateur');
  }
  return result;
}

/**
 * One-stop child-context guard for routes under `child/[id]/*`.
 * Resolves: authenticated user, validated child id, and membership.
 * Throws/redirects on any failure via the underlying guards.
 *
 * Usage:
 *   const { user, childId, membership } = requireChildContext(locals, params);
 */
export function requireChildContext(
  locals: App.Locals,
  params: Partial<Record<string, string>>
): { user: SafeUser; childId: number; membership: Membership } {
  const childId = parseChildIdParam(params);
  const { user, membership } = requireMembership(locals, childId);
  return { user, childId, membership };
}

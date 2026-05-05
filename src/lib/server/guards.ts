import { error, redirect } from '@sveltejs/kit';
import type { Membership, SafeUser } from '$lib/types';

export function requireUser(locals: App.Locals): SafeUser {
  if (!locals.user) {
    throw redirect(303, '/login');
  }
  return locals.user;
}

export function requireGuest(locals: App.Locals): void {
  if (locals.user) {
    throw redirect(303, '/');
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

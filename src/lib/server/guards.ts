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

export function requireMembership(locals: App.Locals, childId: number): Membership {
  const user = requireUser(locals);
  const m = locals.memberships.find((m) => m.childId === childId && m.userId === user.id);
  if (!m) {
    throw error(403, 'Accès refusé');
  }
  return m;
}

export function requireOwnership(locals: App.Locals, childId: number): Membership {
  const m = requireMembership(locals, childId);
  if (m.role !== 'owner') {
    throw error(403, 'Action réservée au créateur');
  }
  return m;
}

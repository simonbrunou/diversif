import { requireUser } from '#lib/server/guards.js';
import type { PageServerLoad } from './$types';

export const load = (async ({ locals }) => {
  requireUser(locals);
  return {};
}) satisfies PageServerLoad;

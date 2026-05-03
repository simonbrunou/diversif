import { redirect } from '@sveltejs/kit';
import { requireUser } from '$lib/server/guards';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
  requireUser(locals);
  const { children } = await parent();

  if (children.length === 0) {
    throw redirect(303, '/child/new');
  }
  if (children.length === 1) {
    throw redirect(303, `/child/${children[0].id}`);
  }
  return { children };
};

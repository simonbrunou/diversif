import { localizedRedirect } from '$lib/server/redirect';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, parent }) => {
  if (!locals.user) {
    return { kind: 'landing' as const };
  }

  const { children } = await parent();

  if (children.length === 0) {
    throw localizedRedirect(locals.locale, 303, '/child/new');
  }
  if (children.length === 1) {
    throw localizedRedirect(locals.locale, 303, `/child/${children[0].id}`);
  }
  return { kind: 'picker' as const, children };
};

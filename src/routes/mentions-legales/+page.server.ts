import { getLegalIdentity } from '$lib/server/legal';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = () => {
  return { legal: getLegalIdentity() };
};

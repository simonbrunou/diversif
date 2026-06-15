import { ageInMonths } from '$lib/utils/age';
import { getStageForAgeMonths, getAllStagesForBento } from '$lib/content/guidance';
import { requireChildContext } from '$lib/server/guards';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals, params }) => {
  // Explicit in-file membership guard (see report/+page.server.ts for rationale):
  // belt-and-braces alongside the layout guard reached via `await parent()`.
  requireChildContext(locals, params);
  const { child } = await parent();
  const currentStageId = getStageForAgeMonths(ageInMonths(child.birthDate)).id;
  const stages = getAllStagesForBento();

  return {
    currentStageId,
    stages
  };
};

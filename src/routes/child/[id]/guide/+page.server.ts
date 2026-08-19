import { ageInMonths } from '$lib/utils/age';
import { getStageForAgeMonths, getAllStagesForBento } from '$lib/content/guidance';
import { requireChildContext } from '$lib/server/guards';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent, locals, params }) => {
  // Explicit in-file membership guard (see report/+page.server.ts for rationale):
  // belt-and-braces alongside the layout guard reached via `await parent()`.
  requireChildContext(locals, params);
  const { child } = await parent();
  const ageMonths = ageInMonths(child.birthDate);
  const currentStageId = ageMonths < 4 ? '' : getStageForAgeMonths(ageMonths).id;
  const stages = getAllStagesForBento();

  return {
    ageMonths,
    currentStageId,
    stages
  };
};

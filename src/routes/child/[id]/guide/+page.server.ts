import { ageInMonths } from '$lib/utils/age';
import { getStageForAgeMonths, getAllStagesForBento } from '$lib/content/guidance';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
  const { child } = await parent();
  const currentStageId = getStageForAgeMonths(ageInMonths(child.birthDate)).id;
  const stages = getAllStagesForBento();

  return {
    currentStageId,
    stages
  };
};

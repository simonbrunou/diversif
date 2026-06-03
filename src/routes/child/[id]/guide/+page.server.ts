import { ageInMonths } from '$lib/utils/age';
import { getStageForAgeMonths, getAllStagesForBento } from '$lib/content/guidance';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
  const { child } = await parent();
  const months = ageInMonths(child.birthDate);
  const currentStageId = getStageForAgeMonths(months).id;
  const stages = getAllStagesForBento();

  return {
    ageMonths: months,
    currentStageId,
    stages
  };
};

import { ageInMonths } from '$lib/utils/age';
import { getStageForAgeMonths } from '$lib/content/guidance';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
  const { child } = await parent();
  const months = ageInMonths(child.birthDate);
  const currentStageId = getStageForAgeMonths(months).id;
  return { ageMonths: months, currentStageId };
};

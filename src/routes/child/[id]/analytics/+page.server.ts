import { CATEGORIES } from '$lib/utils/categories';
import { loadAnalyticsBuckets } from '$lib/server/guidance/queries';
import type { PageServerLoad } from './$types';

const WEEKS = 12;

export const load: PageServerLoad = async ({ parent }) => {
  const { child } = await parent();
  const buckets = loadAnalyticsBuckets(child.id, WEEKS);
  return {
    weeks: WEEKS,
    buckets,
    totalCategories: CATEGORIES.length - 1 // exclude 'autre' to match diversity denominator
  };
};

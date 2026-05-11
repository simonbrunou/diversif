import { redirect } from '@sveltejs/kit';
import { CATEGORIES } from '$lib/utils/categories';
import { loadAnalyticsBuckets } from '$lib/server/guidance/queries';
import type { PageServerLoad } from './$types';

const WEEKS = 12;

export const load: PageServerLoad = async ({ parent }) => {
  const parentData = await parent();
  if (parentData.bento) {
    throw redirect(303, `/child/${parentData.child.id}/foods?segment=stats`);
  }
  const { child } = parentData;
  const buckets = await loadAnalyticsBuckets(child.id, WEEKS);
  return {
    weeks: WEEKS,
    buckets,
    totalCategories: CATEGORIES.length - 1 // exclude 'autre' to match diversity denominator
  };
};

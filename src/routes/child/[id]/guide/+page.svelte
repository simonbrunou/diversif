<script lang="ts">
  import DiscoverBento from '$lib/components/bento/DiscoverBento.svelte';
  import type { DiscoverSection } from '$lib/components/bento/DiscoverSegments.svelte';
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { localizedHref } from '$lib/utils/localized-href';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // params.id is required by the route, so it is always a string here.
  const childId = $derived(page.params.id ?? '');
  const viewAllSuggestionsHref = $derived(localizedHref(`/child/${childId}/suggestions`));

  const VALID_SECTIONS: DiscoverSection[] = ['reperes', 'essayer', 'apprendre'];
  const currentSection = $derived<DiscoverSection>(
    (() => {
      const q = page.url.searchParams.get('section');
      return (VALID_SECTIONS as string[]).includes(q ?? '') ? (q as DiscoverSection) : 'reperes';
    })()
  );
</script>

<DiscoverBento
  stages={data.stages}
  activeStageId={data.currentStageId}
  suggestions={data.suggestions}
  allergens={data.allergens}
  ageMonths={data.ageMonths}
  textureProgress={data.textureProgress}
  seasonalFoods={data.seasonalFoods}
  currentMonth={data.currentMonth}
  {childId}
  recipes={data.recipes}
  factCards={data.factCards}
  onPickSuggestion={(food) => goto(`/child/${childId}?suggested=${food.id}`)}
  {viewAllSuggestionsHref}
  {currentSection}
/>

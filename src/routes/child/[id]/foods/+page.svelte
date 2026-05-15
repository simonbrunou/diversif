<script lang="ts">
  import type { PageData } from './$types';
  import { page } from '$app/stores';
  import CarnetBento from '$lib/components/bento/CarnetBento.svelte';
  import type { Segment } from '$lib/components/bento/CarnetSegments.svelte';

  let { data }: { data: PageData } = $props();

  const VALID_SEGMENTS: Segment[] = ['all', 'categories', 'allergens', 'stats'];

  const currentSegment = $derived<Segment>(
    (() => {
      const q = $page.url.searchParams.get('segment');
      return (VALID_SEGMENTS as string[]).includes(q ?? '') ? (q as Segment) : 'all';
    })()
  );

  const bentoStats = $derived({
    diversityScore: data.categoryCount,
    distinctFoods: data.foodCount,
    weeklyEntries: data.weeklyEntries ?? { counts: [], anchorUtc: 0 },
    texturesTried: data.texturesTried ?? 0
  });
</script>

<CarnetBento
  childId={String(data.child?.id ?? '')}
  foods={data.bentoFoods ?? []}
  foodCount={data.foodCount ?? 0}
  categoryCount={data.categoryCount ?? 0}
  allergens={data.bentoAllergens ?? []}
  stats={bentoStats}
  {currentSegment}
/>

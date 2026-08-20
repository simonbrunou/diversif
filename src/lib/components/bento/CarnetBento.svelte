<!-- src/lib/components/bento/CarnetBento.svelte -->
<script lang="ts">
  import CarnetHeader from './CarnetHeader.svelte';
  import CarnetSegments, { type Segment } from './CarnetSegments.svelte';
  import CarnetTous from './CarnetTous.svelte';
  import CarnetCategories from './CarnetCategories.svelte';
  import CarnetAllergens from './CarnetAllergens.svelte';
  import CarnetStats from './CarnetStats.svelte';
  import type { TextureKey } from '$lib/utils/textures';

  type Food = {
    id: number;
    name: string;
    category: string;
    tried: number;
    status: 'ras' | 'inconfort' | 'reaction' | 'todo';
    lastEntryId?: number | null;
    lastTexture?: TextureKey | null;
  };

  type AllergenItem = {
    id: string;
    label: string;
    triedCount: number;
    lastTried: string | null;
    daysSinceLastTried: number | null;
    state: 'cleared' | 'todo' | 'inconfort' | 'reaction' | 'fading';
  };

  let {
    childId,
    foods,
    foodCount,
    categoryCount,
    allergens,
    stats,
    currentSegment
  }: {
    childId: string;
    foods: Food[];
    foodCount: number;
    categoryCount: number;
    allergens: AllergenItem[];
    stats: {
      diversityScore: number;
      distinctFoods: number;
      weeklyEntries: { counts: number[]; anchorUtc: number };
      texturesTried?: number;
    };
    currentSegment: Segment;
  } = $props();
</script>

<div class="flex flex-col">
  <CarnetHeader {foodCount} {categoryCount} />
  <CarnetSegments {childId} {currentSegment} />
  {#if currentSegment === 'all'}
    <CarnetTous {foods} {childId} />
  {:else if currentSegment === 'categories'}
    <CarnetCategories {foods} />
  {:else if currentSegment === 'allergens'}
    <CarnetAllergens items={allergens} {childId} />
  {:else if currentSegment === 'stats'}
    <CarnetStats
      diversityScore={stats.diversityScore}
      distinctFoods={stats.distinctFoods}
      weeklyEntries={stats.weeklyEntries.counts}
      anchorUtc={stats.weeklyEntries.anchorUtc}
      texturesTried={stats.texturesTried ?? 0}
    />
  {/if}
</div>

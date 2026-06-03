<script lang="ts">
  import StagesBentoGrid from './StagesBentoGrid.svelte';
  import StageDetailSheet from './StageDetailSheet.svelte';
  import SuggestionFeed from './SuggestionFeed.svelte';
  import SourcesCluster from './SourcesCluster.svelte';
  import AllergenPassport from './AllergenPassport.svelte';
  import TextureTimeline from './TextureTimeline.svelte';
  import SeasonalFoods from './SeasonalFoods.svelte';
  import Recipes from './Recipes.svelte';
  import DidYouKnow from './DidYouKnow.svelte';
  import DiscoverGroup from './DiscoverGroup.svelte';
  import DiscoverSegments, { type DiscoverSection } from './DiscoverSegments.svelte';
  import * as m from '$lib/paraglide/messages.js';
  import type { SuggestFood, RankedSuggestion } from '$lib/utils/suggest';
  import type { AllergenItem } from '$lib/server/guidance/allergen-status';
  import type { Recipe } from '$lib/content/recipes';
  import type { FactCard } from '$lib/content/did-you-know';

  type Food = { id: number; name: string; category: string; allergenType: string | null };

  type Stage = {
    id: string;
    title: string;
    oneLiner: string;
    principles: string[];
    focus: string[];
    textures: string;
    milkTarget: string;
    redFlags: string[];
    sources: string[];
  };

  let {
    stages,
    activeStageId,
    suggestions,
    onPickSuggestion,
    viewAllSuggestionsHref,
    allergens,
    ageMonths,
    textureProgress,
    seasonalFoods,
    currentMonth,
    childId,
    recipes,
    factCards,
    currentSection = 'reperes'
  }: {
    stages: Stage[];
    activeStageId: string;
    suggestions: RankedSuggestion[];
    onPickSuggestion: (food: SuggestFood) => void;
    viewAllSuggestionsHref?: string;
    allergens: AllergenItem[];
    ageMonths: number;
    textureProgress: { tried: string[]; mostRecent: string | null };
    seasonalFoods: Food[];
    currentMonth: number;
    childId: string;
    recipes: readonly Recipe[];
    factCards: readonly FactCard[];
    currentSection?: DiscoverSection;
  } = $props();

  let openStageId = $state<string | null>(null);
  const openStage = $derived(
    openStageId ? stages.find((s) => s.id === openStageId) ?? null : null
  );
  let sheetOpen = $state(false);

  function openStageBy(id: string) {
    openStageId = id;
    sheetOpen = true;
  }
</script>

<div class="flex flex-col">
  <DiscoverSegments {childId} {currentSection} />

  {#if currentSection === 'reperes'}
    <DiscoverGroup label={m.discoverGroupReperes()} tint="mint">
      <StagesBentoGrid {stages} {activeStageId} onOpen={openStageBy} />
      <AllergenPassport {allergens} />
      <TextureTimeline {ageMonths} progress={textureProgress} />
    </DiscoverGroup>
  {:else if currentSection === 'essayer'}
    <DiscoverGroup label={m.discoverGroupAEssayer()} tint="peach">
      <SeasonalFoods foods={seasonalFoods} month={currentMonth} {childId} />
      <Recipes {recipes} />
      <SuggestionFeed
        {suggestions}
        onPick={onPickSuggestion}
        viewAllHref={viewAllSuggestionsHref}
      />
    </DiscoverGroup>
  {:else}
    <DiscoverGroup label={m.discoverGroupApprendre()} tint="butter">
      <DidYouKnow cards={factCards} />
      <SourcesCluster />
    </DiscoverGroup>
  {/if}
</div>

{#if openStage}
  <StageDetailSheet bind:open={sheetOpen} stage={openStage} />
{/if}

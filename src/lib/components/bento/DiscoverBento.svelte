<script lang="ts">
  import StagesBentoGrid from './StagesBentoGrid.svelte';
  import StageDetailSheet from './StageDetailSheet.svelte';
  import SuggestionFeed from './SuggestionFeed.svelte';
  import TipsRotator from './TipsRotator.svelte';
  import SourcesCluster from './SourcesCluster.svelte';
  import AllergenPassport from './AllergenPassport.svelte';
  import TextureTimeline from './TextureTimeline.svelte';
  import type { SuggestFood, RankedSuggestion } from '$lib/utils/suggest';
  import type { AllergenItem } from '$lib/server/guidance/allergen-status';

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
    todayTip,
    tipDismissed,
    onPickSuggestion,
    onDismissTip,
    viewAllSuggestionsHref,
    allergens,
    ageMonths,
    textureProgress
  }: {
    stages: Stage[];
    activeStageId: string;
    suggestions: RankedSuggestion[];
    todayTip: { id: string; title: string; body: string } | null;
    tipDismissed: boolean;
    onPickSuggestion: (food: SuggestFood) => void;
    onDismissTip: (id: string) => void;
    viewAllSuggestionsHref?: string;
    allergens: AllergenItem[];
    ageMonths: number;
    textureProgress: { tried: string[]; mostRecent: string | null };
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
  <StagesBentoGrid {stages} {activeStageId} onOpen={openStageBy} />
  <AllergenPassport {allergens} />
  <TextureTimeline {ageMonths} progress={textureProgress} />
  <SuggestionFeed {suggestions} onPick={onPickSuggestion} viewAllHref={viewAllSuggestionsHref} />
  <TipsRotator tip={todayTip} dismissed={tipDismissed} onDismiss={onDismissTip} />
  <SourcesCluster />
</div>

{#if openStage}
  <StageDetailSheet bind:open={sheetOpen} stage={openStage} />
{/if}

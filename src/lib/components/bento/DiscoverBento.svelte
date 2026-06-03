<script lang="ts">
  import StagesBentoGrid from './StagesBentoGrid.svelte';
  import StageDetailSheet from './StageDetailSheet.svelte';

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
    activeStageId
  }: {
    stages: Stage[];
    activeStageId: string;
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
</div>

{#if openStage}
  <StageDetailSheet bind:open={sheetOpen} stage={openStage} />
{/if}

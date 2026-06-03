<script lang="ts">
  import DetailSheet from '$lib/components/ui/DetailSheet.svelte';
  import SheetSection from '$lib/components/ui/SheetSection.svelte';
  import Callout from '$lib/components/ui/Callout.svelte';
  import * as m from '$lib/paraglide/messages';

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
    open = $bindable(false),
    stage
  }: { open: boolean; stage: Stage } = $props();
</script>

<DetailSheet bind:open title={stage.title} intro={stage.oneLiner}>
  <SheetSection title="Principes">
    <ul class="list-disc space-y-1 pl-5 text-sm">
      {#each stage.principles as p, i (i)}
        <li>{p}</li>
      {/each}
    </ul>
  </SheetSection>

  <SheetSection title="Aliments à proposer">
    <ul class="list-disc space-y-1 pl-5 text-sm">
      {#each stage.focus as f, i (i)}
        <li>{f}</li>
      {/each}
    </ul>
  </SheetSection>

  <SheetSection title="Texture & lait">
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div class="rounded-tile bg-tile-mint/40 p-3 text-sm">
        <p class="text-xs font-semibold uppercase tracking-wider text-ink-soft">{m.textureDetailRowLabel()}</p>
        <p class="mt-1">{stage.textures}</p>
      </div>
      <div class="rounded-tile bg-tile-butter/40 p-3 text-sm">
        <p class="text-xs font-semibold uppercase tracking-wider text-ink-soft">Lait</p>
        <p class="mt-1">{stage.milkTarget}</p>
      </div>
    </div>
  </SheetSection>

  {#if stage.redFlags.length > 0}
    <SheetSection title="À surveiller">
      <Callout variant="warning">
        <ul class="list-disc space-y-1 pl-5">
          {#each stage.redFlags as f, i (i)}
            <li>{f}</li>
          {/each}
        </ul>
      </Callout>
    </SheetSection>
  {/if}

  <Callout variant="info">{m.guideMedicalDisclaimer()}</Callout>
</DetailSheet>

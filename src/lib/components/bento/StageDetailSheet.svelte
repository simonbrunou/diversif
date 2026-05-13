<script lang="ts">
  import Modal from '../ui/Modal.svelte';

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

<Modal bind:open title={stage.title} side="bottom">
  <div class="max-h-[70vh] overflow-y-auto">
    <p class="text-sm text-ink-soft">{stage.oneLiner}</p>

    <section class="mt-4">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-ink-soft">Principes</h3>
      <ul class="mt-2 list-disc space-y-1 pl-5 text-sm">
        {#each stage.principles as p, i (i)}
          <li>{p}</li>
        {/each}
      </ul>
    </section>

    <section class="mt-4">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-ink-soft">Aliments à proposer</h3>
      <ul class="mt-2 list-disc space-y-1 pl-5 text-sm">
        {#each stage.focus as f, i (i)}
          <li>{f}</li>
        {/each}
      </ul>
    </section>

    <section class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div class="rounded-tile bg-tile-mint/40 p-3 text-sm">
        <p class="text-xs font-semibold uppercase tracking-wider text-ink-soft">Texture</p>
        <p class="mt-1">{stage.textures}</p>
      </div>
      <div class="rounded-tile bg-tile-butter/40 p-3 text-sm">
        <p class="text-xs font-semibold uppercase tracking-wider text-ink-soft">Lait</p>
        <p class="mt-1">{stage.milkTarget}</p>
      </div>
    </section>

    {#if stage.redFlags.length > 0}
      <section class="mt-4 rounded-tile border border-warning bg-tile-butter/30 p-3 text-sm">
        <p class="text-xs font-semibold uppercase tracking-wider text-warning-foreground">À surveiller</p>
        <ul class="mt-1 list-disc space-y-1 pl-5">
          {#each stage.redFlags as f, i (i)}
            <li>{f}</li>
          {/each}
        </ul>
      </section>
    {/if}
  </div>
</Modal>

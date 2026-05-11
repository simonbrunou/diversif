<script lang="ts">
  let {
    diversityScore,
    distinctFoods,
    weeklyEntries
  }: { diversityScore: number; distinctFoods: number; weeklyEntries: number[] } = $props();

  const max = $derived(weeklyEntries.length === 0 ? 1 : Math.max(1, ...weeklyEntries));
</script>

<div class="flex flex-col gap-3">
  <div class="grid grid-cols-2 gap-3">
    <article class="rounded-tile bg-tile-mint p-4 shadow-soft" aria-label="Diversité">
      <p class="text-xs font-medium uppercase tracking-wider text-ink-soft">Diversité</p>
      <p class="mt-1 font-display text-3xl italic leading-none">{diversityScore}</p>
    </article>
    <article class="rounded-tile bg-tile-butter p-4 shadow-soft" aria-label="Aliments">
      <p class="text-xs font-medium uppercase tracking-wider text-ink-soft">Aliments</p>
      <p class="mt-1 font-display text-3xl italic leading-none">{distinctFoods}</p>
    </article>
  </div>
  {#if weeklyEntries.length > 0}
    <article class="rounded-tile bg-canvas p-4 shadow-soft">
      <p class="mb-3 text-xs font-medium uppercase tracking-wider text-ink-soft">Cadence (7 jours)</p>
      <div class="flex h-20 items-end gap-1">
        {#each weeklyEntries as count, i (i)}
          <div
            data-bar
            class="flex-1 rounded-t bg-primary/60"
            style={`height: ${Math.max(2, (count / max) * 100)}%`}
            aria-label={`${count} logs`}
          ></div>
        {/each}
      </div>
    </article>
  {/if}
</div>

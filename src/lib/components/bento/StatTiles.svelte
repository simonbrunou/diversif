<!-- src/lib/components/bento/StatTiles.svelte -->
<script lang="ts">
  import * as m from '$lib/paraglide/messages';

  let {
    foodsIntroduced,
    weekCount,
    streakCurrent,
    streakRecord
  }: {
    foodsIntroduced: number;
    weekCount: number;
    streakCurrent: number;
    streakRecord: number;
  } = $props();

  const isRecord = $derived(streakRecord > 0 && streakCurrent === streakRecord);
</script>

<div class="mb-3 grid grid-cols-2 gap-3">
  <article class="rounded-tile bg-tile-mint p-4 shadow-soft" aria-label={m.aujourdhuiStatsAliments()}>
    <p class="text-xs font-medium uppercase tracking-wider text-ink-soft">
      {m.aujourdhuiStatsAliments()}
    </p>
    <p class="mt-1 font-display text-3xl italic leading-none">{foodsIntroduced}</p>
    <p class="mt-2 text-xs text-ink-soft">
      {m.aujourdhuiStatsAlimentsDelta({ count: String(weekCount) })}
    </p>
  </article>
  <article class="rounded-tile bg-tile-butter p-4 shadow-soft" aria-label={m.aujourdhuiStatsStreak()}>
    <p class="text-xs font-medium uppercase tracking-wider text-ink-soft">
      {m.aujourdhuiStatsStreak()}
    </p>
    <p class="mt-1 font-display text-3xl italic leading-none">
      {m.aujourdhuiStatsStreakDays({ days: String(streakCurrent) })}
    </p>
    {#if isRecord}
      <p class="mt-2 text-xs font-semibold text-primary-strong animate-record-pop">
        {m.aujourdhuiStatsStreakRecord()}
      </p>
    {/if}
  </article>
</div>

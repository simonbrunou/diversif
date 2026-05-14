<!-- src/lib/components/bento/StatTiles.svelte -->
<script lang="ts">
  import Card from '$components/ui/Card.svelte';
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

  const streakLabel = $derived(
    streakCurrent === 1
      ? m.aujourdhuiStatsStreakDaysOne()
      : m.aujourdhuiStatsStreakDaysOther({ days: String(streakCurrent) })
  );
</script>

<div class="mb-3 grid grid-cols-2 gap-3">
  <Card as="article" variant="tile-mint" class="p-4" aria-label={m.aujourdhuiStatsAliments()}>
    <p class="text-xs font-medium uppercase tracking-wider text-ink-soft">
      {m.aujourdhuiStatsAliments()}
    </p>
    <p class="mt-1 font-display text-3xl italic leading-none">{foodsIntroduced}</p>
    {#if weekCount > 0}
      <p class="mt-2 text-xs text-ink-soft">
        {m.aujourdhuiStatsAlimentsDelta({ count: String(weekCount) })}
      </p>
    {/if}
  </Card>
  <Card as="article" variant="tile-butter" class="p-4" aria-label={m.aujourdhuiStatsStreak()}>
    <p class="text-xs font-medium uppercase tracking-wider text-ink-soft">
      {m.aujourdhuiStatsStreak()}
    </p>
    <p class="mt-1 font-display text-3xl italic leading-none">
      {streakLabel}
    </p>
    {#if isRecord}
      <p class="mt-2 text-xs font-semibold text-primary-strong animate-record-pop">
        {m.aujourdhuiStatsStreakRecord()}
      </p>
    {/if}
  </Card>
</div>

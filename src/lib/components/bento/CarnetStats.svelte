<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import * as m from '$lib/paraglide/messages';
  import { languageTag } from '$lib/paraglide/runtime';

  let {
    diversityScore,
    distinctFoods,
    weeklyEntries
  }: { diversityScore: number; distinctFoods: number; weeklyEntries: number[] } = $props();

  const max = $derived(weeklyEntries.length === 0 ? 1 : Math.max(1, ...weeklyEntries));

  // Single-letter weekday in the active locale, one per bucket. The server
  // always emits 7 buckets (loadWeeklyEntries) so i=0 → 6 days ago, i=6 → today;
  // the offset formula uses .length to stay correct if that ever changes.
  const dayLabels = $derived.by(() => {
    const fmt = new Intl.DateTimeFormat(languageTag(), { weekday: 'narrow' });
    const today = new Date();
    return Array.from({ length: weeklyEntries.length }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - (weeklyEntries.length - 1 - i));
      return fmt.format(d);
    });
  });

  function logsLabel(count: number): string {
    return count === 1 ? m.carnetStatsLogsOne() : m.carnetStatsLogsOther({ count: String(count) });
  }
</script>

<div class="flex flex-col gap-3">
  <div class="grid grid-cols-2 gap-3">
    <Card as="article" variant="tile-mint" class="p-4" aria-label={m.carnetStatsDiversity()}>
      <p class="text-xs font-medium uppercase tracking-wider text-ink-soft">{m.carnetStatsDiversity()}</p>
      <p class="mt-1 font-display text-3xl italic leading-none">{diversityScore}</p>
    </Card>
    <Card as="article" variant="tile-butter" class="p-4" aria-label={m.carnetStatsFoods()}>
      <p class="text-xs font-medium uppercase tracking-wider text-ink-soft">{m.carnetStatsFoods()}</p>
      <p class="mt-1 font-display text-3xl italic leading-none">{distinctFoods}</p>
    </Card>
  </div>
  {#if weeklyEntries.length > 0}
    <article class="rounded-tile bg-canvas p-4 shadow-soft">
      <p class="mb-3 text-xs font-medium uppercase tracking-wider text-ink-soft">{m.carnetStatsLast7Days()}</p>
      <div class="flex h-20 items-end gap-1">
        {#each weeklyEntries as count, i (i)}
          <div
            data-bar
            class="flex-1 rounded-t bg-primary/60"
            style={`height: ${Math.max(2, (count / max) * 100)}%`}
            aria-label={logsLabel(count)}
          ></div>
        {/each}
      </div>
      <div class="mt-1 flex gap-1 text-[10px] uppercase text-ink-soft">
        {#each weeklyEntries as _, i (i)}
          <span data-day class="flex-1 text-center">{dayLabels[i]}</span>
        {/each}
      </div>
    </article>
  {/if}
</div>

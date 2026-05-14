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
  // (loadWeeklyEntries) buckets by UTC calendar day with today at index
  // length-1, so we compute and format the labels in UTC too — otherwise
  // users near UTC midnight in a non-UTC time zone would see the last bar
  // labelled for the wrong weekday and risk an SSR/CSR hydration mismatch.
  const dayLabels = $derived.by(() => {
    const fmt = new Intl.DateTimeFormat(languageTag(), {
      weekday: 'narrow',
      timeZone: 'UTC'
    });
    const now = new Date();
    const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Array.from({ length: weeklyEntries.length }, (_, i) => {
      const d = new Date(todayUTC - (weeklyEntries.length - 1 - i) * 86400_000);
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

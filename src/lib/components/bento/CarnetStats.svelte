<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import * as m from '$lib/paraglide/messages';
  import { languageTag } from '$lib/paraglide/runtime';

  let {
    diversityScore,
    distinctFoods,
    texturesTried,
    weeklyEntries,
    anchorUtc
  }: {
    diversityScore: number;
    distinctFoods: number;
    texturesTried: number;
    weeklyEntries: number[];
    anchorUtc?: number;
  } = $props();

  const max = $derived(weeklyEntries.length === 0 ? 1 : Math.max(1, ...weeklyEntries));

  // Single-letter weekday in the active locale, one per bucket. The server
  // (loadWeeklyEntries) buckets by UTC calendar day with the last bucket
  // pinned to `anchorUtc` (UTC midnight of "today" at request time). Format
  // the labels off that same anchor so the bars and their labels describe
  // the same UTC dates even when the page hydrates after a UTC midnight
  // rollover — otherwise labels would shift one day while the bars stayed
  // put, and SSR/CSR would diverge.
  const dayLabels = $derived.by(() => {
    const fmt = new Intl.DateTimeFormat(languageTag(), {
      weekday: 'narrow',
      timeZone: 'UTC'
    });
    // Fallback: standalone use without an anchor (isolated tests, future
    // consumers). The current UTC date still produces sensible labels, just
    // with the original drift risk.
    const now = new Date();
    const todayUTC =
      anchorUtc ?? Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    return Array.from({ length: weeklyEntries.length }, (_, i) => {
      const d = new Date(todayUTC - (weeklyEntries.length - 1 - i) * 86400_000);
      return fmt.format(d);
    });
  });

  function logsLabel(count: number): string {
    return count === 1 ? m.carnetBilanLogsOne() : m.carnetBilanLogsOther({ count: String(count) });
  }
</script>

<div class="flex flex-col gap-3">
  <div class="grid grid-cols-3 gap-3">
    <Card as="article" variant="tile-mint" class="p-4" aria-label={m.carnetBilanDiversity()}>
      <p class="text-xs font-medium uppercase tracking-wider text-ink-soft">{m.carnetBilanDiversity()}</p>
      <p class="mt-1 font-display text-3xl italic leading-none">{diversityScore}</p>
    </Card>
    <Card as="article" variant="tile-butter" class="p-4" aria-label={m.carnetBilanFoods()}>
      <p class="text-xs font-medium uppercase tracking-wider text-ink-soft">{m.carnetBilanFoods()}</p>
      <p class="mt-1 font-display text-3xl italic leading-none">{distinctFoods}</p>
    </Card>
    <Card as="article" variant="tile-sky" class="p-4" aria-label={m.carnetBilanTextures()}>
      <p class="text-xs font-medium uppercase tracking-wider text-ink-soft">{m.carnetBilanTextures()}</p>
      <p class="mt-1 font-display text-3xl italic leading-none">{texturesTried}<span class="text-base">/6</span></p>
    </Card>
  </div>
  {#if weeklyEntries.length > 0}
    <article class="rounded-tile bg-canvas p-4 shadow-soft">
      <p class="mb-3 text-xs font-medium uppercase tracking-wider text-ink-soft">{m.carnetBilanLast7Days()}</p>
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

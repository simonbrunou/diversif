<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import * as m from '$lib/paraglide/messages';
  import { getLocale } from '$lib/paraglide/runtime';
  import { parisDayIndex } from '$lib/utils/paris-date';

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
  // (loadWeeklyEntries) buckets by Europe/Paris calendar day with the last
  // bucket pinned to `anchorUtc` (the epoch-ms Paris dayIndex of "today" at
  // request time — see $lib/utils/paris-date). Format the labels off that
  // same anchor, in the same Europe/Paris zone, so the bars and their labels
  // describe the same civil dates even when the page hydrates after a
  // midnight rollover — otherwise labels would shift one day while the bars
  // stayed put, and SSR/CSR would diverge.
  //
  // Two formats off the same anchor: `narrow` for the visual axis, where seven
  // single letters are the point, and `long` for each bar's accessible name.
  // French narrow weekdays are L M M J V S D — mardi and mercredi are both
  // "M" — so an accessible name built from the narrow form leaves two of every
  // seven bars indistinguishable, and the visual axis that would disambiguate
  // them is aria-hidden.
  const dayFormats = $derived.by(() => {
    const opts = { timeZone: 'Europe/Paris' } as const;
    const narrow = new Intl.DateTimeFormat(getLocale(), { weekday: 'narrow', ...opts });
    const long = new Intl.DateTimeFormat(getLocale(), { weekday: 'long', ...opts });
    // Fallback: standalone use without an anchor (isolated tests, future
    // consumers). Still Europe/Paris-anchored, just recomputed from the
    // current instant instead of the server-provided anchor.
    const todayUTC = anchorUtc ?? parisDayIndex(Date.now()) * 86400_000;
    const days = Array.from(
      { length: weeklyEntries.length },
      (_, i) => new Date(todayUTC - (weeklyEntries.length - 1 - i) * 86400_000)
    );
    return {
      narrow: days.map((d) => narrow.format(d)),
      long: days.map((d) => long.format(d))
    };
  });
  const dayLabels = $derived(dayFormats.narrow);

  function logsLabel(count: number): string {
    return count === 1 ? m.carnetBilanLogsOne() : m.carnetBilanLogsOther({ count: String(count) });
  }
</script>

<div class="flex flex-col gap-3">
  <div class="grid grid-cols-3 gap-3">
    <!--
      Counters are Inter 800 with tabular figures, not the display serif:
      Fraunces has no tabular variant, so these jittered on increment, and
      DESIGN.md reserves the italic serif for feeling rather than facts.
      Labels take each tile's own -foreground instead of ink-soft — grey on
      butter measured 4.73:1 in dark against a 4.5 floor, 0.23 of headroom,
      which is precisely what The Paired Foreground Rule exists to prevent.
    -->
    <Card as="article" variant="tile-mint" class="p-4" aria-label={m.carnetBilanDiversity()}>
      <p class="text-xs font-medium uppercase tracking-wider text-tile-mint-foreground">
        {m.carnetBilanDiversity()}
      </p>
      <p class="mt-1 text-[28px] font-extrabold leading-none tabular-nums">{diversityScore}</p>
      <p class="mt-1 text-2xs leading-tight text-tile-mint-foreground">
        {m.carnetBilanDiversityCaption()}
      </p>
    </Card>
    <Card as="article" variant="tile-butter" class="p-4" aria-label={m.carnetBilanFoods()}>
      <p class="text-xs font-medium uppercase tracking-wider text-tile-butter-foreground">
        {m.carnetBilanFoods()}
      </p>
      <p class="mt-1 text-[28px] font-extrabold leading-none tabular-nums">{distinctFoods}</p>
    </Card>
    <Card as="article" variant="tile-sky" class="p-4" aria-label={m.carnetBilanTextures()}>
      <p class="text-xs font-medium uppercase tracking-wider text-tile-sky-foreground">
        {m.carnetBilanTextures()}
      </p>
      <p class="mt-1 text-[28px] font-extrabold leading-none tabular-nums">
        {texturesTried}<span class="text-sm font-normal">/6</span>
      </p>
    </Card>
  </div>
  {#if weeklyEntries.length > 0}
    <article class="rounded-tile bg-canvas p-4 shadow-soft">
      <p class="mb-3 text-xs font-medium uppercase tracking-wider text-ink-soft">{m.carnetBilanLast7Days()}</p>
      <!--
        role="list"/"listitem" is required, not decoration: axe flagged
        `aria-prohibited-attr` (serious, 7 nodes) because `aria-label` on a
        bare <div> is discarded, so every one of these per-day counts was
        silently unavailable to a screen reader. listitem permits naming, and
        a list is what this actually is — seven daily totals.
      -->
      <div role="list" class="flex h-20 items-end gap-1">
        {#each weeklyEntries as count, i (i)}
          <div
            data-bar
            role="listitem"
            class="flex-1 rounded-t bg-primary/60"
            style={`height: ${Math.max(2, (count / max) * 100)}%`}
            aria-label="{dayFormats.long[i]} · {logsLabel(count)}"
          ></div>
        {/each}
      </div>
      <!-- Each bar's accessible name already carries its day, so this visual
           axis would otherwise be announced a second time. -->
      <div aria-hidden="true" class="mt-1 flex gap-1 text-3xs uppercase text-ink-soft">
        {#each weeklyEntries as _, i (i)}
          <span data-day class="flex-1 text-center">{dayLabels[i]}</span>
        {/each}
      </div>
    </article>
  {/if}
</div>

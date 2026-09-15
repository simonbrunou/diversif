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
    /** All-time longest streak. Only surfaced when it beats the current one. */
    streakRecord: number;
  } = $props();

  // Nothing logged yet means there is nothing to report. Two tiles reading
  // "0" and "0 jours" are the pretend-stats the product brief rules out, and
  // the welcome reminder plus the feed's own empty state already tell a fresh
  // parent what to do — three voices saying "you have no data" is two too many.
  const hasData = $derived(foodsIntroduced > 0);

  const streakUnit = $derived(
    streakCurrent === 1 ? m.aujourdhuiBilanStreakUnitOne() : m.aujourdhuiBilanStreakUnitOther()
  );

  const weekLabel = $derived(
    weekCount === 1
      ? m.aujourdhuiBilanAlimentsDeltaOne()
      : m.aujourdhuiBilanAlimentsDeltaOther({ count: String(weekCount) })
  );

  // Shown ONLY when the record is genuinely ahead of today's streak. When the
  // two are equal the big number already *is* the record, so restating it adds
  // nothing and starts editorialising a number the parent gets to interpret.
  const showRecord = $derived(streakRecord > streakCurrent);
  const recordLabel = $derived(
    streakRecord === 1
      ? m.aujourdhuiBilanStreakRecordOne()
      : m.aujourdhuiBilanStreakRecordOther({ days: String(streakRecord) })
  );
</script>

{#if hasData}
  <!-- Collapses to one column below 20rem so the streak tile's label and value
       stop being clipped at 200% zoom (measured: 80px of "RÉGULARITÉ" inside a
       46px box at a 195px viewport), and stacks again at lg because the desktop
       bento gives this module one narrow column rather than a full-width band —
       side-by-side there produced 114px tiles too cramped for the caption.
       min-w-0 lets the grid children actually shrink instead of forcing their
       content width back onto the track. -->
  <div class="mb-3 grid grid-cols-1 gap-3 min-[20rem]:grid-cols-2 lg:grid-cols-1">
    <Card
      as="article"
      variant="tile-mint"
      class="min-w-0 p-4"
      aria-label={m.aujourdhuiBilanAliments()}
    >
      <p class="text-2xs font-semibold uppercase tracking-[0.08em]">
        {m.aujourdhuiBilanAliments()}
      </p>
      <!-- tabular-nums so the count does not reflow its own width when it
           ticks over; the brief specifies the numeric style as Inter 800 with
           'tnum', not the Fraunces display italic this used to borrow. -->
      <p class="mt-1 text-[28px] font-extrabold leading-none tabular-nums">{foodsIntroduced}</p>
      {#if weekCount > 0}
        <p class="mt-2 text-xs">{weekLabel}</p>
      {/if}
    </Card>
    <Card
      as="article"
      variant="tile-butter"
      class="min-w-0 p-4"
      aria-label={m.aujourdhuiBilanStreak()}
    >
      <p class="text-2xs font-semibold uppercase tracking-[0.08em]">
        {m.aujourdhuiBilanStreak()}
      </p>
      <!-- Number and unit carry different type on purpose: it keeps this tile
           optically level with the plain count next to it, and it stops
           "6 jours" from overflowing a narrow tile as one 28px run. -->
      <p class="mt-1 flex items-baseline gap-1 leading-none">
        <span class="text-[28px] font-extrabold tabular-nums">{streakCurrent}</span>
        <span class="text-sm font-semibold">{streakUnit}</span>
      </p>
      {#if showRecord}
        <p class="mt-2 text-xs">{recordLabel}</p>
      {/if}
    </Card>
  </div>
{/if}

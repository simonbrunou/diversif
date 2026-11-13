<!-- src/lib/components/bento/AujourdhuiBento.svelte -->
<script lang="ts">
  import StatTiles, { statTilesRender } from './StatTiles.svelte';
  import AllergensSnapshot, { type AllergenPillState } from './AllergensSnapshot.svelte';
  import ReminderStrip from './ReminderStrip.svelte';
  import RecentFeed from './RecentFeed.svelte';
  import type { Reminder } from '#lib/server/guidance/reminders.js';
  import type { RecentEntry } from '#lib/types.js';
  import { isPriorityAllergen } from '#lib/utils/allergens.js';
  import { localizedHref } from '#lib/utils/localized-href.js';
  import * as m from '#lib/paraglide/messages.js';
  import { FileText, ChevronRight, UtensilsCrossed } from '@lucide/svelte';

  type Stats = {
    foodsIntroduced: number;
    weekCount: number;
  };

  // Mirrors AllergenItem from #lib/server/guidance/allergen-history — declared
  // locally (like CarnetBento) so this client component doesn't import a
  // server module.
  type AllergenStatusItem = {
    id: string;
    label: string;
    state: 'cleared' | 'todo' | 'inconfort' | 'reaction' | 'fading';
    worstEntryId: number | null;
  };

  let {
    childId,
    recent,
    stats,
    streak,
    streakRecord,
    reminders,
    allergens
  }: {
    childId: string;
    recent: RecentEntry[];
    stats: Stats;
    streak: number;
    streakRecord: number;
    reminders: Reminder[];
    allergens: readonly AllergenStatusItem[];
  } = $props();

  // Actionable states only, and every one of them visible. The old version
  // also emitted up to three 'cleared' pills and relied on a horizontal
  // scroller, which pushed the genuinely actionable 'todo' pills off the edge
  // of a box with no scroll affordance. Cleared allergens are reassurance, so
  // they are now a count (see clearedCount) rather than pills competing for
  // the same row.
  const allergenPills = $derived.by(() => {
    const introduced = allergens.filter((a) => a.state !== 'todo');
    if (introduced.length === 0) return [];
    const toPill = (a: AllergenStatusItem, state: AllergenPillState) => ({
      id: a.id,
      label: a.label,
      state,
      // Only a real reaction has somewhere worth going: the entry page that
      // carries the reassurance copy and the 15/112 rail.
      href:
        a.worstEntryId !== null
          ? localizedHref(`/child/${childId}/foods/${a.worstEntryId}`)
          : undefined
    });
    return [
      ...introduced.filter((a) => a.state === 'reaction').map((a) => toPill(a, 'reaction')),
      ...introduced.filter((a) => a.state === 'inconfort').map((a) => toPill(a, 'inconfort')),
      ...introduced.filter((a) => a.state === 'fading').map((a) => toPill(a, 'fading')),
      ...allergens
        .filter((a) => a.state === 'todo' && isPriorityAllergen(a.id))
        .slice(0, 3)
        .map((a) => toPill(a, 'todo'))
    ];
  });

  const clearedCount = $derived(allergens.filter((a) => a.state === 'cleared').length);

  // StatTiles' own test, so the tray never moves the destinations into a cell
  // the stat tiles fill, or leaves them under a cell the stat tiles leave empty.
  const showStatTiles = $derived(statTilesRender(stats.foodsIntroduced));

  const handoffs = $derived([
    {
      href: localizedHref(`/child/${childId}/menu`),
      label: m.menuTitle(),
      icon: UtensilsCrossed,
      accent: 'bg-accent-lilac/30 text-tile-lilac-foreground dark:bg-accent-lilac/20'
    },
    {
      href: localizedHref(`/child/${childId}/report`),
      label: m.reportHandoffTitle(),
      icon: FileText,
      accent: 'bg-accent-sky/30 text-tile-sky-foreground dark:bg-accent-sky/20'
    }
  ]);
</script>

<!--
  Mobile stays a single column. From lg the same modules lay out as a real
  tray instead of the phone stack stretched across a 768px well: the stat
  tiles stack narrow in column one (they were 366x108 letterboxes with the
  number in the left 8%), the allergen strip and the feed take the wide spans
  they actually need, and the two hand-off destinations sit together under the
  stat tiles. Vertical rhythm still comes from each child's own mb-3, so the
  grid only supplies column gaps (gap-y-0).

  Below the reminders, the tray is two column stacks (#363). Column one holds
  the stat tiles (rows 2 and 3), then the destinations (row 4). Columns two
  and three hold the allergen strip (row 2), then the feed (rows 3 to 5).
  When the stat tiles and the allergen strip shared one row, the taller stat
  tiles set its height and left an empty band under the allergen strip, before
  the feed. Placement alone builds the two stacks, with no CSS order or
  per-column wrapper, so the DOM, reading and tab order stay reminders, stat
  tiles, allergens, feed, destinations.

  Row 5 holds only the feed. The part of the feed's height that rows 3 and 4
  do not hold goes there, so those rows size to column one alone. With the
  feed in rows 3 and 4 only, its height spread over both and pushed the
  destinations down, 154px in the e2e check. Row 5 is 1fr because the grid
  algorithm gives an item that crosses a flexible track its extra height in
  flexible tracks only. An auto row 5 laid out the same in Chromium, which
  grows the empty track first, but that rests on finer rules of how a grid
  shares out extra space.

  The allergen strip can be the taller module of row 2. In a week with no new
  food and the streak at its record, the stat tiles drop both optional lines,
  while seven allergens due again wrap the strip onto three rows. The strip
  then sets row 2, and the stat tiles' content ended 38px above the
  destinations (#730). So their cell stretches over rows 2 and 3 and is a grid
  of one row, which the StatTiles grid fills, margin aside. That grid shares the
  extra height between its two tiles' rows, and each tile's content stays at
  its top. Their bottom then meets the strip's, and the destinations start one
  margin below. When the stat tiles are the taller module, rows 2 and 3 take
  their height, and the stretch adds nothing.

  The stat tiles render nothing until the first food is logged. The tray then
  drops their cell, and the destinations take it: column one, rows 2 and 3,
  their top level with the allergen strip's (#737). Under the strip's row,
  they left column one blank for 152px. They span both rows so that, when they
  are taller than the strip, as in English, their extra height goes to row 3,
  which the feed starts with, and the feed stays one margin under the strip.
  In row 2 alone they would grow that row and push the feed down. Row 4 is
  then empty, and the DOM order is unchanged.
-->
<div
  // fallow-ignore-next-line css-token-drift -- the row tracks of this one tray (#363), not a design value a token would name
  class="lg:grid lg:grid-cols-3 lg:grid-rows-[auto_auto_auto_auto_1fr] lg:items-start lg:gap-x-3 lg:gap-y-0"
>
  <div class="min-w-0 lg:col-span-3 lg:row-start-1">
    <ReminderStrip {reminders} />
  </div>

  {#if showStatTiles}
    <div class="min-w-0 lg:col-start-1 lg:row-span-2 lg:row-start-2 lg:grid lg:self-stretch">
      <StatTiles
        foodsIntroduced={stats.foodsIntroduced}
        weekCount={stats.weekCount}
        streakCurrent={streak}
        {streakRecord}
      />
    </div>
  {/if}

  <div class="min-w-0 lg:col-span-2 lg:col-start-2 lg:row-start-2">
    <AllergensSnapshot
      items={allergenPills}
      {clearedCount}
      foodsHref={localizedHref(`/child/${childId}/foods?segment=allergens`)}
    />
  </div>

  <div class="min-w-0 lg:col-span-2 lg:col-start-2 lg:row-span-3 lg:row-start-3">
    <RecentFeed entries={recent} {childId} />
  </div>

  <!--
    Destinations, not data. These used to reuse the feed row's exact anatomy
    (canvas + hairline + soft shadow at 62px), so "places to go" and "things
    that happened" were indistinguishable. surface-2 with no shadow reads as
    chrome, which is what they are, and drops the ghost-card double elevation.
  -->
  <nav
    aria-label={m.aujourdhuiHandoffsLabel()}
    class={[
      'min-w-0 lg:col-start-1',
      showStatTiles ? 'lg:row-start-4' : 'lg:row-span-2 lg:row-start-2'
    ]}
  >
    <ul class="flex flex-col gap-2">
      {#each handoffs as handoff (handoff.href)}
        <li>
          <a
            href={handoff.href}
            class="flex items-center justify-between gap-3 rounded-tile bg-surface-2 px-3 py-3 transition-transform duration-base ease-soft active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span class="flex min-w-0 items-center gap-3">
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full {handoff.accent}"
              >
                <handoff.icon size={18} aria-hidden="true" />
              </span>
              <!-- Wraps rather than truncates: in the desktop bento's third
                   column "Bilan pour le pédiatre" lost its last word to an
                   ellipsis, and a four-word destination label is worth a
                   second line. -->
              <span class="text-sm font-bold leading-tight">{handoff.label}</span>
            </span>
            <ChevronRight size={16} class="shrink-0 text-ink-soft" aria-hidden="true" />
          </a>
        </li>
      {/each}
    </ul>
  </nav>
</div>

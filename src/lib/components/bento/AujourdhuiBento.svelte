<!-- src/lib/components/bento/AujourdhuiBento.svelte -->
<script lang="ts">
  import StatTiles from './StatTiles.svelte';
  import AllergensSnapshot, { type AllergenPillState } from './AllergensSnapshot.svelte';
  import ReminderStrip from './ReminderStrip.svelte';
  import RecentFeed from './RecentFeed.svelte';
  import type { Reminder } from '$lib/server/guidance/reminders';
  import type { RecentEntry } from '$lib/types';
  import { PRIORITY_INTRODUCTION_ALLERGENS } from '$lib/utils/allergens';
  import { localizedHref } from '$lib/utils/localized-href';
  import * as m from '$lib/paraglide/messages';
  import { FileText, ChevronRight, UtensilsCrossed } from 'lucide-svelte';

  type Stats = {
    foodsIntroduced: number;
    weekCount: number;
    allergens: {
      introduced: number;
      total: number;
      ras: number;
      inconfort: number;
      reaction: number;
    };
  };

  // Mirrors AllergenItem from $lib/server/guidance/allergen-status — declared
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
    allergens: AllergenStatusItem[];
  } = $props();

  const PRIORITY_SET = new Set<string>(PRIORITY_INTRODUCTION_ALLERGENS);

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
        .filter((a) => a.state === 'todo' && PRIORITY_SET.has(a.id))
        .slice(0, 3)
        .map((a) => toPill(a, 'todo'))
    ];
  });

  const clearedCount = $derived(allergens.filter((a) => a.state === 'cleared').length);

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
  they actually need, and the two hand-off destinations sit together in the
  last column. Vertical rhythm still comes from each child's own mb-3, so the
  grid only supplies column gaps (gap-y-0).
-->
<div class="lg:grid lg:grid-cols-3 lg:items-start lg:gap-x-3 lg:gap-y-0">
  <div class="min-w-0 lg:col-span-3">
    <ReminderStrip {reminders} />
  </div>

  <div class="min-w-0 lg:col-span-1">
    <StatTiles
      foodsIntroduced={stats.foodsIntroduced}
      weekCount={stats.weekCount}
      streakCurrent={streak}
      {streakRecord}
    />
  </div>

  <div class="min-w-0 lg:col-span-2">
    <AllergensSnapshot
      items={allergenPills}
      {clearedCount}
      foodsHref={localizedHref(`/child/${childId}/foods?segment=allergens`)}
    />
  </div>

  <div class="min-w-0 lg:col-span-2">
    <RecentFeed entries={recent} {childId} />
  </div>

  <!--
    Destinations, not data. These used to reuse the feed row's exact anatomy
    (canvas + hairline + soft shadow at 62px), so "places to go" and "things
    that happened" were indistinguishable. surface-2 with no shadow reads as
    chrome, which is what they are, and drops the ghost-card double elevation.
  -->
  <nav aria-label={m.aujourdhuiHandoffsLabel()} class="min-w-0 lg:col-span-1">
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

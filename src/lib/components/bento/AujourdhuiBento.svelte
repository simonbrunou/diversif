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
    state: 'cleared' | 'todo' | 'reaction' | 'fading';
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

  // Real allergen names from loadAllergenStatus. Attention-worthy states
  // first (reaction, fading), then a few introduced ones for reassurance,
  // then the next priority allergens to try. When nothing has been
  // introduced yet, an empty list makes the snapshot render its
  // "commencez par l'œuf ou l'arachide" empty state instead of a wall of
  // "à découvrir" pills.
  const allergenPills = $derived.by(() => {
    const introduced = allergens.filter((a) => a.state !== 'todo');
    if (introduced.length === 0) return [];
    const reaction = introduced.filter((a) => a.state === 'reaction');
    const fading = introduced.filter((a) => a.state === 'fading');
    const cleared = introduced.filter((a) => a.state === 'cleared').slice(0, 3);
    const nextToTry = allergens
      .filter((a) => a.state === 'todo' && PRIORITY_SET.has(a.id))
      .slice(0, 3);
    const toPill = (a: AllergenStatusItem, state: AllergenPillState) => ({
      id: a.id,
      label: a.label,
      state
    });
    return [
      ...reaction.map((a) => toPill(a, 'reaction')),
      ...fading.map((a) => toPill(a, 'fading')),
      ...cleared.map((a) => toPill(a, 'ok')),
      ...nextToTry.map((a) => toPill(a, 'todo'))
    ];
  });
</script>

<div class="flex flex-col">
  <ReminderStrip {reminders} />
  <StatTiles
    foodsIntroduced={stats.foodsIntroduced}
    weekCount={stats.weekCount}
    streakCurrent={streak}
    {streakRecord}
  />
  <AllergensSnapshot
    items={allergenPills}
    foodsHref={localizedHref(`/child/${childId}/foods?segment=allergens`)}
  />
  <RecentFeed entries={recent} {childId} />

  <a
    href={localizedHref(`/child/${childId}/menu`)}
    class="mb-3 flex items-center justify-between gap-3 rounded-tile border border-border/40 bg-canvas px-3 py-3 shadow-soft transition-transform duration-base ease-soft active:scale-[0.99]"
  >
    <span class="flex items-center gap-3">
      <span
        class="flex h-9 w-9 items-center justify-center rounded-full bg-accent-lilac/30 text-tile-lilac-foreground dark:bg-accent-lilac/20"
      >
        <UtensilsCrossed size={18} aria-hidden="true" />
      </span>
      <span class="text-sm font-bold leading-tight">{m.menuTitle()}</span>
    </span>
    <ChevronRight size={16} class="text-ink-soft" aria-hidden="true" />
  </a>

  <a
    href={localizedHref(`/child/${childId}/report`)}
    class="mb-3 flex items-center justify-between gap-3 rounded-tile border border-border/40 bg-canvas px-3 py-3 shadow-soft transition-transform duration-base ease-soft active:scale-[0.99]"
  >
    <span class="flex items-center gap-3">
      <span class="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2">
        <FileText size={18} aria-hidden="true" />
      </span>
      <span class="text-sm font-bold leading-tight">{m.reportHandoffTitle()}</span>
    </span>
    <ChevronRight size={16} class="text-ink-soft" aria-hidden="true" />
  </a>
</div>

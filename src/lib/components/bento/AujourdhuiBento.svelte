<!-- src/lib/components/bento/AujourdhuiBento.svelte -->
<script lang="ts">
  import StatTiles from './StatTiles.svelte';
  import AllergensSnapshot from './AllergensSnapshot.svelte';
  import ReminderStrip from './ReminderStrip.svelte';
  import RecentFeed from './RecentFeed.svelte';
  import type { SuggestFood } from '$lib/utils/suggest';
  import type { Reminder } from '$lib/server/guidance/reminders';
  import type { RecentEntry } from '$lib/types';
  import { localizedHref } from '$lib/utils/localized-href';

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

  let {
    childId,
    recent,
    stats,
    streak,
    streakRecord,
    reminders,
    priorityAllergensTodo
  }: {
    childId: string;
    recent: RecentEntry[];
    stats: Stats;
    streak: number;
    streakRecord: number;
    reminders: Reminder[];
    priorityAllergensTodo: SuggestFood[];
  } = $props();

  // Phase 4 placeholder pill list: todo first, then synthetic "#N" ok
  // entries for the count diff. Phase 5 wires the real labels through
  // the existing allergen vocabulary.
  const allergenPills = $derived([
    ...priorityAllergensTodo.map((p) => ({
      id: String(p.id),
      label: p.name,
      state: 'todo' as const
    })),
    ...Array.from(
      { length: Math.max(0, stats.allergens.introduced - priorityAllergensTodo.length) },
      (_, i) => ({ id: `ok-${i}`, label: `#${i + 1}`, state: 'ok' as const })
    )
  ]);
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
</div>

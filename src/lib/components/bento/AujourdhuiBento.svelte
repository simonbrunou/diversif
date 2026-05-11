<!-- src/lib/components/bento/AujourdhuiBento.svelte -->
<script lang="ts">
  import HeroTile from './HeroTile.svelte';
  import StatTiles from './StatTiles.svelte';
  import AllergensSnapshot from './AllergensSnapshot.svelte';
  import ReminderStrip from './ReminderStrip.svelte';
  import RecentFeed from './RecentFeed.svelte';
  import { chooseSuggestedFood, type SuggestFood } from '$lib/utils/suggest';
  import type { Reminder } from '$lib/server/guidance/reminders';

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

  type RecentEntry = {
    id: number;
    foodId: number;
    foodName: string;
    category: string;
    reaction: 'ras' | 'inconfort' | 'reaction';
    givenAt: number;
  };

  let {
    childId,
    childName,
    recent,
    stats,
    streak,
    streakRecord,
    reminders,
    starterFoods,
    priorityAllergensTodo,
    onLog
  }: {
    childId: string;
    childName: string;
    recent: RecentEntry[];
    stats: Stats;
    streak: number;
    streakRecord: number;
    reminders: Reminder[];
    starterFoods: SuggestFood[];
    priorityAllergensTodo: SuggestFood[];
    onLog: (food: SuggestFood | null) => void;
  } = $props();

  const suggestion = $derived(
    chooseSuggestedFood({
      starterFoods,
      recent: recent.map((r) => ({
        foodId: r.foodId,
        foodName: r.foodName,
        category: r.category,
        givenAt: r.givenAt
      })),
      priorityAllergensTodo,
      now: Date.now()
    })
  );

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
  <HeroTile {childName} {suggestion} {onLog} />
  <StatTiles
    foodsIntroduced={stats.foodsIntroduced}
    weekCount={stats.weekCount}
    streakCurrent={streak}
    {streakRecord}
  />
  <AllergensSnapshot items={allergenPills} foodsHref={`/child/${childId}/foods?segment=allergens`} />
  <RecentFeed entries={recent} />
</div>

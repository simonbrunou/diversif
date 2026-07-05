<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { groupByMeal } from '$lib/utils/meals';
  import type { CoparentEntry } from '$lib/server/guidance/queries/timeline';

  let { activity }: { activity: CoparentEntry[] } = $props();

  // A co-parent's multi-ingredient meal is logged as several rows sharing a
  // mealId (contiguous once sorted givenAt desc / id asc, per groupByMeal's
  // contract). Fold them into one line per meal so the feed reads "Alice a
  // enregistré 3 ingrédients" instead of one near-identical line per
  // ingredient; singletons still render their own "a enregistré {food}" line.
  const activityGroups = $derived(groupByMeal(activity));
</script>

{#if activityGroups.length > 0}
  <ul class="mt-2 flex flex-col gap-2">
    {#each activityGroups as group (group.members[0].id)}
      <li class="flex items-center gap-3 rounded-tile bg-surface px-3 py-2 shadow-soft">
        <span class="flex h-8 w-8 items-center justify-center rounded-full bg-tile-lilac text-xs font-bold">
          {group.members[0].loggedByName.charAt(0)}
        </span>
        <span class="flex-1 text-sm">
          {#if group.members.length > 1}
            {m.profilCoparentsActivityMeal({
              name: group.members[0].loggedByName,
              count: group.members.length
            })}
          {:else}
            {m.profilCoparentsActivityEntry({
              name: group.members[0].loggedByName,
              food: group.members[0].foodName
            })}
          {/if}
        </span>
      </li>
    {/each}
  </ul>
{/if}

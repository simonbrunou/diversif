<script lang="ts">
  import DashedActionRow from '$components/ui/DashedActionRow.svelte';
  import EmptyHint from '$components/ui/EmptyHint.svelte';
  import SectionHeader from '$components/ui/SectionHeader.svelte';
  import * as m from '$lib/paraglide/messages';
  import { groupByMeal } from '$lib/utils/meals';
  import type { CoparentEntry } from '$lib/server/guidance/queries/timeline';
  import { UserPlus } from 'lucide-svelte';

  type Coparent = { id: string; displayName: string; role: string };

  let {
    childName,
    coparents,
    inviteHref,
    activity = []
  }: {
    childName: string;
    coparents: Coparent[];
    inviteHref: string;
    activity?: CoparentEntry[];
  } = $props();

  // A co-parent's multi-ingredient meal is logged as several rows sharing a
  // mealId (contiguous once sorted givenAt desc / id asc, per groupByMeal's
  // contract). Fold them into one line per meal so the feed reads "Alice a
  // enregistré 3 ingrédients" instead of one near-identical line per
  // ingredient; singletons still render their own "a enregistré {food}" line.
  const activityGroups = $derived(groupByMeal(activity));
</script>

<section class="mb-3">
  <SectionHeader>{m.profilCoparentsTitle()} · {childName}</SectionHeader>
  {#if coparents.length === 0}
    <EmptyHint>{m.profilCoparentsEmpty()}</EmptyHint>
  {:else}
    <ul class="flex flex-col gap-2">
      {#each coparents as cp (cp.id)}
        <li class="flex items-center gap-3 rounded-tile bg-surface px-3 py-2 shadow-soft">
          <span class="flex h-8 w-8 items-center justify-center rounded-full bg-tile-lilac text-xs font-bold">
            {cp.displayName.charAt(0)}
          </span>
          <span class="flex-1 text-sm font-bold">{cp.displayName}</span>
          <span class="text-xs text-ink-soft">{cp.role}</span>
        </li>
      {/each}
    </ul>
  {/if}
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
  <DashedActionRow href={inviteHref} icon={UserPlus} class="mt-2 flex">
    {m.profilCoparentsInvite()}
  </DashedActionRow>
</section>

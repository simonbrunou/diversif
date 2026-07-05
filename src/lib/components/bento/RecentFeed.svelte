<script lang="ts">
  import CalloutCard from '$components/ui/CalloutCard.svelte';
  import SectionHeader from '$components/ui/SectionHeader.svelte';
  import Button from '$components/ui/Button.svelte';
  import * as m from '$lib/paraglide/messages';
  import { formatRelative } from '$lib/utils/dates';
  import { getCategoryIcon } from '$lib/utils/categories';
  import { cn } from '$lib/utils/cn';
  import { localizedHref } from '$lib/utils/localized-href';
  import type { RecentEntry } from '$lib/types';
  import { getTextureLabel } from '$lib/utils/texture-labels';
  import { groupByMeal, type MealGroup } from '$lib/utils/meals';
  import { UtensilsCrossed } from 'lucide-svelte';

  let { entries, childId }: { entries: RecentEntry[]; childId: string } = $props();

  // A multi-ingredient meal is logged as several food_entries rows sharing a
  // mealId (contiguous once sorted givenAt desc / id asc, per groupByMeal's
  // contract). Fold them into one group per meal so the feed shows "one meal,
  // one card" instead of one row per ingredient; singletons stay one group each.
  const groups = $derived(groupByMeal(entries));
  const visible = $derived(groups.slice(0, 5));

  function reactionLabel(r: RecentEntry['reaction']): string {
    if (r === 'inconfort') return m.reactionsLabelInconfort();
    if (r === 'reaction') return m.reactionsLabelReaction();
    return m.reactionsLabelRas();
  }

  function reactionPillClass(r: RecentEntry['reaction']): string {
    if (r === 'inconfort') return 'bg-tile-butter';
    if (r === 'reaction') return 'bg-reaction-reaction text-reaction-reaction-foreground';
    return 'bg-tile-mint';
  }
</script>

{#snippet reactionPill(r: RecentEntry['reaction'])}
  <span
    class={cn('rounded-full px-2 py-0.5 text-xs font-semibold', reactionPillClass(r))}
  >
    {reactionLabel(r)}
  </span>
{/snippet}

{#snippet entryBody(entry: RecentEntry)}
  {@const Icon = getCategoryIcon(entry.category)}
  <span class="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2">
    <Icon size={18} aria-hidden="true" />
  </span>
  <span class="flex-1">
    <p class="text-sm font-bold leading-tight">
      {entry.foodName}
      {#if entry.texture}
        <span class="text-[11px] uppercase tracking-wide text-muted-foreground">
          · {getTextureLabel(entry.texture)}
        </span>
      {/if}
    </p>
    <p class="text-xs text-ink-soft">{formatRelative(entry.givenAt)}</p>
  </span>
  {@render reactionPill(entry.reaction)}
{/snippet}

{#snippet mealBody(group: MealGroup<RecentEntry>)}
  <span class="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2">
    <UtensilsCrossed size={18} aria-hidden="true" />
  </span>
  <span class="flex-1">
    <p class="text-sm font-bold leading-tight">
      {group.members.map((entry) => entry.foodName).join(', ')}
    </p>
    <p class="text-xs text-ink-soft">{formatRelative(group.givenAt)}</p>
  </span>
  {@render reactionPill(group.worst)}
{/snippet}

<section class="mb-3">
  <SectionHeader>{m.aujourdhuiRecentTitle()}</SectionHeader>
  {#if visible.length === 0}
    <CalloutCard icon={UtensilsCrossed} title={m.aujourdhuiRecentEmpty()}>
      {#snippet action()}
        <Button href={localizedHref(`/child/${childId}/log`)} size="sm">
          {m.aujourdhuiRecentEmptyCta()}
        </Button>
      {/snippet}
      {m.aujourdhuiRecentEmptyBody()}
    </CalloutCard>
  {:else}
    <ul class="flex flex-col gap-2">
      {#each visible as group, i (group.members[0].id)}
        <li class="animate-feed-item" style="--i: {i}">
          {#if group.members.length > 1}
            <a
              href={localizedHref(`/child/${childId}/log/${group.members[0].id}?from=dashboard`)}
              class="flex items-center gap-3 rounded-tile border border-border/40 bg-canvas px-3 py-2 shadow-soft"
            >
              {@render mealBody(group)}
            </a>
          {:else}
            <a
              href={localizedHref(`/child/${childId}/foods/${group.members[0].id}`)}
              class="flex items-center gap-3 rounded-tile border border-border/40 bg-canvas px-3 py-2 shadow-soft"
            >
              {@render entryBody(group.members[0])}
            </a>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

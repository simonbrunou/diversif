<script lang="ts">
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
  import { UtensilsCrossed, ChevronRight, Pencil, Plus } from 'lucide-svelte';

  let { entries, childId }: { entries: RecentEntry[]; childId: string } = $props();

  // A multi-ingredient meal is logged as several food_entries rows sharing a
  // mealId (contiguous once sorted givenAt desc / id asc, per groupByMeal's
  // contract). Fold them into one group per meal so the feed shows "one meal,
  // one card" instead of one row per ingredient; singletons stay one group each.
  const groups = $derived(groupByMeal(entries));
  const visible = $derived(groups.slice(0, 5));

  // Show "par {name}" only once the visible feed actually mixes loggers. In a
  // single-caregiver household every row is the same person — printing their
  // name on all five rows is decorative noise, not information. The moment a
  // co-parent logs something, distinct authors appear and the attribution
  // becomes the signal that answers "who fed the baby this?".
  const showAuthors = $derived(
    new Set(visible.map((g) => g.members[0].loggedByName)).size > 1
  );

  function reactionLabel(r: RecentEntry['reaction']): string {
    if (r === 'inconfort') return m.reactionsLabelInconfort();
    if (r === 'reaction') return m.reactionsLabelReaction();
    return m.reactionsLabelRas();
  }

  function reactionPillClass(r: RecentEntry['reaction']): string {
    if (r === 'inconfort') return 'bg-tile-butter text-tile-butter-foreground';
    if (r === 'reaction') return 'bg-reaction-reaction text-reaction-reaction-foreground';
    return 'bg-tile-mint text-tile-mint-foreground';
  }
</script>

{#snippet reactionPill(r: RecentEntry['reaction'])}
  <span
    class={cn(
      'shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold',
      reactionPillClass(r)
    )}
  >
    {reactionLabel(r)}
  </span>
{/snippet}

{#snippet entryBody(entry: RecentEntry)}
  {@const Icon = getCategoryIcon(entry.category)}
  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2">
    <Icon size={18} aria-hidden="true" />
  </span>
  <!-- min-w-0 lets this flex child shrink below its content width; basis-24
       gives it a 6rem preferred width so at a 195px viewport (200% zoom) the
       reaction pill wraps to a second line instead of squeezing the food name
       to zero and overflowing the card. Neither changes the 390px layout. -->
  <span class="min-w-0 flex-1 basis-24">
    <p class="text-sm font-bold leading-tight">
      {entry.foodName}
      {#if entry.texture}
        <!--
          The texture is a fact about the meal, so it is set as data: body
          scale, normal weight, sentence case. It used to carry the Label
          treatment (uppercase + 0.08em tracking), which DESIGN.md reserves
          for compartment labels and eyebrows — so "PETITS MORCEAUX" shouted
          alongside the food name and wrapped mid-phrase in a 390px row.
        -->
        <span class="text-xs font-normal text-ink-soft">
          · {getTextureLabel(entry.texture)}
        </span>
      {/if}
    </p>
    <p class="text-xs text-ink-soft">
      {formatRelative(entry.givenAt)}
      {#if showAuthors}
        · <span>{m.aujourdhuiRecentLoggedBy({ name: entry.loggedByName })}</span>
      {/if}
    </p>
  </span>
  {@render reactionPill(entry.reaction)}
{/snippet}

{#snippet mealBody(group: MealGroup<RecentEntry>)}
  <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2">
    <UtensilsCrossed size={18} aria-hidden="true" />
  </span>
  <span class="min-w-0 flex-1 basis-24">
    <p class="text-sm font-bold leading-tight">
      {group.members.map((entry) => entry.foodName).join(', ')}
    </p>
    <p class="text-xs text-ink-soft">
      {formatRelative(group.givenAt)}
      {#if showAuthors}
        · <span>{m.aujourdhuiRecentLoggedBy({ name: group.members[0].loggedByName })}</span>
      {/if}
    </p>
  </span>
  {@render reactionPill(group.worst)}
{/snippet}

<section class="mb-3">
  <SectionHeader>{m.aujourdhuiRecentTitle()}</SectionHeader>
  {#if visible.length === 0}
    <div
      class="flex flex-col items-center justify-center gap-1 rounded-tile bg-surface px-6 py-10 text-center shadow-soft"
    >
      <span
        class="mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-primary-strong"
      >
        <UtensilsCrossed size={26} aria-hidden="true" />
      </span>
      <h2 class="text-base font-semibold">{m.aujourdhuiRecentEmpty()}</h2>
      <p class="mt-1 max-w-sm text-sm text-ink-soft">{m.aujourdhuiRecentEmptyBody()}</p>
      <!--
        This state described what would happen and offered no way to make it
        happen: the only route out was the log FAB, which a first-time parent
        has no reason to read as "start here". A freshly created child landed
        on a dead end on the one screen whose entire job is the first log.

        tile-mint rather than the default sage, matching the carnet's own
        empty-state CTA: sage-on-ink measures 4.78:1 against a 4.5 floor and
        axe already caught that pairing dipping under threshold on the sibling
        button. The mint pair has 7.32:1.
      -->
      <Button
        href={localizedHref(`/child/${childId}/log`)}
        variant="tile-mint"
        class="mt-4 gap-1.5"
      >
        <Plus size={16} aria-hidden="true" />
        {m.aujourdhuiRecentEmptyCta()}
      </Button>
    </div>
  {:else}
    <ul class="flex flex-col gap-2">
      {#each visible as group, i (group.members[0].id)}
        <li class="animate-feed-item" style="--i: {i}">
          {#if group.members.length > 1}
            <a
              href={localizedHref(`/child/${childId}/log/${group.members[0].id}?from=dashboard`)}
              data-testid="feed-row-edit"
              class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-tile bg-surface px-3 py-2 shadow-soft"
            >
              {@render mealBody(group)}
              <Pencil size={16} class="shrink-0 text-ink-soft" aria-hidden="true" />
            </a>
          {:else}
            <a
              href={localizedHref(`/child/${childId}/foods/${group.members[0].id}`)}
              data-testid="feed-row-detail"
              class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-tile bg-surface px-3 py-2 shadow-soft"
            >
              {@render entryBody(group.members[0])}
              <ChevronRight size={16} class="shrink-0 text-ink-soft" aria-hidden="true" />
            </a>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

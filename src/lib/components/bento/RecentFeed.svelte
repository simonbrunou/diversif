<script lang="ts">
  import EmptyHint from '$components/ui/EmptyHint.svelte';
  import SectionHeader from '$components/ui/SectionHeader.svelte';
  import * as m from '$lib/paraglide/messages';
  import { formatRelative } from '$lib/utils/dates';
  import { getCategoryIcon } from '$lib/utils/categories';
  import { cn } from '$lib/utils/cn';
  import type { RecentEntry } from '$lib/types';

  let { entries, childId }: { entries: RecentEntry[]; childId: string } = $props();

  const visible = $derived(entries.slice(0, 5));

  function reactionLabel(r: RecentEntry['reaction']): string {
    if (r === 'inconfort') return m.reactionsLabelInconfort();
    if (r === 'reaction') return m.reactionsLabelReaction();
    return m.reactionsLabelRas();
  }

  function reactionPillClass(r: RecentEntry['reaction']): string {
    if (r === 'inconfort') return 'bg-tile-butter';
    if (r === 'reaction') return 'bg-tile-coral text-tile-coral-foreground';
    return 'bg-tile-mint';
  }
</script>

{#snippet entryBody(entry: RecentEntry)}
  {@const Icon = getCategoryIcon(entry.category)}
  <span class="flex h-9 w-9 items-center justify-center rounded-full bg-surface-2">
    <Icon size={18} aria-hidden="true" />
  </span>
  <span class="flex-1">
    <p class="text-sm font-bold leading-tight">{entry.foodName}</p>
    <p class="text-xs text-ink-soft">{formatRelative(entry.givenAt)}</p>
  </span>
  <span
    class={cn(
      'rounded-full px-2 py-0.5 text-xs font-semibold',
      reactionPillClass(entry.reaction)
    )}
  >
    {reactionLabel(entry.reaction)}
  </span>
{/snippet}

<section class="mb-3">
  <SectionHeader>{m.aujourdhuiRecentTitle()}</SectionHeader>
  {#if visible.length === 0}
    <EmptyHint class="p-4">{m.aujourdhuiRecentEmpty()}</EmptyHint>
  {:else}
    <ul class="flex flex-col gap-2">
      {#each visible as entry, i (entry.id)}
        <li class="animate-feed-item" style="--i: {i}">
          {#if entry.reaction !== 'ras'}
            <a
              href="/child/{childId}/foods/{entry.id}"
              class="flex items-center gap-3 rounded-tile border border-border/40 bg-canvas px-3 py-2 shadow-soft"
            >
              {@render entryBody(entry)}
            </a>
          {:else}
            <div
              class="flex items-center gap-3 rounded-tile border border-border/40 bg-canvas px-3 py-2 shadow-soft"
            >
              {@render entryBody(entry)}
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</section>

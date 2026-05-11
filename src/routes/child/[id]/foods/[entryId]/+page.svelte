<script lang="ts">
  import ReactionDetailBento from '$lib/components/bento/ReactionDetailBento.svelte';
  import RasCard from '$lib/components/bento/RasCard.svelte';
  import * as m from '$lib/paraglide/messages';
  import { ChevronLeft } from 'lucide-svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

{#if data.isRas}
  <div class="flex flex-col">
    <a
      href={`/child/${data.childId}/foods`}
      class="mb-2 inline-flex items-center gap-1 text-sm text-ink-soft"
    >
      <ChevronLeft size={16} aria-hidden="true" />
      {m.reactionBackToCarnet()}
    </a>
    <h1 class="font-display text-2xl italic leading-tight">
      {m.reactionTitle({ food: data.food })}
    </h1>
    <p class="mb-3 text-xs text-ink-soft">
      {m.reactionSubtitle({ date: data.date, time: data.time, nth: String(data.nth) })}
    </p>
    <RasCard nth={data.nth} />
  </div>
{:else}
  <ReactionDetailBento
    childId={String(data.childId)}
    entryId={data.entryId}
    food={data.food}
    nth={data.nth}
    date={data.date}
    time={data.time}
    symptoms={data.symptoms}
    printHref={`/child/${data.childId}/foods/${data.entryId}/print`}
  />
{/if}

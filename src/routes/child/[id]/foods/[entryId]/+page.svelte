<script lang="ts">
  import ReactionDetailBento from '$lib/components/bento/ReactionDetailBento.svelte';
  import RasCard from '$lib/components/bento/RasCard.svelte';
  import AddSymptomSheet from '$lib/components/bento/AddSymptomSheet.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';
  import { ChevronLeft } from 'lucide-svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let lateReactionOpen = $state(false);
</script>

{#if data.isRas}
  <div class="flex flex-col">
    <a
      href={localizedHref(`/child/${data.childId}/foods`)}
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
    <Button
      variant="secondary"
      size="sm"
      class="mt-3 self-start"
      onclick={() => (lateReactionOpen = true)}
    >
      {m.lateReactionButton()}
    </Button>

    <AddSymptomSheet
      bind:open={lateReactionOpen}
      action={localizedHref(`/child/${data.childId}/foods/${data.entryId}`)}
    />
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
    printHref={localizedHref(`/child/${data.childId}/foods/${data.entryId}/print`)}
  />
{/if}

<script lang="ts">
  import ReactionDetailBento from '$lib/components/bento/ReactionDetailBento.svelte';
  import RasCard from '$lib/components/bento/RasCard.svelte';
  import AddSymptomSheet from '$lib/components/bento/AddSymptomSheet.svelte';
  import Button from '$lib/components/ui/Button.svelte';
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';
  import { getTextureLabel } from '$lib/utils/texture-labels';
  import { ChevronLeft, Pencil } from 'lucide-svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
  let lateReactionOpen = $state(false);
  const editHref = $derived(
    localizedHref(`/child/${data.childId}/log/${data.entryId}?from=detail`)
  );
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
    {#if data.texture}
      <p class="mb-3 text-xs text-ink-soft">
        <span class="text-muted-foreground">{m.textureDetailRowLabel()}</span>
        · <span class="font-medium">{getTextureLabel(data.texture)}</span>
      </p>
    {/if}
    <RasCard nth={data.nth} />
    <div class="mt-3 flex flex-wrap gap-2">
      <Button
        variant="secondary"
        size="sm"
        onclick={() => (lateReactionOpen = true)}
      >
        {m.lateReactionButton()}
      </Button>
      <Button href={editHref} variant="ghost" size="sm">
        <Pencil size={14} aria-hidden="true" />
        {m.reactionEditEntry()}
      </Button>
    </div>

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
    texture={data.texture}
    symptoms={data.symptoms}
    printHref={localizedHref(`/child/${data.childId}/foods/${data.entryId}/print`)}
    {editHref}
  />
{/if}

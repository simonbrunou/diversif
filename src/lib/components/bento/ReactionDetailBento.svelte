<script lang="ts">
  import ReassuranceHero from './ReassuranceHero.svelte';
  import SymptomList from './SymptomList.svelte';
  import AddSymptomSheet from './AddSymptomSheet.svelte';
  import StayCoolCard from './StayCoolCard.svelte';
  import SevereRail from './SevereRail.svelte';
  import MonitorTimer from './MonitorTimer.svelte';
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';
  import { type TextureKey } from '$lib/utils/textures';
  import { getTextureLabel } from '$lib/utils/texture-labels';
  import type { SymptomEntry } from '$lib/types';
  import { ChevronLeft, Pencil } from 'lucide-svelte';

  let {
    childId,
    entryId,
    food,
    nth,
    date,
    time,
    texture = null,
    symptoms,
    printHref,
    editHref
  }: {
    childId: string;
    entryId: number;
    food: string;
    nth: number;
    date: string;
    time: string;
    texture?: TextureKey | null;
    symptoms: SymptomEntry[];
    printHref: string;
    editHref: string;
  } = $props();

  let addOpen = $state(false);
  const entryAction = $derived(localizedHref(`/child/${childId}/foods/${entryId}`));
</script>

<div class="flex flex-col">
  <a
    href={localizedHref(`/child/${childId}/foods`)}
    class="mb-2 inline-flex items-center gap-1 text-sm text-ink-soft"
  >
    <ChevronLeft size={16} aria-hidden="true" />
    {m.reactionBackToCarnet()}
  </a>
  <h1 class="font-display text-2xl italic leading-tight">
    {m.reactionTitle({ food })}
  </h1>
  <p class="mb-3 text-xs text-ink-soft">
    {m.reactionSubtitle({ date, time, nth: String(nth) })}
  </p>
  <!-- Row treatment for labelled-detail contexts; feed/list chips use uppercase tracking-wide instead. -->
  {#if texture}
    <p class="mb-3 text-xs text-ink-soft">
      <span class="text-muted-foreground">{m.textureDetailRowLabel()}</span>
      · <span class="font-medium">{getTextureLabel(texture)}</span>
    </p>
  {/if}

  <ReassuranceHero />
  <SymptomList {symptoms} onAdd={() => (addOpen = true)} action={entryAction} />
  <StayCoolCard {childId} />
  <SevereRail />
  <MonitorTimer entryId={String(entryId)} />

  <a
    href={printHref}
    target="_blank"
    rel="noopener"
    class="mb-3 inline-block w-full rounded-full border border-primary px-4 py-3 text-center text-sm font-bold text-primary-strong shadow-soft transition-transform duration-base ease-soft active:scale-[0.99]"
  >
    {m.reactionExport()}
  </a>
  <a
    href={editHref}
    class="mb-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-border px-4 py-3 text-center text-sm font-semibold text-ink-soft shadow-soft transition-transform duration-base ease-soft active:scale-[0.99]"
  >
    <Pencil size={14} aria-hidden="true" />
    {m.reactionEditEntry()}
  </a>
</div>

<AddSymptomSheet bind:open={addOpen} action={entryAction} />

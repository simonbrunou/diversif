<script lang="ts">
  import DiscoverBento from '$lib/components/bento/DiscoverBento.svelte';
  import Callout from '$lib/components/ui/Callout.svelte';
  import LinkRow from '$lib/components/ui/LinkRow.svelte';
  import { localizedHref } from '$lib/utils/localized-href';
  import * as m from '$lib/paraglide/messages';
  import { BookOpen, ChevronRight, Lightbulb } from 'lucide-svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

{#if data.ageMonths < 4}
  <Callout variant="info" class="mb-3">
    <strong>{m.preDiversificationTitle()}</strong> {m.preDiversificationBody()}
  </Callout>
{/if}

<DiscoverBento
  stages={data.stages}
  activeStageId={data.currentStageId}
/>

<LinkRow
  href={localizedHref(`/child/${data.child.id}/suggestions`)}
  variant="tile-lilac"
  lift
  class="mb-3"
>
  <Lightbulb size={18} class="shrink-0" aria-hidden="true" />
  <span class="min-w-0 flex-1">
    <span class="block text-sm font-bold leading-tight">{m.decouvrirSuggestionsTitle()}</span>
    <span class="mt-0.5 block text-xs text-ink-soft">{m.decouvrirSuggestionsBody()}</span>
  </span>
  <ChevronRight size={16} class="shrink-0 text-ink-soft" aria-hidden="true" />
</LinkRow>

<LinkRow href={localizedHref('/guide')} variant="surface" lift class="mb-3 border border-border/40">
  <BookOpen size={18} class="shrink-0 text-ink-soft" aria-hidden="true" />
  <span class="flex-1 text-sm font-bold leading-tight">{m.decouvrirFullGuideLink()}</span>
  <ChevronRight size={16} class="shrink-0 text-ink-soft" aria-hidden="true" />
</LinkRow>

<Callout variant="info" class="mt-4">{m.guideMedicalDisclaimer()}</Callout>

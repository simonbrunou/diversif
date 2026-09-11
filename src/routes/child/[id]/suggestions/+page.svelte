<script lang="ts">
  import BackHeader from '$components/ui/BackHeader.svelte';
  import CalloutCard from '$components/ui/CalloutCard.svelte';
  import TipCard from '$lib/components/TipCard.svelte';
  import SuggestionsPriorityAllergens from '$lib/components/suggestions/SuggestionsPriorityAllergens.svelte';
  import SuggestionsCategorySection from '$lib/components/suggestions/SuggestionsCategorySection.svelte';
  import { CATEGORIES, getCategoryLabel } from '$lib/utils/categories';
  import { Sparkles, Lightbulb } from 'lucide-svelte';
  import * as m from '$lib/paraglide/messages';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  function logHref(foodId: number): string {
    return `/child/${data.child.id}/log?foodId=${foodId}`;
  }

  function groupByCategory(items: typeof data.others) {
    const groups = new Map<string, typeof data.others>();
    for (const f of items) {
      if (!groups.has(f.category)) groups.set(f.category, []);
      groups.get(f.category)!.push(f);
    }
    return CATEGORIES.map((c) => ({
      id: c.id,
      label: getCategoryLabel(c.id),
      items: groups.get(c.id) ?? []
    })).filter((g) => g.items.length > 0);
  }

  const otherGroups = $derived(groupByCategory(data.others));
  const hasSuggestions = $derived(data.priorityAllergens.length > 0 || data.others.length > 0);
</script>

<div class="mx-auto w-full px-4 max-w-2xl space-y-6 py-6">
  <BackHeader
    title={m.suggestionsTitle()}
    subtitle={data.ageMonths < 4
      ? m.menuMilkPrimary()
      : data.ageMonths === 1
        ? m.suggestionsSubtitleOne({ name: data.child.name })
        : m.suggestionsSubtitleOther({ name: data.child.name, ageMonths: data.ageMonths })}
    fallback={`/child/${data.child.id}`}
  />

  {#if data.ageMonths < 4}
    <CalloutCard icon={Sparkles} title={m.preDiversificationTitle()}>
      {m.preDiversificationBody()}
    </CalloutCard>
  {:else}
    <TipCard
      tone="info"
      icon={Lightbulb}
      eyebrow={m.suggestionsTipEyebrow()}
      body={m.suggestionsTipBody()}
      sources={['spf-pnns-guide']}
    />

    {#if !hasSuggestions}
      <CalloutCard icon={Sparkles} title={m.suggestionsEmptyTitle()}>
        {m.suggestionsEmptyBody()}
      </CalloutCard>
    {:else}
      {#if data.priorityAllergens.length > 0}
        <SuggestionsPriorityAllergens foods={data.priorityAllergens} {logHref} />
      {/if}

      {#each otherGroups as g (g.id)}
        <SuggestionsCategorySection
          categoryId={g.id}
          label={g.label}
          foods={g.items}
          {logHref}
        />
      {/each}
    {/if}
  {/if}
</div>

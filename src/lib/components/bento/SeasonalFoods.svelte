<script lang="ts">
  import SectionHeader from '$components/ui/SectionHeader.svelte';
  import CalloutCard from '$components/ui/CalloutCard.svelte';
  import CategoryTag from '$lib/components/CategoryTag.svelte';
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';
  import { Sprout } from 'lucide-svelte';

  type Food = {
    id: number;
    name: string;
    category: string;
    allergenType: string | null;
  };

  let {
    foods,
    month,
    childId
  }: {
    foods: Food[];
    month: number;
    childId: string;
  } = $props();

  function monthLabel(m1to12: number): string {
    const key = `seasonalFoodsMonth${m1to12}` as
      | 'seasonalFoodsMonth1'
      | 'seasonalFoodsMonth2'
      | 'seasonalFoodsMonth3'
      | 'seasonalFoodsMonth4'
      | 'seasonalFoodsMonth5'
      | 'seasonalFoodsMonth6'
      | 'seasonalFoodsMonth7'
      | 'seasonalFoodsMonth8'
      | 'seasonalFoodsMonth9'
      | 'seasonalFoodsMonth10'
      | 'seasonalFoodsMonth11'
      | 'seasonalFoodsMonth12';
    return m[key]();
  }
</script>

<section class="mb-3">
  <SectionHeader>{m.seasonalFoodsTitle()}</SectionHeader>
  <p class="-mt-1 mb-3 text-xs text-ink-soft capitalize">
    {monthLabel(month)} · {m.seasonalFoodsSubtitle()}
  </p>

  {#if foods.length === 0}
    <CalloutCard icon={Sprout} title={m.seasonalFoodsTitle()}>
      {m.seasonalFoodsEmpty()}
    </CalloutCard>
  {:else}
    <ul class="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
      {#each foods as food (food.id)}
        <li class="shrink-0 snap-start">
          <a
            href={localizedHref(`/child/${childId}/log?foodId=${food.id}`)}
            class="inline-flex min-h-11 items-center gap-2 rounded-full border border-border/40 bg-canvas px-3 text-sm font-medium shadow-soft transition-transform duration-fast ease-soft active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <CategoryTag id={food.category} size="sm" />
            <span class="leading-tight">{food.name}</span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</section>

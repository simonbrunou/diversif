<script lang="ts">
  import FoodCardGrid from './FoodCardGrid.svelte';
  import CalloutCard from '$components/ui/CalloutCard.svelte';
  import Button from '$components/ui/Button.svelte';
  import * as m from '$lib/paraglide/messages';
  import { cn } from '$lib/utils/cn';
  import { getCategoryLabel, getCategoryClasses, getCategoryIcon } from '$lib/utils/categories';
  import { localizedHref } from '$lib/utils/localized-href';
  import type { TextureKey } from '$lib/utils/textures';
  import { Salad } from 'lucide-svelte';

  type Food = {
    id: number;
    name: string;
    category: string;
    tried: number;
    status: 'ras' | 'inconfort' | 'reaction' | 'todo';
    lastEntryId?: number | null;
    lastTexture?: TextureKey | null;
  };

  let { foods, childId }: { foods: Food[]; childId?: string } = $props();

  let active = $state<string>('');

  const categories = $derived(Array.from(new Set(foods.map((f) => f.category))).sort());

  const filtered = $derived(active === '' ? foods : foods.filter((f) => f.category === active));
</script>

<div>
  <!--
    These filter chips are the same control as the log screen's category
    filter (FoodCombobox), so they use its anatomy rather than a second one:
    each category carries its own tint and icon, selection is the sage fill,
    and `aria-pressed` announces toggle state — which this row previously
    omitted entirely, so a screen reader heard four plain buttons with no
    indication of which filter was active.
  -->
  <div role="group" aria-label={m.foodComboboxFilterAriaLabel()} class="mb-3 flex flex-wrap gap-2">
    <button
      type="button"
      aria-pressed={active === ''}
      onclick={() => (active = '')}
      class={cn(
        'inline-flex min-h-11 items-center whitespace-nowrap rounded-full border px-3 text-xs font-semibold transition-colors duration-fast ease-soft active:scale-[0.97]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        active === '' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
      )}
    >
      {m.carnetTousFilterAll()}
    </button>
    {#each categories as cat (cat)}
      {@const cls = getCategoryClasses(cat)}
      {@const Icon = getCategoryIcon(cat)}
      <button
        type="button"
        aria-pressed={active === cat}
        onclick={() => (active = active === cat ? '' : cat)}
        class={cn(
          'inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-full border px-3 text-xs font-semibold transition-colors duration-fast ease-soft active:scale-[0.97]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          active === cat
            ? 'bg-primary text-primary-foreground'
            : cn(cls.tint, cls.text, 'hover:brightness-95 dark:hover:brightness-110')
        )}
      >
        <Icon size={12} aria-hidden="true" />
        {getCategoryLabel(cat)}
      </button>
    {/each}
  </div>
  {#key active}
    <div class="animate-fade-in-soft">
      {#if filtered.length === 0}
        <CalloutCard icon={Salad} title={m.carnetTousEmpty()}>
          {#snippet action()}
            {#if active !== ''}
              <Button onclick={() => (active = '')} variant="outline" size="sm">
                {m.carnetTousEmptyFilteredCta()}
              </Button>
            {:else if childId}
              <!-- variant="tile-mint" not "default": bg-primary/text-primary-foreground
                   sits right at the 4.5:1 AA floor (~4.76:1 in theory) and axe measured
                   it dipping under threshold here (rounded-lg corner anti-aliasing +
                   this button's tight px-3 padding). tile-mint gives ~7.2:1, comfortable
                   headroom instead of a new color. -->
              <Button href={localizedHref(`/child/${childId}/log`)} variant="tile-mint" size="sm">
                {m.carnetTousEmptyAllCta()}
              </Button>
            {/if}
          {/snippet}
          {active !== '' ? m.carnetTousEmptyFilteredBody() : m.carnetTousEmptyAllBody()}
        </CalloutCard>
      {:else}
        <FoodCardGrid items={filtered} {childId} />
      {/if}
    </div>
  {/key}
</div>

<script lang="ts">
  import FoodCardGrid from './FoodCardGrid.svelte';
  import EmptyHint from '$components/ui/EmptyHint.svelte';
  import Button from '$components/ui/Button.svelte';
  import * as m from '$lib/paraglide/messages';
  import { cn } from '$lib/utils/cn';
  import { getCategoryLabel } from '$lib/utils/categories';
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
  <div class="mb-3 flex flex-wrap gap-2">
    <button
      type="button"
      onclick={() => (active = '')}
      class={cn(
        'inline-flex min-h-11 items-center whitespace-nowrap rounded-full border px-3 text-xs font-semibold transition-transform duration-fast ease-soft active:scale-[0.97]',
        active === ''
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border bg-canvas text-ink-soft'
      )}
    >
      {m.carnetTousFilterAll()}
    </button>
    {#each categories as cat (cat)}
      <button
        type="button"
        onclick={() => (active = cat)}
        class={cn(
          'inline-flex min-h-11 items-center whitespace-nowrap rounded-full border px-3 text-xs font-semibold transition-transform duration-fast ease-soft active:scale-[0.97]',
          active === cat
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-border bg-canvas text-ink-soft'
        )}
      >
        {getCategoryLabel(cat)}
      </button>
    {/each}
  </div>
  {#key active}
    <div class="animate-fade-in-soft">
      {#if filtered.length === 0}
        <EmptyHint icon={Salad} title={m.carnetTousEmpty()}>
          {#snippet action()}
            {#if active !== ''}
              <Button onclick={() => (active = '')} variant="outline" size="sm">
                {m.carnetTousEmptyFilteredCta()}
              </Button>
            {:else if childId}
              <Button href={localizedHref(`/child/${childId}/log`)} size="sm">
                {m.carnetTousEmptyAllCta()}
              </Button>
            {/if}
          {/snippet}
          {active !== '' ? m.carnetTousEmptyFilteredBody() : m.carnetTousEmptyAllBody()}
        </EmptyHint>
      {:else}
        <FoodCardGrid items={filtered} {childId} />
      {/if}
    </div>
  {/key}
</div>

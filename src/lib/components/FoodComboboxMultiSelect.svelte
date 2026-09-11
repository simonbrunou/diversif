<script lang="ts">
  import FoodComboboxList from '$lib/components/FoodComboboxList.svelte';
  import Badge from '$components/ui/Badge.svelte';
  import { X } from 'lucide-svelte';
  import * as m from '$lib/paraglide/messages';
  import type { Snippet } from 'svelte';

  type FoodOption = {
    id: number;
    name: string;
    category: string;
    allergenType: string | null;
  };

  let {
    name,
    selectedFoods,
    filtered,
    isCapped,
    query,
    onToggle,
    isSelected,
    customFoodSection
  }: {
    name: string;
    selectedFoods: FoodOption[];
    filtered: FoodOption[];
    isCapped: boolean;
    query: string;
    onToggle: (id: number) => void;
    isSelected: (id: number) => boolean;
    customFoodSection: Snippet;
  } = $props();
</script>

{#if selectedFoods.length > 0}
  <ul class="flex flex-wrap gap-1.5">
    {#each selectedFoods as f (f.id)}
      <li>
        <Badge variant="secondary" class="gap-1 py-0 pl-2.5 pr-0">
          {f.name}
          <button
            type="button"
            class="tap-target inline-flex items-center justify-center rounded-full hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={m.foodComboboxRemoveAria({ name: f.name })}
            onclick={() => onToggle(f.id)}
          >
            <X size={12} aria-hidden="true" />
          </button>
        </Badge>
      </li>
    {/each}
  </ul>
{/if}

<FoodComboboxList {filtered} {isCapped} {query} onPick={onToggle} {isSelected} />
{@render customFoodSection()}

{#each selectedFoods as f (f.id)}
  <input type="hidden" {name} value={f.id} />
{/each}

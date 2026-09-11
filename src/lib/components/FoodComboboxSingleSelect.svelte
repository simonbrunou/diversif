<script lang="ts">
  import CategoryTag from '$lib/components/CategoryTag.svelte';
  import FoodComboboxList from '$lib/components/FoodComboboxList.svelte';
  import { getAllergenLabel } from '$lib/utils/allergens';
  import * as m from '$lib/paraglide/messages';
  import type { Snippet } from 'svelte';

  type FoodOption = {
    id: number;
    name: string;
    category: string;
    allergenType: string | null;
  };

  let {
    selected,
    name,
    filtered,
    isCapped,
    query,
    onPick,
    changeButtonEl = $bindable(),
    customFoodSection
  }: {
    selected: FoodOption | null;
    name: string;
    filtered: FoodOption[];
    isCapped: boolean;
    query: string;
    onPick: (id: number) => void;
    changeButtonEl?: HTMLButtonElement;
    customFoodSection: Snippet;
  } = $props();
</script>

{#if selected}
  <div class="flex items-center justify-between rounded-md border bg-accent/40 p-3">
    <div class="min-w-0">
      <div class="truncate font-medium">{selected.name}</div>
      <div class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <CategoryTag id={selected.category} size="sm" />
        {#if selected.allergenType}
          <span class="text-reaction-inconfort-foreground"
            >· {getAllergenLabel(selected.allergenType)}</span
          >
        {/if}
      </div>
    </div>
    <button
      type="button"
      bind:this={changeButtonEl}
      class="inline-flex min-h-11 items-center rounded-sm text-sm text-muted-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      aria-label={m.foodComboboxChangeAria({ name: selected.name })}
      onclick={() => onPick(0)}
    >
      {m.foodComboboxChange()}
    </button>
  </div>
  <input type="hidden" {name} value={selected.id} />
{:else}
  <FoodComboboxList {filtered} {isCapped} {query} {onPick} />
  {@render customFoodSection()}
{/if}

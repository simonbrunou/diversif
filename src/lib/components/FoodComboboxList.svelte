<script lang="ts">
  import { normalize } from '$lib/utils/search';
  import { getAllergenLabel } from '$lib/utils/allergens';
  import CategoryTag from '$lib/components/CategoryTag.svelte';
  import { SearchX, ListFilter } from 'lucide-svelte';
  import * as m from '$lib/paraglide/messages';

  type FoodOption = {
    id: number;
    name: string;
    category: string;
    allergenType: string | null;
  };

  let {
    filtered,
    isCapped,
    query,
    onPick,
    isSelected
  }: {
    filtered: FoodOption[];
    isCapped: boolean;
    query: string;
    onPick: (id: number) => void;
    isSelected?: (id: number) => boolean;
  } = $props();
</script>

<ul class="max-h-72 divide-y overflow-y-auto rounded-md border bg-card">
  {#each filtered as f (f.id)}
    <li>
      <button
        type="button"
        aria-pressed={isSelected ? isSelected(f.id) : undefined}
        class="flex min-h-11 w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onclick={() => onPick(f.id)}
      >
        <span class="min-w-0 truncate">
          <span class="font-medium">{f.name}</span>
          {#if normalize(f.name).includes(normalize(query)) === false && query}
            <span class="ml-1 text-xs text-muted-foreground">{m.foodComboboxApproximate()}</span>
          {/if}
        </span>
        <span class="ml-2 flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
          <CategoryTag id={f.category} size="sm" />
          {#if f.allergenType}
            · {getAllergenLabel(f.allergenType)}
          {/if}
        </span>
      </button>
    </li>
  {:else}
    <li class="px-3 py-8 text-center">
      <SearchX class="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" />
      <p class="mt-2 text-sm font-medium">{m.foodComboboxNoneTitle()}</p>
      <p class="mt-1 text-xs text-muted-foreground">
        {#if query.trim()}
          {m.foodComboboxNoneForQuery({ query: query.trim() })}
        {:else}
          {m.foodComboboxNoneInCategory()}
        {/if}
      </p>
    </li>
  {/each}
  {#if isCapped}
    <li
      class="flex items-center justify-center gap-1.5 bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground"
    >
      <ListFilter size={12} aria-hidden="true" />
      <span>{m.foodComboboxCapped()}</span>
    </li>
  {/if}
</ul>

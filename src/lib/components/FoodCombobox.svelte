<script lang="ts">
  import { fuzzyMatch } from '$lib/utils/search';
  import { CATEGORIES, getCategoryClasses, getCategoryIcon } from '$lib/utils/categories';
  import { getAllergenLabel } from '$lib/utils/allergens';
  import CategoryTag from '$lib/components/CategoryTag.svelte';
  import FoodComboboxList from '$lib/components/FoodComboboxList.svelte';
  import FoodComboboxCustomPanel from '$lib/components/FoodComboboxCustomPanel.svelte';
  import Badge from '$components/ui/Badge.svelte';
  import Input from '$components/ui/Input.svelte';
  import { cn } from '$lib/utils/cn';
  import { X } from 'lucide-svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { tick } from 'svelte';
  import * as m from '$lib/paraglide/messages';

  type FoodOption = {
    id: number;
    name: string;
    category: string;
    allergenType: string | null;
  };

  let {
    foods,
    name = 'foodId',
    customName = 'customFood',
    initialFoodId = null,
    multiple = false,
    onCustomToggle,
    onSelectionChange
  }: {
    foods: FoodOption[];
    name?: string;
    customName?: string;
    initialFoodId?: number | null;
    multiple?: boolean;
    onCustomToggle?: (open: boolean) => void;
    onSelectionChange?: (ids: number[]) => void;
  } = $props();

  let query = $state('');
  let activeCategory = $state<string>('');
  // svelte-ignore state_referenced_locally
  let selectedId = $state<number | null>(initialFoodId);
  // svelte-ignore state_referenced_locally
  const selectedIds = new SvelteSet<number>(initialFoodId ? [initialFoodId] : []);
  let customOpen = $state(false);
  let customNameValue = $state('');
  let customCategory = $state<string>('autre');
  let rootEl: HTMLDivElement | undefined = $state();
  let changeButtonEl: HTMLButtonElement | undefined = $state();
  let hasMounted = false;

  const MAX_VISIBLE = 200;
  const filteredAll = $derived.by(() => {
    let list = foods;
    if (activeCategory) list = list.filter((f) => f.category === activeCategory);
    if (!query.trim()) return list;
    return list.filter((f) => fuzzyMatch(query, f.name));
  });
  const filtered = $derived(filteredAll.slice(0, MAX_VISIBLE));
  const isCapped = $derived(filteredAll.length > MAX_VISIBLE);

  const selected = $derived(foods.find((f) => f.id === selectedId) ?? null);
  // Insertion (click) order so chips, hidden inputs, and onSelectionChange agree.
  const selectedFoods = $derived(
    [...selectedIds]
      .map((id) => foods.find((f) => f.id === id))
      .filter((f): f is FoodOption => f !== undefined)
  );

  function pick(id: number) {
    selectedId = id;
    customOpen = false;
    onCustomToggle?.(false);
  }

  function toggle(id: number) {
    if (selectedIds.has(id)) selectedIds.delete(id);
    else selectedIds.add(id);
    onSelectionChange?.([...selectedIds]);
  }

  function openCustom() {
    customOpen = true;
    selectedId = null;
    onCustomToggle?.(true);
  }

  async function closeCustom() {
    customOpen = false;
    customNameValue = '';
    onCustomToggle?.(false);
    // The panel (and the "Annuler" button that triggered this) unmounts on the
    // next tick; without moving focus it falls to <body>. Restore it to the
    // always-present search input. Applies in both single- and multi-select
    // mode — the focus $effect below only covers the pick/"Changer" swap.
    await tick();
    rootEl?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
  }

  // Single-select mode swaps the food list for a summary card (and back) on
  // every pick/"Changer" click, unmounting the button the user just activated.
  // Move focus to the replacement content so it doesn't silently fall to <body>.
  $effect(() => {
    const current = selected;
    if (multiple) return;
    if (!hasMounted) {
      hasMounted = true;
      return;
    }
    if (current) {
      changeButtonEl?.focus();
    } else {
      rootEl?.querySelector<HTMLInputElement>('input[type="search"]')?.focus();
    }
  });
</script>

{#snippet searchBar()}
  <div class="grid gap-2">
    <Input
      type="search"
      placeholder={m.foodComboboxSearchPlaceholder()}
      aria-label={m.foodComboboxSearchPlaceholder()}
      bind:value={query}
      autocomplete="off"
    />
    <div
      role="group"
      aria-label={m.foodComboboxFilterAriaLabel()}
      class="-mx-1 flex flex-wrap gap-1 px-1"
    >
      <button
        type="button"
        class={cn(
          'inline-flex min-h-11 items-center rounded-full border px-2.5 text-xs font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          activeCategory === '' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
        )}
        aria-pressed={activeCategory === ''}
        onclick={() => (activeCategory = '')}
      >
        {m.foodComboboxFilterAll()}
      </button>
      {#each CATEGORIES as c (c.id)}
        {@const cls = getCategoryClasses(c.id)}
        {@const Icon = getCategoryIcon(c.id)}
        <button
          type="button"
          class={cn(
            'inline-flex min-h-11 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            activeCategory === c.id
              ? 'bg-primary text-primary-foreground'
              : cn(cls.tint, cls.text, 'hover:brightness-95 dark:hover:brightness-110')
          )}
          aria-pressed={activeCategory === c.id}
          onclick={() => (activeCategory = activeCategory === c.id ? '' : c.id)}
        >
          <Icon size={12} aria-hidden="true" />
          {c.label}
        </button>
      {/each}
    </div>
  </div>
  <!-- Announce the count actually reachable in the list (capped at MAX_VISIBLE),
       not filteredAll — otherwise a screen reader hears "5000 résultats" while
       only 200 are navigable. The visible foodComboboxCapped note flags the cap. -->
  <p aria-live="polite" class="sr-only">
    {filtered.length === 0
      ? m.foodComboboxNoneTitle()
      : filtered.length === 1
        ? m.foodComboboxResultsCountOne()
        : m.foodComboboxResultsCountOther({ count: filtered.length })}
  </p>
{/snippet}

{#snippet customFoodSection()}
  <FoodComboboxCustomPanel
    {customName}
    open={customOpen}
    bind:nameValue={customNameValue}
    bind:category={customCategory}
    onOpen={openCustom}
    onClose={closeCustom}
  />
{/snippet}

<div class="grid gap-3" bind:this={rootEl}>
  {@render searchBar()}

  {#if !multiple}
    {#if selected}
      <div class="flex items-center justify-between rounded-md border bg-accent/40 p-3">
        <div class="min-w-0">
          <div class="truncate font-medium">{selected.name}</div>
          <div class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <CategoryTag id={selected.category} size="sm" />
            {#if selected.allergenType}
              <span class="text-reaction-inconfort-foreground">· {getAllergenLabel(selected.allergenType)}</span>
            {/if}
          </div>
        </div>
        <button
          type="button"
          bind:this={changeButtonEl}
          class="rounded-sm text-sm text-muted-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={m.foodComboboxChangeAria({ name: selected.name })}
          onclick={() => pick(0)}
        >
          {m.foodComboboxChange()}
        </button>
      </div>
      <input type="hidden" {name} value={selected.id} />
    {:else}
      <FoodComboboxList {filtered} {isCapped} {query} onPick={pick} />
      {@render customFoodSection()}
    {/if}
  {:else}
    {#if selectedFoods.length > 0}
      <ul class="flex flex-wrap gap-1.5">
        {#each selectedFoods as f (f.id)}
          <li>
            <Badge variant="secondary" class="gap-1 py-1 pl-2.5 pr-1">
              {f.name}
              <button
                type="button"
                class="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={m.foodComboboxRemoveAria({ name: f.name })}
                onclick={() => toggle(f.id)}
              >
                <X size={12} aria-hidden="true" />
              </button>
            </Badge>
          </li>
        {/each}
      </ul>
    {/if}

    <FoodComboboxList
      {filtered}
      {isCapped}
      {query}
      onPick={toggle}
      isSelected={(id) => selectedIds.has(id)}
    />
    {@render customFoodSection()}

    {#each selectedFoods as f (f.id)}
      <input type="hidden" {name} value={f.id} />
    {/each}
  {/if}
</div>

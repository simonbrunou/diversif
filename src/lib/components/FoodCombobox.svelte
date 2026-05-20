<script lang="ts">
  import { fuzzyMatch, normalize } from '$lib/utils/search';
  import { CATEGORIES, getCategoryClasses, getCategoryIcon } from '$lib/utils/categories';
  import { getAllergenLabel } from '$lib/utils/allergens';
  import CategoryTag from '$lib/components/CategoryTag.svelte';
  import Input from '$components/ui/Input.svelte';
  import Select from '$components/ui/Select.svelte';
  import { cn } from '$lib/utils/cn';
  import { SearchX, ListFilter } from 'lucide-svelte';

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
    onCustomToggle
  }: {
    foods: FoodOption[];
    name?: string;
    customName?: string;
    initialFoodId?: number | null;
    onCustomToggle?: (open: boolean) => void;
  } = $props();

  let query = $state('');
  let activeCategory = $state<string>('');
  // svelte-ignore state_referenced_locally
  let selectedId = $state<number | null>(initialFoodId);
  let customOpen = $state(false);
  let customNameValue = $state('');
  let customCategory = $state<string>('autre');

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

  function pick(id: number) {
    selectedId = id;
    customOpen = false;
    onCustomToggle?.(false);
  }

  function openCustom() {
    customOpen = true;
    selectedId = null;
    onCustomToggle?.(true);
  }
</script>

<div class="grid gap-3">
  <div class="grid gap-2">
    <Input
      type="search"
      placeholder="Rechercher un aliment…"
      bind:value={query}
      autocomplete="off"
    />
    <div class="-mx-1 flex flex-wrap gap-1 px-1">
      <button
        type="button"
        class={cn(
          'inline-flex min-h-11 items-center rounded-full border px-3 text-xs font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          activeCategory === '' ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
        )}
        aria-pressed={activeCategory === ''}
        onclick={() => (activeCategory = '')}
      >
        Tous
      </button>
      {#each CATEGORIES as c (c.id)}
        {@const cls = getCategoryClasses(c.id)}
        {@const Icon = getCategoryIcon(c.id)}
        <button
          type="button"
          class={cn(
            'inline-flex min-h-11 items-center gap-1 rounded-full border px-3 text-xs font-medium transition-colors',
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

  {#if selected}
    <div class="flex items-center justify-between rounded-md border bg-accent/40 p-3">
      <div class="min-w-0">
        <div class="truncate font-medium">{selected.name}</div>
        <div class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          <CategoryTag id={selected.category} size="sm" />
          {#if selected.allergenType}
            <span class="text-reaction-inconfort">· {getAllergenLabel(selected.allergenType)}</span>
          {/if}
        </div>
      </div>
      <button
        type="button"
        class="rounded-sm text-sm text-muted-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`Changer l'aliment sélectionné (actuellement ${selected.name})`}
        onclick={() => pick(0)}
      >
        Changer
      </button>
    </div>
    <input type="hidden" {name} value={selected.id} />
  {:else}
    <ul class="max-h-72 divide-y overflow-y-auto rounded-md border bg-card">
      {#each filtered as f (f.id)}
        <li>
          <button
            type="button"
            class="flex w-full items-center justify-between px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            onclick={() => pick(f.id)}
          >
            <span class="min-w-0 truncate">
              <span class="font-medium">{f.name}</span>
              {#if normalize(f.name).includes(normalize(query)) === false && query}
                <span class="ml-1 text-xs text-muted-foreground">(approchant)</span>
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
          <p class="mt-2 text-sm font-medium">Aucun aliment trouvé</p>
          <p class="mt-1 text-xs text-muted-foreground">
            {#if query.trim()}
              Aucune correspondance pour « {query.trim()} ». Essayez un autre terme ou ajoutez-le au catalogue ci-dessous.
            {:else}
              Aucun aliment dans cette catégorie. Choisissez « Tous » ou ajoutez un aliment hors catalogue.
            {/if}
          </p>
        </li>
      {/each}
      {#if isCapped}
        <li class="flex items-center justify-center gap-1.5 bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
          <ListFilter size={12} aria-hidden="true" />
          <span>Affinez la recherche pour voir d’autres aliments…</span>
        </li>
      {/if}
    </ul>

    <button
      type="button"
      class="rounded-sm text-left text-sm text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onclick={openCustom}
    >
      + Ajouter un aliment hors catalogue
    </button>

    {#if customOpen}
      <div class="grid gap-3 rounded-md border bg-card p-3">
        <div class="grid gap-1.5">
          <label for="custom-name" class="text-sm font-medium">Nom de l’aliment</label>
          <Input id="custom-name" name={`${customName}.name`} bind:value={customNameValue} required maxlength={80} />
        </div>
        <div class="grid gap-1.5">
          <label for="custom-cat" class="text-sm font-medium">Catégorie</label>
          <Select
            id="custom-cat"
            name={`${customName}.category`}
            bind:value={customCategory}
          >
            {#each CATEGORIES as c (c.id)}
              <option value={c.id}>{c.label}</option>
            {/each}
          </Select>
        </div>
        <p class="text-xs text-muted-foreground">
          Cet aliment ne sera visible que pour cet enfant.
        </p>
      </div>
    {/if}
  {/if}
</div>

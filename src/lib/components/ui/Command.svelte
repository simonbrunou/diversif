<script lang="ts" module>
  export type CommandItem = {
    value: string;
    label: string;
    hint?: string;
  };
</script>

<script lang="ts">
  import { Search } from 'lucide-svelte';
  import { fuzzyMatch } from '$lib/utils/search';
  import { cn } from '$lib/utils/cn';

  type Props = {
    items: CommandItem[];
    value?: string;
    onSelect?: (item: CommandItem) => void;
    placeholder?: string;
    emptyLabel?: string;
    class?: string;
  };

  let {
    items,
    value = $bindable(''),
    onSelect,
    placeholder = '',
    emptyLabel = 'Aucun résultat',
    class: className = ''
  }: Props = $props();

  let query = $state('');

  const filtered = $derived(
    query.trim() === '' ? items : items.filter((item) => fuzzyMatch(query, item.label))
  );

  function select(item: CommandItem) {
    value = item.value;
    onSelect?.(item);
  }
</script>

<div class={cn('flex flex-col rounded-lg border-2 border-border bg-canvas', className)}>
  <div class="flex items-center gap-2 border-b border-border px-4 py-3">
    <Search class="h-4 w-4 text-ink-soft" aria-hidden="true" />
    <input
      type="text"
      bind:value={query}
      oninput={(e) => {
        query = (e.target as HTMLInputElement).value;
      }}
      {placeholder}
      class="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-ink-soft"
      autocomplete="off"
    />
  </div>
  <ul role="listbox" class="max-h-64 overflow-y-auto p-1">
    {#if filtered.length === 0}
      <li class="p-3 text-center text-sm text-ink-soft">{emptyLabel}</li>
    {:else}
      {#each filtered as item (item.value)}
        <li role="option" aria-selected={value === item.value}>
          <button
            type="button"
            onclick={() => select(item)}
            class="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-surface-2 data-[selected=true]:bg-tile-peach data-[selected=true]:text-tile-peach-foreground"
            data-selected={value === item.value}
          >
            <span>{item.label}</span>
            {#if item.hint}
              <span class="text-xs text-ink-soft">{item.hint}</span>
            {/if}
          </button>
        </li>
      {/each}
    {/if}
  </ul>
</div>

<script lang="ts" module>
  import type { Snippet } from 'svelte';

  export type TabItem = {
    value: string;
    label: string;
    panel: Snippet;
  };
</script>

<script lang="ts">
  import { Tabs as TabsPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';

  type Props = {
    value: string;
    onValueChange?: (value: string | undefined) => void;
    items: TabItem[];
    class?: string;
  };

  let { value = $bindable(), onValueChange, items, class: className = '' }: Props = $props();
</script>

<TabsPrimitive.Root bind:value {onValueChange} class={cn('w-full', className)}>
  <TabsPrimitive.List class="inline-flex items-center gap-1 rounded-full bg-surface-2 p-1">
    {#each items as item (item.value)}
      <TabsPrimitive.Trigger
        value={item.value}
        class="rounded-full px-3 py-1.5 text-xs font-semibold text-ink-soft transition-colors duration-base ease-soft data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-sm"
      >
        {item.label}
      </TabsPrimitive.Trigger>
    {/each}
  </TabsPrimitive.List>
  {#each items as item (item.value)}
    <TabsPrimitive.Content value={item.value} class="mt-4">
      {@render item.panel()}
    </TabsPrimitive.Content>
  {/each}
</TabsPrimitive.Root>

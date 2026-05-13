<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Popover as PopoverPrimitive } from 'bits-ui';

  type Props = {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    trigger?: Snippet;
    align?: 'start' | 'center' | 'end';
    children?: Snippet;
  };

  let {
    open = $bindable(false),
    onOpenChange,
    trigger,
    align = 'center',
    children
  }: Props = $props();
</script>

<PopoverPrimitive.Root bind:open {onOpenChange}>
  <PopoverPrimitive.Trigger>
    {#if trigger}{@render trigger()}{/if}
  </PopoverPrimitive.Trigger>
  <PopoverPrimitive.Content
    {align}
    sideOffset={8}
    class="z-50 w-72 rounded-lg border border-border bg-popover p-4 text-popover-foreground shadow-soft outline-none data-[state=open]:animate-in data-[state=closed]:animate-out"
  >
    {#if children}{@render children()}{/if}
  </PopoverPrimitive.Content>
</PopoverPrimitive.Root>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Tooltip as TooltipPrimitive } from 'bits-ui';

  type Props = {
    content: string;
    delay?: number;
    children?: Snippet;
  };

  let { content, delay = 200, children }: Props = $props();
</script>

<TooltipPrimitive.Root openDelay={delay}>
  <TooltipPrimitive.Trigger>
    {#if children}{@render children()}{/if}
  </TooltipPrimitive.Trigger>
  <TooltipPrimitive.Content
    sideOffset={6}
    class="z-50 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground shadow-soft data-[state=delayed-open]:animate-in data-[state=closed]:animate-out"
  >
    {content}
  </TooltipPrimitive.Content>
</TooltipPrimitive.Root>

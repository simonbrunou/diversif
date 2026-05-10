<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ScrollArea as ScrollAreaPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';

  type Props = {
    class?: string;
    orientation?: 'vertical' | 'horizontal' | 'both';
    children?: Snippet;
  };

  let { class: className = '', orientation = 'vertical', children }: Props = $props();
</script>

<ScrollAreaPrimitive.Root class={cn('relative overflow-hidden', className)}>
  <ScrollAreaPrimitive.Viewport class="h-full w-full rounded-[inherit]">
    {#if children}{@render children()}{/if}
  </ScrollAreaPrimitive.Viewport>
  {#if orientation === 'vertical' || orientation === 'both'}
    <ScrollAreaPrimitive.Scrollbar
      orientation="vertical"
      class="flex touch-none select-none p-0.5 transition-colors duration-base"
    >
      <ScrollAreaPrimitive.Thumb class="relative flex-1 rounded-full bg-border" />
    </ScrollAreaPrimitive.Scrollbar>
  {/if}
  {#if orientation === 'horizontal' || orientation === 'both'}
    <ScrollAreaPrimitive.Scrollbar
      orientation="horizontal"
      class="flex h-2.5 touch-none select-none p-0.5"
    >
      <ScrollAreaPrimitive.Thumb class="relative rounded-full bg-border" />
    </ScrollAreaPrimitive.Scrollbar>
  {/if}
  <ScrollAreaPrimitive.Corner />
</ScrollAreaPrimitive.Root>

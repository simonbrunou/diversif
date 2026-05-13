<script lang="ts">
  import { Avatar as AvatarPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';

  type Props = {
    src?: string;
    alt?: string;
    fallback: string;
    size?: 'sm' | 'md' | 'lg';
    class?: string;
  };

  let { src, alt = '', fallback, size = 'md', class: className = '' }: Props = $props();

  const sizes = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-base'
  };
</script>

<AvatarPrimitive.Root
  class={cn(
    'bg-avatar-tile relative flex shrink-0 overflow-hidden rounded-full ring-2 ring-surface',
    sizes[size],
    className
  )}
>
  {#if src}
    <AvatarPrimitive.Image {src} {alt} class="aspect-square h-full w-full object-cover" />
  {/if}
  <AvatarPrimitive.Fallback
    class="flex h-full w-full items-center justify-center bg-transparent font-semibold text-tile-peach-foreground"
  >
    {fallback}
  </AvatarPrimitive.Fallback>
</AvatarPrimitive.Root>

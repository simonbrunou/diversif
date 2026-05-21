<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  type Tone = 'default' | 'destructive';
  type Size = 'sm' | 'md';

  let {
    as = 'h2',
    tone = 'default',
    size = 'md',
    class: className = '',
    id,
    children
  }: {
    as?: 'h2' | 'h3';
    tone?: Tone;
    size?: Size;
    class?: string;
    id?: string;
    children: Snippet;
  } = $props();

  const TONES: Record<Tone, string> = {
    default: 'text-ink-soft',
    destructive: 'text-destructive'
  };

  const SIZES: Record<Size, string> = {
    sm: 'text-xs',
    md: 'text-sm'
  };

  const baseClasses = 'mb-2 font-semibold uppercase tracking-wider';
</script>

{#if as === 'h3'}
  <h3 {id} class={cn(baseClasses, SIZES[size], TONES[tone], className)}>
    {@render children()}
  </h3>
{:else}
  <h2 {id} class={cn(baseClasses, SIZES[size], TONES[tone], className)}>
    {@render children()}
  </h2>
{/if}

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils/cn';

  type Tone = 'default' | 'destructive';

  let {
    as = 'h2',
    tone = 'default',
    class: className = '',
    id,
    children
  }: {
    as?: 'h2' | 'h3';
    tone?: Tone;
    class?: string;
    id?: string;
    children: Snippet;
  } = $props();

  const TONES: Record<Tone, string> = {
    default: 'text-ink-soft',
    destructive: 'text-destructive'
  };
</script>

{#if as === 'h3'}
  <h3 {id} class={cn('mb-2 text-sm font-semibold uppercase tracking-wider', TONES[tone], className)}>
    {@render children()}
  </h3>
{:else}
  <h2 {id} class={cn('mb-2 text-sm font-semibold uppercase tracking-wider', TONES[tone], className)}>
    {@render children()}
  </h2>
{/if}

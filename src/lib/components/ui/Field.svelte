<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '#lib/utils/cn.js';
  import Label from './Label.svelte';

  let {
    name,
    label,
    hint,
    class: className = '',
    labelClass = '',
    hintClass = '',
    children
  }: {
    name: string;
    label: string;
    hint?: string;
    class?: string;
    /** Merged into the label's classes, e.g. `text-current` on a tint. */
    labelClass?: string;
    /** Merged into the hint's classes, e.g. `text-current` on a tint. */
    hintClass?: string;
    children: Snippet;
  } = $props();
</script>

<div class={cn('grid gap-1.5', className)}>
  <Label for={name} class={labelClass}>{label}</Label>
  {@render children()}
  {#if hint}
    <p class={cn('text-xs text-ink-soft', hintClass)}>{hint}</p>
  {/if}
</div>

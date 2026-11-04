<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '#lib/utils/cn.js';
  import Label from './Label.svelte';
  import FormError from './FormError.svelte';

  let {
    name,
    label,
    hint,
    error,
    class: className = '',
    labelClass = '',
    children
  }: {
    name: string;
    label: string;
    hint?: string;
    error?: string;
    class?: string;
    /** Merged into the label's classes, e.g. `text-current` on a tint. */
    labelClass?: string;
    children: Snippet;
  } = $props();
</script>

<div class={cn('grid gap-1.5', className)}>
  <Label for={name} class={labelClass}>{label}</Label>
  {@render children()}
  {#if hint}
    <p class="text-xs text-ink-soft">{hint}</p>
  {/if}
  {#if error}
    <FormError>{error}</FormError>
  {/if}
</div>

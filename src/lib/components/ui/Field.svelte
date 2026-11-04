<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '#lib/utils/cn.js';
  import Label from './Label.svelte';

  let {
    name,
    label,
    hint,
    class: className = '',
    children
  }: {
    name: string;
    label: string;
    hint?: string;
    class?: string;
    children: Snippet;
  } = $props();
</script>

<div class={cn('grid gap-1.5', className)}>
  <Label for={name}>{label}</Label>
  {@render children()}
  {#if hint}
    <p class="text-xs text-ink-soft">{hint}</p>
  {/if}
</div>

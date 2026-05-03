<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    title,
    description,
    action
  }: {
    title: string;
    description?: string;
    action?: Snippet;
  } = $props();
</script>

<div class="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/40 px-6 py-12 text-center">
  <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  </div>
  <h2 class="text-base font-medium">{title}</h2>
  {#if description}
    <p class="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
  {/if}
  {#if action}
    <div class="mt-4">{@render action()}</div>
  {/if}
</div>

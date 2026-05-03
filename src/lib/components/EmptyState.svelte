<script lang="ts">
  import type { Snippet } from 'svelte';
  import { HelpCircle, type Icon as LucideIcon } from 'lucide-svelte';

  let {
    title,
    description,
    icon = HelpCircle,
    action
  }: {
    title: string;
    description?: string;
    icon?: typeof LucideIcon;
    action?: Snippet;
  } = $props();

  const Icon = $derived(icon);
</script>

<div
  class="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/40 px-6 py-12 text-center"
>
  <div class="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
    <Icon size={24} aria-hidden="true" />
  </div>
  <h2 class="text-base font-medium">{title}</h2>
  {#if description}
    <p class="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
  {/if}
  {#if action}
    <div class="mt-4">{@render action()}</div>
  {/if}
</div>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import Modal from './Modal.svelte';

  let {
    open = $bindable(false),
    title,
    intro,
    onOpenChange,
    children
  }: {
    open?: boolean;
    title: string;
    intro?: string;
    onOpenChange?: (open: boolean) => void;
    children: Snippet;
  } = $props();
</script>

<Modal bind:open side="auto" {title} {onOpenChange} scrollableBody>
  {#if intro}
    <p class="text-sm text-ink-soft">{intro}</p>
  {/if}
  {@render children()}
</Modal>

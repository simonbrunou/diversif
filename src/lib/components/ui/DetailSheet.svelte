<script lang="ts">
  import type { Snippet } from 'svelte';
  import Modal from './Modal.svelte';

  let {
    open = $bindable(false),
    title,
    intro,
    onOpenChange,
    onclose,
    class: className = '',
    children,
    footer
  }: {
    open?: boolean;
    title: string;
    intro?: string;
    onOpenChange?: (open: boolean) => void;
    onclose?: () => void;
    class?: string;
    children: Snippet;
    footer?: Snippet;
  } = $props();
</script>

<Modal
  bind:open
  side="auto"
  {title}
  {onOpenChange}
  {onclose}
  scrollableBody
  class={className}
  {footer}
>
  {#if intro}
    <p class="text-sm text-ink-soft">{intro}</p>
  {/if}
  {@render children()}
</Modal>

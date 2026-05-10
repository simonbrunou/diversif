<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLLabelAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils/cn';

  type Props = HTMLLabelAttributes & { class?: string; children?: Snippet };
  let { class: className = '', children, ...rest }: Props = $props();
</script>

<label
  class={cn(
    'text-xs font-semibold uppercase tracking-wider text-ink-soft peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
    className
  )}
  {...rest}
>
  {#if children}{@render children()}{/if}
</label>

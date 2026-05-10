<script lang="ts">
  import type { HTMLTextareaAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils/cn';

  type Props = HTMLTextareaAttributes & { class?: string };
  let { class: className = '', value = $bindable(), ...rest }: Props = $props();
</script>

<textarea
  class={cn(
    'flex min-h-[88px] w-full rounded-lg border-2 border-border bg-canvas px-4 py-2 text-sm text-foreground transition-colors duration-base ease-soft placeholder:text-ink-soft focus-visible:outline-none focus-visible:border-primary focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50',
    className
  )}
  bind:value
  {...rest}
></textarea>

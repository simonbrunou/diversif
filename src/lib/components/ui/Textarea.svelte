<script lang="ts">
  import type { HTMLTextareaAttributes } from 'svelte/elements';
  import { cn } from '#lib/utils/cn.js';

  type Props = HTMLTextareaAttributes & { class?: string };
  let { class: className = '', value = $bindable(), ...rest }: Props = $props();
</script>

<textarea
  class={cn(
    // fallow-ignore-next-line css-token-drift -- the textarea's resting height, about three lines of text, not a design value a token would name
    'flex min-h-[88px] w-full rounded-lg border-2 border-border bg-canvas px-4 py-2 text-sm text-foreground transition-colors duration-base ease-soft placeholder:text-ink-soft focus-visible:outline-none focus-visible:border-primary focus-visible:ring-0 disabled:cursor-not-allowed disabled:opacity-50',
    className
  )}
  bind:value
  {...rest}
></textarea>

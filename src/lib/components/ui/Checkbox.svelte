<script lang="ts">
  import { Checkbox as CheckboxPrimitive } from 'bits-ui';
  import { Check, Minus } from 'lucide-svelte';
  import { cn } from '$lib/utils/cn';

  type Props = {
    checked?: boolean | 'indeterminate';
    onCheckedChange?: (checked: boolean | 'indeterminate') => void;
    disabled?: boolean;
    class?: string;
    id?: string;
    'aria-label'?: string;
  };

  let {
    checked = $bindable(false),
    onCheckedChange,
    disabled = false,
    class: className = '',
    id,
    'aria-label': ariaLabel
  }: Props = $props();
</script>

<CheckboxPrimitive.Root
  bind:checked
  onCheckedChange={(v) => onCheckedChange?.(v)}
  {disabled}
  {id}
  aria-label={ariaLabel}
  class={cn(
    'peer flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border-2 border-border bg-surface ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground',
    className
  )}
>
  {#if checked === 'indeterminate'}
    <Minus class="h-3.5 w-3.5" />
  {:else if checked === true}
    <Check class="h-3.5 w-3.5" />
  {/if}
</CheckboxPrimitive.Root>

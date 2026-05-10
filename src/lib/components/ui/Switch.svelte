<script lang="ts">
  import { Switch as SwitchPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';

  type Props = {
    checked: boolean;
    onCheckedChange?: (checked: boolean) => void;
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

<SwitchPrimitive.Root
  bind:checked
  {onCheckedChange}
  {disabled}
  {id}
  aria-label={ariaLabel}
  class={cn(
    'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-base ease-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-primary data-[state=unchecked]:bg-surface-2',
    className
  )}
>
  <SwitchPrimitive.Thumb
    class="pointer-events-none block h-5 w-5 rounded-full bg-surface shadow-sm ring-0 transition-transform duration-base ease-spring data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0"
  />
</SwitchPrimitive.Root>

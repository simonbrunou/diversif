<script lang="ts">
  import { Progress as ProgressPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';

  type Props = {
    value: number;
    max?: number;
    class?: string;
    indicatorClass?: string;
    'aria-label'?: string;
  };

  let {
    value,
    max = 100,
    class: className = '',
    indicatorClass = '',
    'aria-label': ariaLabel
  }: Props = $props();
</script>

<ProgressPrimitive.Root
  {value}
  {max}
  aria-label={ariaLabel}
  class={cn('relative h-2 w-full overflow-hidden rounded-full bg-surface-2', className)}
>
  <div
    class={cn('h-full bg-primary transition-transform duration-base ease-soft', indicatorClass)}
    style="transform: translateX(-{100 - (value / max) * 100}%)"
  ></div>
</ProgressPrimitive.Root>

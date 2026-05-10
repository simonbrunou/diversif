<script lang="ts">
  import { Separator as SeparatorPrimitive } from 'bits-ui';
  import { cn } from '$lib/utils/cn';

  type Props = {
    orientation?: 'horizontal' | 'vertical';
    decorative?: boolean;
    class?: string;
  };

  let {
    orientation = 'horizontal',
    decorative = true,
    class: className = ''
  }: Props = $props();
</script>

<SeparatorPrimitive.Root
  {orientation}
  {decorative}
  class={cn('shrink-0 bg-border', orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px', className)}
/>

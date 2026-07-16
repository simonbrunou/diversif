<script lang="ts">
  import { getCategoryClasses, getCategoryIcon, getCategoryLabel } from '$lib/utils/categories';
  import { cn } from '$lib/utils/cn';

  let {
    id,
    size = 'md',
    class: className = ''
  }: { id: string; size?: 'sm' | 'md'; class?: string } = $props();

  const classes = $derived(getCategoryClasses(id));
  const Icon = $derived(getCategoryIcon(id));
  const label = $derived(getCategoryLabel(id));
  const iconSize = $derived(size === 'sm' ? 12 : 14);
</script>

<span
  class={cn(
    'inline-flex items-center gap-1 rounded-full font-medium',
    classes.tint,
    classes.ring,
    classes.text,
    size === 'sm' ? 'px-1.5 py-0.5 text-2xs' : 'px-2 py-0.5 text-xs',
    className
  )}
>
  <Icon size={iconSize} aria-hidden="true" />
  {label}
</span>

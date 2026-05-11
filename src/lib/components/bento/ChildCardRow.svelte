<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { ChevronRight } from 'lucide-svelte';

  type Child = { id: string; name: string; ageMonths: number };

  let { child, href }: { child: Child; href: string } = $props();
</script>

<a
  {href}
  aria-label={m.profilChildrenChevronAria({ name: child.name })}
  class="mb-2 flex items-center gap-3 rounded-tile bg-tile-peach px-4 py-3 shadow-soft transition-transform duration-base ease-soft hover:scale-[1.01] active:scale-[0.99]"
>
  <span class="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-base font-bold">
    {child.name.charAt(0)}
  </span>
  <span class="flex-1">
    <p class="text-base font-bold leading-tight">{child.name}</p>
    <p class="text-xs text-ink-soft">{child.ageMonths} mois</p>
  </span>
  <ChevronRight size={18} class="text-ink-soft" aria-hidden="true" />
</a>

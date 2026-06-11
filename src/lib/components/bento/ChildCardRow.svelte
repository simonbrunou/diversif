<script lang="ts">
  import LinkRow from '$components/ui/LinkRow.svelte';
  import * as m from '$lib/paraglide/messages';
  import { ChevronRight } from 'lucide-svelte';

  type Child = { id: string; name: string; ageMonths: number };

  let { child, href }: { child: Child; href: string } = $props();
</script>

<LinkRow
  {href}
  variant="tile-peach"
  lift
  aria-label={m.profilChildrenChevronAria({ name: child.name })}
  class="mb-2 px-4"
>
  <span class="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-base font-bold">
    {child.name.charAt(0)}
  </span>
  <span class="flex-1">
    <p class="text-base font-bold leading-tight">{child.name}</p>
    <p class="text-xs text-ink-soft">
      {child.ageMonths === 1
        ? m.childAgeMonthsOne()
        : m.childAgeMonthsOther({ months: child.ageMonths })}
    </p>
  </span>
  <ChevronRight size={18} class="text-ink-soft" aria-hidden="true" />
</LinkRow>

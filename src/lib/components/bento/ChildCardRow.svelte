<script lang="ts">
  import LinkRow from '#lib/components/ui/LinkRow.svelte';
  import * as m from '#lib/paraglide/messages.js';
  import { ChevronRight } from '@lucide/svelte';

  type Child = { id: string; name: string; ageMonths: number };

  let { child, href }: { child: Child; href: string } = $props();
</script>

<!--
  No aria-label: the link takes its name from its text, « Léa 8 mois ,
  ouvrir les réglages », so a speech-input user can say the name and age
  they see (WCAG 2.5.3, #693). The initial repeats the name's first letter,
  so it is hidden from the name.
-->
<LinkRow {href} variant="tile-peach" lift class="mb-2 px-4">
  <span
    aria-hidden="true"
    class="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-sm font-bold"
  >
    {child.name.charAt(0)}
  </span>
  <span class="flex-1">
    <p class="text-sm font-bold leading-tight">{child.name}</p>
    <p class="text-xs text-ink-soft">
      {child.ageMonths === 1
        ? m.childAgeMonthsOne()
        : m.childAgeMonthsOther({ months: child.ageMonths })}<span class="sr-only"
        >{m.profilChildrenOpenSettingsHint()}</span
      >
    </p>
  </span>
  <ChevronRight size={18} class="text-ink-soft" aria-hidden="true" />
</LinkRow>

<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { ChevronDown } from 'lucide-svelte';
  import { ageInMonths } from '$lib/utils/age';

  type Child = {
    id: string;
    name: string;
    birthMonth: string;
    avatarSeed: string;
  };

  let {
    child,
    onSwitch
  }: { child: Child; onSwitch: () => void } = $props();

  const ageMonths = $derived(ageInMonths(child.birthMonth));
  const ageLabel = $derived(
    ageMonths === 1 ? m.childAgeMonthsOne() : m.childAgeMonthsOther({ months: ageMonths })
  );
</script>

<button
  type="button"
  onclick={onSwitch}
  style="view-transition-name: child-header-pill"
  class="mx-auto mb-3 flex w-full max-w-md items-center gap-3 rounded-tile border border-border/60 bg-canvas px-3 py-2 text-left transition-colors duration-base ease-soft hover:bg-surface-2"
>
  <span
    class="bg-avatar-tile flex h-9 w-9 items-center justify-center rounded-full text-base"
    aria-hidden="true"
  >
    {child.avatarSeed}
  </span>
  <span class="flex flex-col">
    <span class="text-sm font-bold leading-tight">{child.name}</span>
    <span class="text-xs text-ink-soft">{ageLabel}</span>
  </span>
  <span class="ml-auto flex items-center gap-1 text-xs text-primary-strong">
    {m.chromeHeaderChangeChild()}
    <ChevronDown size={14} aria-hidden="true" />
  </span>
</button>

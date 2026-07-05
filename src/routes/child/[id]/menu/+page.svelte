<script lang="ts">
  import BackHeader from '$components/ui/BackHeader.svelte';
  import QuantitiesCard from '$lib/components/menu/QuantitiesCard.svelte';
  import MenuDay from '$lib/components/menu/MenuDay.svelte';
  import * as m from '$lib/paraglide/messages';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<div class="mx-auto w-full max-w-2xl space-y-4 px-4 py-6">
  <BackHeader
    title={m.menuTitle()}
    subtitle={m.menuSubtitle({ name: data.child.name })}
    fallback={`/child/${data.child.id}`}
  />

  {#if data.ageMonths >= 4}
    <QuantitiesCard quantities={data.menu.quantities} />
    <MenuDay menu={data.menu} childId={data.child.id} />
  {:else}
    <p class="text-sm text-ink-soft">{m.menuMilkPrimary()}</p>
  {/if}
</div>

<script lang="ts">
  import FoodCard from './FoodCard.svelte';
  import { localizedHref } from '$lib/utils/localized-href';

  type Item = {
    id: number;
    name: string;
    category: string;
    tried: number;
    status: 'ras' | 'inconfort' | 'reaction' | 'todo';
    lastEntryId?: number | null;
  };

  let { items, childId }: { items: Item[]; childId?: string } = $props();
</script>

<div class="grid grid-cols-2 gap-3">
  {#each items as item (item.id)}
    <FoodCard
      name={item.name}
      category={item.category}
      tried={item.tried}
      status={item.status}
      href={childId && item.lastEntryId != null
        ? localizedHref(`/child/${childId}/foods/${item.lastEntryId}`)
        : undefined}
    />
  {/each}
</div>

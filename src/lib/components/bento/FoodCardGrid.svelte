<script lang="ts">
  import FoodCard from './FoodCard.svelte';

  type Item = {
    id: number;
    name: string;
    category: string;
    tried: number;
    status: 'ras' | 'inconfort' | 'reaction' | 'todo';
  };

  let { items }: { items: Item[] } = $props();
</script>

<div class="grid grid-cols-2 gap-3">
  {#each items as item (item.id)}
    <FoodCard name={item.name} category={item.category} tried={item.tried} status={item.status} />
  {/each}
</div>

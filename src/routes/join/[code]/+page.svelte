<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import Button from '$components/ui/Button.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<div class="container flex max-w-md flex-1 flex-col justify-center py-10">
  <Card class="p-6 text-center">
    <h1 class="text-xl font-semibold">Invitation</h1>
    {#if data.error}
      <p class="mt-3 text-sm text-destructive">{data.error}</p>
    {/if}
    <div class="mt-6">
      <Button href="/" variant="outline">Retour</Button>
    </div>
  </Card>
</div>

<script lang="ts">
  import DiscoverBento from '$lib/components/bento/DiscoverBento.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<DiscoverBento
  stages={data.stages}
  activeStageId={data.currentStageId}
/>

<script lang="ts">
  import DiscoverBento from '$lib/components/bento/DiscoverBento.svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const childId = $derived($page.params.id);
</script>

<DiscoverBento
  stages={data.stages}
  activeStageId={data.currentStageId}
  suggestions={data.suggestions}
  todayTip={data.todayTip}
  tipDismissed={data.tipDismissed}
  onPickSuggestion={(food) => goto(`/child/${childId}?suggested=${food.id}`)}
  onDismissTip={() => {}}
/>

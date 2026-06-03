<script lang="ts">
  import DiscoverBento from '$lib/components/bento/DiscoverBento.svelte';
  import Callout from '$lib/components/ui/Callout.svelte';
  import * as m from '$lib/paraglide/messages';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<DiscoverBento
  stages={data.stages}
  activeStageId={data.currentStageId}
/>

<Callout variant="info" class="mt-4">{m.guideMedicalDisclaimer()}</Callout>

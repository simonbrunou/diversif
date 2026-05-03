<script lang="ts">
  import type { Snippet } from 'svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import type { LayoutData } from './$types';

  let { data, children }: { data: LayoutData; children: Snippet } = $props();
</script>

<div class="flex flex-1 flex-col pb-16 md:pb-0">
  <main class="flex-1">
    {@render children()}
  </main>
  <BottomNav childId={data.child.id} />
</div>

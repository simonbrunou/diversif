<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<!-- Bento shell (root +layout.svelte) owns all chrome.
     Skip the legacy AppShell + BottomNav so we don't double-render the
     bottom nav — both have aria-label "Navigation principale". -->
{@render children()}

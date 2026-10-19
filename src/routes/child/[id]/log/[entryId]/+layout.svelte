<script lang="ts">
  import { page } from '$app/state';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

<!-- One editor per entry. Removing an aliment from a meal redirects to the
     editor of a surviving entry: SvelteKit would otherwise reuse this page
     with the state it seeded at load (the meal's aliments, the open confirm
     dialog), so the removed aliment stayed on screen. -->
{#key page.params.entryId}
  {@render children()}
{/key}

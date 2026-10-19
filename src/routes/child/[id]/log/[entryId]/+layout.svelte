<script lang="ts">
  import { page } from '$app/state';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();

  // The page's own load data (this layout has no load of its own).
  const repas = $derived(page.data as { meal?: { members: { id: number }[] } | null });
  const editorKey = $derived(
    `${page.params.entryId}:${repas.meal?.members.map((m) => m.id).join(',') ?? ''}`
  );
</script>

<!-- One editor per entry and per set of aliments. « Retirer » redirects to
     the editor of a surviving entry, often the same one: SvelteKit would
     otherwise reuse this page with the state it seeded at load (the meal's
     aliments, the open confirm dialog), so the removed aliment stayed on
     screen. A refused save reloads nothing, so it keeps its form error. -->
{#key editorKey}
  {@render children()}
{/key}

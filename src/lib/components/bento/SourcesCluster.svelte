<script lang="ts">
  import SectionHeader from '$components/ui/SectionHeader.svelte';
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';
  import type { SourceId } from '$lib/content/sources';

  // Short chip labels for the Découvrir bento. The `id` matches the canonical
  // SourceId in $lib/content/sources so the #fragment anchor lands on the right
  // <li> on /sources.
  const CLUSTER_SOURCES: ReadonlyArray<{ id: SourceId; label: string }> = [
    { id: 'leap-2015', label: 'LEAP' },
    { id: 'eat-2016', label: 'EAT' },
    { id: 'espghan-2017', label: 'ESPGHAN' },
    { id: 'anses-nourrisson', label: 'ANSES' },
    { id: 'hcsp-2020', label: 'HCSP' }
  ];
</script>

<section class="mb-3">
  <SectionHeader>{m.decouvrirSourcesTitle()}</SectionHeader>
  <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
    {#each CLUSTER_SOURCES as src (src.id)}
      <a
        href={localizedHref(`/sources#${src.id}`)}
        class="rounded-tile bg-tile-sky px-3 py-2 text-center text-sm font-semibold text-tile-sky-foreground shadow-soft transition-transform duration-base ease-soft hover:scale-[1.02] active:scale-[0.99]"
      >
        {src.label}
      </a>
    {/each}
  </div>
</section>

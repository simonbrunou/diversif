<script lang="ts">
  import SectionHeader from '$components/ui/SectionHeader.svelte';
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';

  const SOURCES = [
    { key: 'leap', label: 'LEAP' },
    { key: 'eat', label: 'EAT' },
    { key: 'espghan', label: 'ESPGHAN' },
    { key: 'anses', label: 'ANSES' },
    { key: 'hcsp', label: 'HCSP' }
  ] as const;
</script>

<section class="mb-3">
  <SectionHeader>{m.decouvrirSourcesTitle()}</SectionHeader>
  <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
    {#each SOURCES as src (src.key)}
      <a
        href={localizedHref(`/sources#${src.key}`)}
        class="rounded-tile bg-tile-sky px-3 py-2 text-center text-sm font-semibold text-tile-sky-foreground shadow-soft transition-transform duration-base ease-soft hover:scale-[1.02] active:scale-[0.99]"
      >
        {src.label}
      </a>
    {/each}
  </div>
</section>

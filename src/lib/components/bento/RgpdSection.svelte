<script lang="ts">
  import SectionHeader from '$components/ui/SectionHeader.svelte';
  import * as m from '$lib/paraglide/messages';
  import { Download, Trash2 } from 'lucide-svelte';
</script>

<section class="mb-3">
  <SectionHeader>{m.profilRgpdTitle()}</SectionHeader>
  <a
    href="/account/export"
    class="mb-2 flex items-center gap-3 rounded-tile bg-tile-peach px-3 py-3 shadow-soft transition-transform duration-base ease-soft active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none"
  >
    <Download size={18} class="text-tile-peach-foreground" aria-hidden="true" />
    <span class="flex-1 text-sm font-bold">{m.profilRgpdExport()}</span>
  </a>
  <a
    href="/account#delete"
    class="flex items-center gap-3 rounded-tile bg-tile-butter px-3 py-3 shadow-soft transition-transform duration-base ease-soft active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none"
  >
    <Trash2 size={18} class="text-tile-butter-foreground" aria-hidden="true" />
    <span class="flex-1 text-sm font-bold">{m.profilRgpdDelete()}</span>
  </a>
</section>

<script lang="ts">
  import LinkRow from '$components/ui/LinkRow.svelte';
  import SectionHeader from '$components/ui/SectionHeader.svelte';
  import * as m from '$lib/paraglide/messages';
  import { Download, Trash2 } from 'lucide-svelte';
</script>

<section class="mb-3">
  <SectionHeader>{m.profilRgpdTitle()}</SectionHeader>
  <LinkRow href="/account/export" variant="tile-peach" class="mb-2">
    <Download size={18} class="text-tile-peach-foreground" aria-hidden="true" />
    <span class="flex-1 text-sm font-bold">{m.profilRgpdExport()}</span>
  </LinkRow>
  <LinkRow href="/account#delete" variant="tile-butter">
    <Trash2 size={18} class="text-tile-butter-foreground" aria-hidden="true" />
    <span class="flex-1 text-sm font-bold">{m.profilRgpdDelete()}</span>
  </LinkRow>
</section>

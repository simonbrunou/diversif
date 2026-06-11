<script lang="ts">
  import BackHeader from '$components/ui/BackHeader.svelte';
  import LocaleSwitcher from '$lib/components/LocaleSwitcher.svelte';
  import * as m from '$lib/paraglide/messages';
</script>

<BackHeader title={m.profilCompteLangue()} />

<LocaleSwitcher variant="rows" />

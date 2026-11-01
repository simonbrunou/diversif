<script lang="ts">
  import PageTitle from '#lib/components/PageTitle.svelte';
  import BackHeader from '#lib/components/ui/BackHeader.svelte';
  import LocaleSwitcher from '#lib/components/LocaleSwitcher.svelte';
  import * as m from '#lib/paraglide/messages.js';
  import { SITE } from '#lib/seo.js';
</script>

<PageTitle title={`${m.profilCompteLangue()} · ${SITE.name}`} />
<BackHeader title={m.profilCompteLangue()} />

<LocaleSwitcher variant="rows" />

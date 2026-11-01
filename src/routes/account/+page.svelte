<script lang="ts">
  import ProfilBento from '#lib/components/bento/ProfilBento.svelte';
  import PageTitle from '#lib/components/PageTitle.svelte';
  import * as m from '#lib/paraglide/messages.js';
  import { SITE } from '#lib/seo.js';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<PageTitle title={`${m.authAccountHeading()} · ${SITE.name}`} />

<ProfilBento
  children={data.children}
  passkeyCount={data.passkeys.length}
  locale={data.locale}
  theme={data.theme}
/>

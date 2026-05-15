<script lang="ts">
  import ProfilBento from '$lib/components/bento/ProfilBento.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<ProfilBento
  children={data.children}
  passkeyCount={data.passkeys.length}
  locale={data.locale}
  theme={data.theme}
/>

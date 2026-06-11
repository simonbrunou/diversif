<script lang="ts">
  import BackHeader from '$components/ui/BackHeader.svelte';
  import Button from '$components/ui/Button.svelte';
  import Card from '$components/ui/Card.svelte';
  import SectionHeader from '$components/ui/SectionHeader.svelte';
  import { purgeBeforeSubmit } from '$lib/offline/purge';
  import * as m from '$lib/paraglide/messages';
</script>

<BackHeader title={m.authAccountSessionsSection()} />

<div class="space-y-4">
  <Card as="section" variant="surface" class="px-4 py-3">
    <SectionHeader as="h2">{m.authAccountSessionsSection()}</SectionHeader>
    <p class="mb-3 text-sm text-ink-soft">{m.authAccountSessionsDescription()}</p>
    <!-- purgeBeforeSubmit clears the SW 'pages' cache + offline queue BEFORE
         the full-document POST : Safari ignores the server's Clear-Site-Data
         header, and the root layout remounts fresh on this navigation so its
         session-expiry $effect never observes the transition. -->
    <form method="POST" action="?/logoutEverywhere" onsubmit={purgeBeforeSubmit}>
      <Button type="submit" variant="outline">{m.authAccountLogoutEverywhere()}</Button>
    </form>
  </Card>

  <Card as="section" variant="surface" class="px-4 py-3">
    <SectionHeader as="h2">{m.authAccountLogoutSection()}</SectionHeader>
    <form method="POST" action="/logout" onsubmit={purgeBeforeSubmit}>
      <Button type="submit" variant="outline">{m.authAccountLogout()}</Button>
    </form>
  </Card>
</div>

<script lang="ts">
  import BackHeader from '$components/ui/BackHeader.svelte';
  import Button from '$components/ui/Button.svelte';
  import Card from '$components/ui/Card.svelte';
  import SectionHeader from '$components/ui/SectionHeader.svelte';
  import * as m from '$lib/paraglide/messages';
</script>

<BackHeader title={m.authAccountSessionsSection()} />

<div class="space-y-4">
  <Card as="section" variant="surface" class="px-4 py-3">
    <SectionHeader as="h2">{m.authAccountSessionsSection()}</SectionHeader>
    <p class="mb-3 text-sm text-ink-soft">{m.authAccountSessionsDescription()}</p>
    <form method="POST" action="?/logoutEverywhere">
      <Button type="submit" variant="outline">{m.authAccountLogoutEverywhere()}</Button>
    </form>
  </Card>

  <Card as="section" variant="surface" class="px-4 py-3">
    <SectionHeader as="h2">{m.authAccountLogoutSection()}</SectionHeader>
    <form method="POST" action="/logout">
      <Button type="submit" variant="outline">{m.authAccountLogout()}</Button>
    </form>
  </Card>
</div>

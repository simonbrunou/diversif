<script lang="ts">
  import BackHeader from '$components/ui/BackHeader.svelte';
  import Button from '$components/ui/Button.svelte';
  import Card from '$components/ui/Card.svelte';
  import Modal from '$components/ui/Modal.svelte';
  import SectionHeader from '$components/ui/SectionHeader.svelte';
  import { purgeBeforeSubmit } from '$lib/offline/purge';
  import * as m from '$lib/paraglide/messages';

  let confirmOpen = $state(false);
  let loggingOutEverywhere = $state(false);

  // Kicks every other session (including a co-parent's, mid-use) on a single
  // tap, so it's gated behind a confirmation like the app's other
  // consequential actions. The actual submit stays a plain full-document POST
  // (not use:enhance/ConfirmModal) so purgeBeforeSubmit's reasoning still
  // holds: Clear-Site-Data rides the 303, and the root layout remounts fresh
  // instead of relying on a client-side transition. `loggingOutEverywhere`
  // never needs resetting — the page navigates away right after.
  function confirmLogoutEverywhere(event: SubmitEvent) {
    loggingOutEverywhere = true;
    purgeBeforeSubmit(event);
  }
</script>

<BackHeader title={m.authAccountSessionsSection()} />

<div class="space-y-4">
  <Card as="section" variant="surface" class="px-4 py-3">
    <SectionHeader as="h2">{m.authAccountSessionsSection()}</SectionHeader>
    <p class="mb-3 text-sm text-ink-soft">{m.authAccountSessionsDescription()}</p>
    <form
      id="logoutEverywhereForm"
      method="POST"
      action="?/logoutEverywhere"
      onsubmit={confirmLogoutEverywhere}
    ></form>
    <Button type="button" variant="outline" onclick={() => (confirmOpen = true)}>
      {m.authAccountLogoutEverywhere()}
    </Button>
  </Card>

  <Card as="section" variant="surface" class="px-4 py-3">
    <SectionHeader as="h2">{m.authAccountLogoutSection()}</SectionHeader>
    <form method="POST" action="/logout" onsubmit={purgeBeforeSubmit}>
      <Button type="submit" variant="outline">{m.authAccountLogout()}</Button>
    </form>
  </Card>
</div>

<Modal
  bind:open={confirmOpen}
  side="center"
  title={m.authAccountLogoutEverywhereConfirmTitle()}
  description={m.authAccountSessionsDescription()}
>
  {#snippet footer()}
    <Button type="button" variant="outline" onclick={() => (confirmOpen = false)}>
      {m.commonCancel()}
    </Button>
    <Button
      type="submit"
      form="logoutEverywhereForm"
      variant="destructive"
      loading={loggingOutEverywhere}
    >
      {loggingOutEverywhere
        ? m.authAccountLogoutEverywhereLoading()
        : m.authAccountLogoutEverywhere()}
    </Button>
  {/snippet}
</Modal>
